"""
Dashboard endpoints - Aggregate statistics and recent activity
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, case
from typing import List
from uuid import UUID
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.core.database import get_db
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
        Project.org_id == org_id
    ).scalar() or 0
    
    # Consider projects with submissions in last 30 days as "active"
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_projects = db.query(func.count(func.distinct(Submission.project_id))).filter(
        and_(
            Submission.created_at >= thirty_days_ago,
            Submission.project_id.in_(
                db.query(Project.id).filter(Project.org_id == org_id)
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
                
                medium_findings = db.query(func.count(Finding.id)).filter(
                    and_(
                        Finding.analysis_run_id.in_(analysis_run_ids),
                        Finding.severity == 'medium'
                    )
                ).scalar() or 0
                
                low_findings = db.query(func.count(Finding.id)).filter(
                    and_(
                        Finding.analysis_run_id.in_(analysis_run_ids),
                        Finding.severity == 'low'
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
        # Determine activity type and status based on submission status
        if submission.status in ['reviewed', 'approved']:
            activity_type = 'analysis_completed'
            title = 'Analysis completed'
            activity_status = 'success'
            
            # Count findings for this submission through analysis runs
            finding_count = db.query(func.count(Finding.id)).join(
                AnalysisRun, Finding.analysis_run_id == AnalysisRun.id
            ).filter(
                AnalysisRun.submission_id == submission.id
            ).scalar() or 0
            
            description = f'{project.name} - {submission.name or "Submission"} analyzed with {finding_count} findings'
        elif submission.status == 'analyzing':
            activity_type = 'analysis_in_progress'
            title = 'Analysis in progress'
            activity_status = 'info'
            description = f'{project.name} - {submission.name or "Submission"} is being analyzed'
        elif submission.status == 'rejected':
            activity_type = 'analysis_failed'
            title = 'Submission rejected'
            activity_status = 'error'
            description = f'{project.name} - {submission.name or "Submission"} was rejected'
        else:  # draft, submitted
            activity_type = 'submission_created'
            title = 'New submission uploaded'
            activity_status = 'info'
            
            # Count files for this submission
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
