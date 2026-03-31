"""
Dashboard endpoints - Aggregate statistics and recent activity
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, text
from typing import List, Optional
from datetime import datetime, timedelta, date
from pydantic import BaseModel
import time as _time
import httpx

from app.core.database import get_db
from app.core.config import settings
from app.models import Project, Submission, User, OrgMember, File, Finding, AnalysisRun
from app.core.security import get_current_user

router = APIRouter()


# Response models
class ProjectStats(BaseModel):
    total: int
    active: int


class SubmissionStats(BaseModel):
    total: int
    pending: int
    analyzed: int


class FindingStats(BaseModel):
    total: int
    critical: int
    high: int
    medium: int
    low: int
    accepted: int


class UsageStats(BaseModel):
    submissions_this_month: int
    analyses_today: int
    storage_mb: float


class DashboardStatsResponse(BaseModel):
    projects: ProjectStats
    submissions: SubmissionStats
    findings: FindingStats
    usage: UsageStats


class ActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    timestamp: datetime
    link: str | None = None
    status: str | None = None


class RecentActivityResponse(BaseModel):
    activities: List[ActivityItem]


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aggregate statistics for dashboard"""
    # Get user's organization
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    org_id = org_member.org_id
    
    # Project stats
    total_projects = db.query(func.count(Project.id)).filter(
        Project.org_id == org_id,
        Project.is_deleted == False,
    ).scalar() or 0
    
    # Consider projects with submissions in last 30 days as "active"
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_projects = db.query(func.count(func.distinct(Submission.project_id))).filter(
        and_(
            Submission.created_at >= thirty_days_ago,
            Submission.project_id.in_(
                db.query(Project.id).filter(Project.org_id == org_id, Project.is_deleted == False)
            )
        )
    ).scalar() or 0
    
    # Submission stats
    total_submissions = db.query(func.count(Submission.id)).filter(
        Submission.project_id.in_(
            db.query(Project.id).filter(Project.org_id == org_id)
        )
    ).scalar() or 0
    
    pending_submissions = db.query(func.count(Submission.id)).filter(
        and_(
            Submission.project_id.in_(
                db.query(Project.id).filter(Project.org_id == org_id)
            ),
            Submission.status.in_(['draft', 'submitted', 'analyzing'])
        )
    ).scalar() or 0
    
    analyzed_submissions = db.query(func.count(Submission.id)).filter(
        and_(
            Submission.project_id.in_(
                db.query(Project.id).filter(Project.org_id == org_id)
            ),
            Submission.status.in_(['reviewed', 'approved'])
        )
    ).scalar() or 0
    
    # Finding stats - get from findings table
    project_ids = [p.id for p in db.query(Project.id).filter(Project.org_id == org_id).all()]
    
    if project_ids:
        submission_ids = [s.id for s in db.query(Submission.id).filter(
            Submission.project_id.in_(project_ids)
        ).all()]
        
        if submission_ids:
            # Get analysis run IDs for these submissions
            analysis_run_ids = [ar.id for ar in db.query(AnalysisRun.id).filter(
                AnalysisRun.submission_id.in_(submission_ids)
            ).all()]
            
            if analysis_run_ids:
                total_findings = db.query(func.count(Finding.id)).filter(
                    Finding.analysis_run_id.in_(analysis_run_ids)
                ).scalar() or 0
                
                critical_findings = db.query(func.count(Finding.id)).filter(
                    and_(
                        Finding.analysis_run_id.in_(analysis_run_ids),
                        Finding.severity == 'critical'
                    )
                ).scalar() or 0
                
                high_findings = db.query(func.count(Finding.id)).filter(
                    and_(
                        Finding.analysis_run_id.in_(analysis_run_ids),
                        Finding.severity == 'high'
                    )
                ).scalar() or 0
                
                # 'warning' is grouped with 'medium' as they represent similar urgency
                medium_findings = db.query(func.count(Finding.id)).filter(
                    and_(
                        Finding.analysis_run_id.in_(analysis_run_ids),
                        Finding.severity.in_(['medium', 'warning'])
                    )
                ).scalar() or 0
                
                # 'info' is grouped with 'low' as informational findings
                low_findings = db.query(func.count(Finding.id)).filter(
                    and_(
                        Finding.analysis_run_id.in_(analysis_run_ids),
                        Finding.severity.in_(['low', 'info'])
                    )
                ).scalar() or 0
                
                accepted_findings = db.query(func.count(Finding.id)).filter(
                    and_(
                        Finding.analysis_run_id.in_(analysis_run_ids),
                        Finding.status == 'accepted'
                    )
                ).scalar() or 0
            else:
                total_findings = critical_findings = high_findings = medium_findings = low_findings = accepted_findings = 0
        else:
            total_findings = critical_findings = high_findings = medium_findings = low_findings = accepted_findings = 0
    else:
        total_findings = critical_findings = high_findings = medium_findings = low_findings = accepted_findings = 0
    
    # Usage stats
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    submissions_this_month = db.query(func.count(Submission.id)).filter(
        and_(
            Submission.project_id.in_(
                db.query(Project.id).filter(Project.org_id == org_id)
            ),
            Submission.created_at >= first_of_month
        )
    ).scalar() or 0
    
    analyses_today = db.query(func.count(AnalysisRun.id)).filter(
        and_(
            AnalysisRun.submission_id.in_(
                db.query(Submission.id).filter(
                    Submission.project_id.in_(
                        db.query(Project.id).filter(Project.org_id == org_id)
                    )
                )
            ),
            AnalysisRun.created_at >= today
        )
    ).scalar() or 0
    
    # Calculate storage (sum of file sizes for this org)
    storage_bytes = db.query(func.sum(File.size_bytes)).filter(
        File.submission_id.in_(
            db.query(Submission.id).filter(
                Submission.project_id.in_(
                    db.query(Project.id).filter(Project.org_id == org_id)
                )
            )
        )
    ).scalar() or 0
    
    storage_mb = storage_bytes / (1024 * 1024) if storage_bytes else 0
    
    return DashboardStatsResponse(
        projects=ProjectStats(
            total=total_projects,
            active=active_projects
        ),
        submissions=SubmissionStats(
            total=total_submissions,
            pending=pending_submissions,
            analyzed=analyzed_submissions
        ),
        findings=FindingStats(
            total=total_findings,
            critical=critical_findings,
            high=high_findings,
            medium=medium_findings,
            low=low_findings,
            accepted=accepted_findings
        ),
        usage=UsageStats(
            submissions_this_month=submissions_this_month,
            analyses_today=analyses_today,
            storage_mb=round(storage_mb, 2)
        )
    )


