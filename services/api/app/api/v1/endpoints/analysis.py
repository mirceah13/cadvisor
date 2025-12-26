"""
Analysis API Endpoints
Handles compliance analysis and findings
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Submission, AnalysisRun, Finding
from app.services.analysis import AnalysisEngine
from app.tasks.analysis import run_compliance_analysis, reanalyze_submission

router = APIRouter()


# Request/Response Models
class StartAnalysisRequest(BaseModel):
    """Request to start analysis"""
    submission_id: UUID
    check_types: Optional[List[str]] = None
    ruleset_ids: Optional[List[UUID]] = None


class StartAnalysisResponse(BaseModel):
    """Response with task info"""
    message: str
    submission_id: UUID
    task_id: str


class AnalysisRunResponse(BaseModel):
    """Analysis run response"""
    id: UUID
    submission_id: UUID
    status: str
    findings_count: Optional[int] = None
    checks_completed: List[str] = []
    error_message: Optional[str] = None
    created_at: str
    
    class Config:
        from_attributes = True


class FindingResponse(BaseModel):
    """Finding response"""
    id: UUID
    severity: str
    category: str
    title: str
    description: str
    location: Optional[str]
    recommendation: Optional[str]
    status: str
    metadata: Optional[Dict[str, Any]] = {}
    created_at: str
    
    class Config:
        from_attributes = True


class FindingSummaryResponse(BaseModel):
    """Summary of findings"""
    total: int
    by_severity: Dict[str, int]
    by_category: Dict[str, int]
    by_status: Dict[str, int]


class UpdateFindingRequest(BaseModel):
    """Request to update finding"""
    status: Optional[str] = None
    recommendation: Optional[str] = None
    assignee_id: Optional[UUID] = None


# Endpoints
@router.post("/start", response_model=StartAnalysisResponse)
def start_analysis(
    request: StartAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start compliance analysis on submission
    
    - Triggers background analysis task
    - Returns task ID for tracking
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Verify submission access through project
    from app.models import Project
    submission = db.query(Submission).join(Project).filter(
        Submission.id == request.submission_id,
        Project.org_id == org_id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Queue analysis task
    try:
        task = run_compliance_analysis.delay(
            str(request.submission_id),
            ruleset_ids=[str(r) for r in request.ruleset_ids] if request.ruleset_ids else None,
            check_types=request.check_types
        )
        
        return StartAnalysisResponse(
            message="Analysis started successfully",
            submission_id=request.submission_id,
            task_id=task.id
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start analysis: {str(e)}"
        )


@router.get("/submissions/{submission_id}/runs", response_model=List[AnalysisRunResponse])
def get_analysis_runs(
    submission_id: UUID,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get analysis runs for a submission
    
    - Returns list of analysis runs with status
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Verify submission access through project
    from app.models import Project
    submission = db.query(Submission).join(Project).filter(
        Submission.id == submission_id,
        Project.org_id == org_id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Get analysis runs
    engine = AnalysisEngine(db)
    runs = engine.get_analysis_runs(submission_id, limit)
    
    return [
        AnalysisRunResponse(
            id=run.id,
            submission_id=run.submission_id,
            status=run.status,
            findings_count=run.total_findings,
            checks_completed=run.config.get("checks_completed", []) if run.config else [],
            error_message=run.error_message,
            created_at=run.created_at.isoformat()
        )
        for run in runs
    ]


@router.get("/runs/{run_id}", response_model=AnalysisRunResponse)
def get_analysis_run_detail(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific analysis run
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Verify access through submission -> project
    from app.models import Project
    analysis_run = db.query(AnalysisRun).join(
        Submission,
        AnalysisRun.submission_id == Submission.id
    ).join(
        Project,
        Submission.project_id == Project.id
    ).filter(
        AnalysisRun.id == run_id,
        Project.org_id == org_id
    ).first()
    
    if not analysis_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis run not found"
        )
    
    return AnalysisRunResponse(
        id=analysis_run.id,
        submission_id=analysis_run.submission_id,
        status=analysis_run.status,
        findings_count=analysis_run.total_findings,
        checks_completed=analysis_run.config.get("checks_completed", []) if analysis_run.config else [],
        error_message=analysis_run.error_message,
        created_at=analysis_run.created_at.isoformat()
    )


@router.get("/submissions/{submission_id}/findings", response_model=List[FindingResponse])
def get_findings(
    submission_id: UUID,
    analysis_run_id: Optional[UUID] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get findings for a submission
    
    - Filter by analysis run, severity, or status
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Verify submission access through project
    from app.models import Project
    submission = db.query(Submission).join(Project).filter(
        Submission.id == submission_id,
        Project.org_id == org_id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Get findings
    engine = AnalysisEngine(db)
    findings = engine.get_findings(
        submission_id=submission_id,
        analysis_run_id=analysis_run_id,
        severity=severity,
        status=status
    )
    
    return [
        FindingResponse(
            id=f.id,
            severity=f.severity,
            category=f.category,
            title=f.evidence.get('title', '') if f.evidence else '',
            description=f.evidence.get('description', f.statement) if f.evidence else f.statement,
            location=f.evidence.get('location') if f.evidence else None,
            recommendation=f.evidence.get('recommendation') if f.evidence else None,
            status=f.status,
            metadata=f.evidence if f.evidence else {},
            created_at=f.created_at.isoformat()
        )
        for f in findings
    ]


@router.get("/submissions/{submission_id}/findings/summary", response_model=FindingSummaryResponse)
def get_findings_summary(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get summary statistics of findings
    
    - Total count and breakdown by severity/category/status
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Verify submission access
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.org_id == org_id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Get all findings
    engine = AnalysisEngine(db)
    findings = engine.get_findings(submission_id)
    
    # Calculate stats
    by_severity = {}
    by_category = {}
    by_status = {}
    
    for f in findings:
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
        by_category[f.category] = by_category.get(f.category, 0) + 1
        by_status[f.status] = by_status.get(f.status, 0) + 1
    
    return FindingSummaryResponse(
        total=len(findings),
        by_severity=by_severity,
        by_category=by_category,
        by_status=by_status
    )


@router.patch("/findings/{finding_id}", response_model=FindingResponse)
def update_finding(
    finding_id: UUID,
    request: UpdateFindingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a finding
    
    - Change status, add recommendation, assign reviewer
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Get finding with submission access check
    finding = db.query(Finding).join(
        Submission, Finding.submission_id == Submission.id
    ).filter(
        Finding.id == finding_id,
        Submission.org_id == org_id
    ).first()
    
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Finding not found"
        )
    
    # Update fields
    if request.status:
        finding.status = request.status
    
    if request.recommendation:
        finding.recommendation = request.recommendation
    
    if request.assignee_id:
        finding.assignee_id = request.assignee_id
    
    db.commit()
    db.refresh(finding)
    
    return FindingResponse(
        id=finding.id,
        severity=finding.severity,
        category=finding.category,
        title=finding.title,
        description=finding.description,
        location=finding.location,
        recommendation=finding.recommendation,
        status=finding.status,
        metadata=finding.metadata,
        created_at=finding.created_at.isoformat()
    )


@router.post("/submissions/{submission_id}/reanalyze")
def trigger_reanalysis(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger reanalysis of submission
    
    - Useful after updating knowledge base or fixing issues
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Verify submission access
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.org_id == org_id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Queue reanalysis
    try:
        result = reanalyze_submission(str(submission_id))
        
        return {
            "message": "Reanalysis queued successfully",
            "submission_id": str(submission_id),
            "task_id": result.get("task_id")
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue reanalysis: {str(e)}"
        )


@router.delete("/runs/{run_id}")
def delete_analysis_run(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an analysis run and its findings
    
    - Only accessible by org members
    - Deletes all associated findings
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Verify access through submission -> project
    from app.models import Project
    analysis_run = db.query(AnalysisRun).join(
        Submission,
        AnalysisRun.submission_id == Submission.id
    ).join(
        Project,
        Submission.project_id == Project.id
    ).filter(
        AnalysisRun.id == run_id,
        Project.org_id == org_id
    ).first()
    
    if not analysis_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis run not found"
        )
    
    # Delete findings first (cascade should handle this, but being explicit)
    db.query(Finding).filter(Finding.analysis_run_id == run_id).delete()
    
    # Delete the analysis run
    db.delete(analysis_run)
    db.commit()
    
    return {"message": "Analysis run deleted successfully", "id": str(run_id)}