@router.get("/activity", response_model=RecentActivityResponse)
async def get_recent_activity(
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recent activity for dashboard"""
    # Get user's organization
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of any organization"
        )
    
    org_id = org_member.org_id
    activities = []
    
    # Get recent submissions
    recent_submissions = db.query(Submission, Project).join(
        Project, Submission.project_id == Project.id
    ).filter(
        Project.org_id == org_id
    ).order_by(desc(Submission.created_at)).limit(limit).all()
    
    for submission, project in recent_submissions:
        # Check actual AnalysisRun records — more reliable than submission.status alone
        # (handles cases where status wasn't updated but analysis ran, e.g. seeded data)
        latest_run = db.query(AnalysisRun).filter(
            AnalysisRun.submission_id == submission.id
        ).order_by(desc(AnalysisRun.created_at)).first()

        if latest_run and latest_run.status == 'completed':
            activity_type = 'analysis_completed'
            title = 'Analysis completed'
            activity_status = 'success'
            finding_count = db.query(func.count(Finding.id)).filter(
                Finding.analysis_run_id == latest_run.id
            ).scalar() or 0
            description = f'{project.name} - {submission.name or "Submission"} analyzed with {finding_count} findings'
        elif latest_run and latest_run.status == 'running':
            activity_type = 'analysis_in_progress'
            title = 'Analysis in progress'
            activity_status = 'warning'
            description = f'{project.name} - {submission.name or "Submission"} is being analyzed'
        elif latest_run and latest_run.status == 'failed':
            activity_type = 'analysis_failed'
            title = 'Analysis failed'
            activity_status = 'error'
            description = f'{project.name} - {submission.name or "Submission"} analysis failed'
        elif submission.status == 'rejected':
            activity_type = 'analysis_failed'
            title = 'Submission rejected'
            activity_status = 'error'
            description = f'{project.name} - {submission.name or "Submission"} was rejected'
        elif submission.status == 'analyzing':
            activity_type = 'analysis_in_progress'
            title = 'Analysis in progress'
            activity_status = 'warning'
            description = f'{project.name} - {submission.name or "Submission"} is being analyzed'
        else:  # draft, submitted — no analysis run yet
            activity_type = 'submission_created'
            title = 'New submission uploaded'
            activity_status = 'info'
            file_count = db.query(func.count(File.id)).filter(
                File.submission_id == submission.id
            ).scalar() or 0
            description = f'{project.name} - {submission.name or "Submission"} with {file_count} files'
        
        activities.append(ActivityItem(
            id=str(submission.id),
            type=activity_type,
            title=title,
            description=description,
            timestamp=submission.created_at,
            link=f'/submissions/{submission.id}',
            status=activity_status
        ))
    
    # Sort by timestamp
    activities.sort(key=lambda x: x.timestamp, reverse=True)
    
    return RecentActivityResponse(activities=activities[:limit])


# ─────────────────────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────────────────────

class ServiceHealth(BaseModel):
    name: str
    status: str  # "healthy" | "degraded" | "unavailable"
    latency_ms: Optional[float] = None
    message: Optional[str] = None


class HealthResponse(BaseModel):
    services: List[ServiceHealth]
    overall: str  # "healthy" | "degraded" | "unavailable"


@router.get("/health", response_model=HealthResponse)
async def get_dashboard_health(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the health status of each system service."""
    services: List[ServiceHealth] = []

    # 1. API (always reachable since we are responding)
    services.append(ServiceHealth(name="API Service", status="healthy", latency_ms=0.0))

    # 2. Database
    try:
        t0 = _time.monotonic()
        db.execute(text("SELECT 1"))
        latency = round((_time.monotonic() - t0) * 1000, 1)
        services.append(ServiceHealth(name="Database", status="healthy", latency_ms=latency))
    except Exception as exc:
        services.append(ServiceHealth(name="Database", status="unavailable", message=str(exc)[:120]))

    # 3. AI Analysis service
    try:
        t0 = _time.monotonic()
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.AI_SERVICE_BASE_URL}/health")
        latency = round((_time.monotonic() - t0) * 1000, 1)
        svc_status = "healthy" if resp.status_code == 200 else "degraded"
        msg = None if resp.status_code == 200 else f"HTTP {resp.status_code}"
        services.append(ServiceHealth(name="AI Analysis", status=svc_status, latency_ms=latency, message=msg))
    except httpx.TimeoutException:
        services.append(ServiceHealth(name="AI Analysis", status="degraded", message="Timeout"))
    except Exception as exc:
        services.append(ServiceHealth(name="AI Analysis", status="unavailable", message=str(exc)[:120]))

    # 4. File Storage — S3-compatible check (works with MinIO and Cloudflare R2)
    try:
        import asyncio
        from app.services.storage import StorageService
        t0 = _time.monotonic()
        storage = await asyncio.get_event_loop().run_in_executor(None, StorageService)
        exists = await asyncio.get_event_loop().run_in_executor(
            None, storage.client.bucket_exists, storage.bucket_name
        )
        latency = round((_time.monotonic() - t0) * 1000, 1)
        svc_status = "healthy" if exists else "degraded"
        msg = None if exists else "Bucket not found"
        services.append(ServiceHealth(name="File Storage", status=svc_status, latency_ms=latency, message=msg))
    except Exception as exc:
        services.append(ServiceHealth(name="File Storage", status="unavailable", message=str(exc)[:120]))

    if any(s.status == "unavailable" for s in services):
        overall = "unavailable"
    elif any(s.status == "degraded" for s in services):
        overall = "degraded"
    else:
        overall = "healthy"

    return HealthResponse(services=services, overall=overall)


# ─────────────────────────────────────────────────────────────
# Trends (week-over-week)
# ─────────────────────────────────────────────────────────────

class TrendValue(BaseModel):
    current: int
    previous: int
    change_pct: Optional[float] = None


class TrendsResponse(BaseModel):
    days: int
    submissions: TrendValue
    findings: TrendValue
    active_projects: TrendValue


def _change_pct(current: int, previous: int) -> Optional[float]:
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 1)


@router.get("/trends", response_model=TrendsResponse)
async def get_dashboard_trends(
    days: int = Query(default=7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return period-over-period trends for key metrics."""
    org_member = db.query(OrgMember).filter(OrgMember.user_id == current_user.id).first()
    if not org_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a member of any organization")
    org_id = org_member.org_id

    now = datetime.utcnow()
    period_start = now - timedelta(days=days)
    prev_start = period_start - timedelta(days=days)

    project_ids_q = db.query(Project.id).filter(Project.org_id == org_id)

    # Submissions
    sub_current = db.query(func.count(Submission.id)).filter(
        Submission.project_id.in_(project_ids_q),
        Submission.created_at >= period_start,
    ).scalar() or 0

    sub_previous = db.query(func.count(Submission.id)).filter(
        Submission.project_id.in_(project_ids_q),
        Submission.created_at >= prev_start,
        Submission.created_at < period_start,
    ).scalar() or 0

    # Findings (via analysis runs in this period)
    submission_ids_current = [
        s.id for s in db.query(Submission.id).filter(
            Submission.project_id.in_(project_ids_q),
            Submission.created_at >= period_start,
        ).all()
    ]
    submission_ids_previous = [
        s.id for s in db.query(Submission.id).filter(
            Submission.project_id.in_(project_ids_q),
            Submission.created_at >= prev_start,
            Submission.created_at < period_start,
        ).all()
    ]

    def _count_findings(submission_ids: list) -> int:
        if not submission_ids:
            return 0
        run_ids = [ar.id for ar in db.query(AnalysisRun.id).filter(
            AnalysisRun.submission_id.in_(submission_ids)
        ).all()]
        if not run_ids:
            return 0
        return db.query(func.count(Finding.id)).filter(
            Finding.analysis_run_id.in_(run_ids)
        ).scalar() or 0

    find_current = _count_findings(submission_ids_current)
    find_previous = _count_findings(submission_ids_previous)

    # Active projects (projects with at least one submission in the period)
    ap_current = db.query(func.count(func.distinct(Submission.project_id))).filter(
        Submission.project_id.in_(project_ids_q),
        Submission.created_at >= period_start,
    ).scalar() or 0

    ap_previous = db.query(func.count(func.distinct(Submission.project_id))).filter(
        Submission.project_id.in_(project_ids_q),
        Submission.created_at >= prev_start,
        Submission.created_at < period_start,
    ).scalar() or 0

    return TrendsResponse(
        days=days,
        submissions=TrendValue(current=sub_current, previous=sub_previous, change_pct=_change_pct(sub_current, sub_previous)),
        findings=TrendValue(current=find_current, previous=find_previous, change_pct=_change_pct(find_current, find_previous)),
        active_projects=TrendValue(current=ap_current, previous=ap_previous, change_pct=_change_pct(ap_current, ap_previous)),
    )


# ─────────────────────────────────────────────────────────────
# Submission trend chart (per-day counts)
# ─────────────────────────────────────────────────────────────

class DayDataPoint(BaseModel):
    date: str  # "YYYY-MM-DD"
    count: int


class SubmissionTrendResponse(BaseModel):
    days: int
    data: List[DayDataPoint]


@router.get("/submission-trend", response_model=SubmissionTrendResponse)
async def get_submission_trend(
    days: int = Query(default=30, ge=7, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return daily submission counts for the last N days."""
    org_member = db.query(OrgMember).filter(OrgMember.user_id == current_user.id).first()
    if not org_member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a member of any organization")
    org_id = org_member.org_id

    since = datetime.utcnow() - timedelta(days=days)
    project_ids_q = db.query(Project.id).filter(Project.org_id == org_id)

    rows = db.query(Submission.created_at).filter(
        Submission.project_id.in_(project_ids_q),
        Submission.created_at >= since,
    ).all()

    # Aggregate in Python — works for both SQLite and PostgreSQL
    counts: dict[str, int] = {}
    for (ts,) in rows:
        day = ts.strftime("%Y-%m-%d")
        counts[day] = counts.get(day, 0) + 1

    # Build a complete list for every day in the range (fill gaps with 0)
    data: List[DayDataPoint] = []
    for i in range(days, 0, -1):
        d = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        data.append(DayDataPoint(date=d, count=counts.get(d, 0)))

    return SubmissionTrendResponse(days=days, data=data)
