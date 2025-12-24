from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Finding, FindingFeedback
from app.services.feedback import FeedbackService

router = APIRouter()


# Request/Response Models
class FeedbackCreate(BaseModel):
    finding_id: int
    feedback_type: str = Field(..., description="Type: review, comment, correction, approval")
    comment: str
    is_correct: Optional[bool] = None
    suggested_severity: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: int
    finding_id: int
    user_id: int
    user_name: str
    feedback_type: str
    comment: str
    is_correct: Optional[bool]
    suggested_severity: Optional[str]
    created_at: str

    class Config:
        from_attributes = True


class FindingStatusUpdate(BaseModel):
    status: str = Field(..., description="Status: open, needs_review, verified, resolved, dismissed")
    comment: Optional[str] = None


class FindingAssignment(BaseModel):
    assignee_id: int
    comment: Optional[str] = None


class BulkUpdateRequest(BaseModel):
    finding_ids: List[int] = Field(..., min_items=1)
    status: Optional[str] = None
    assignee_id: Optional[int] = None
    severity: Optional[str] = None


class ReviewStatistics(BaseModel):
    by_status: dict
    by_severity: dict
    by_feedback_type: dict
    total_findings: int
    total_feedback: int
    needs_review_count: int


@router.post("/feedback", response_model=FeedbackResponse)
def submit_feedback(
    feedback: FeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit feedback on a finding.
    
    Feedback types:
    - review: General review feedback
    - comment: Add comment or discussion
    - correction: Suggest correction to finding
    - approval: Approve finding as accurate
    """
    # Verify finding exists and user has access
    finding = db.query(Finding).filter(Finding.id == feedback.finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Check organization access
    from app.models import AnalysisRun, Submission, Project
    analysis_run = db.query(AnalysisRun).filter(
        AnalysisRun.id == finding.analysis_run_id
    ).first()
    if not analysis_run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    
    submission = db.query(Submission).filter(
        Submission.id == analysis_run.submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    project = db.query(Project).filter(Project.id == submission.project_id).first()
    if not project or project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create feedback
    service = FeedbackService(db)
    feedback_obj = service.create_feedback(
        finding_id=feedback.finding_id,
        user_id=current_user.id,
        feedback_type=feedback.feedback_type,
        comment=feedback.comment,
        is_correct=feedback.is_correct,
        suggested_severity=feedback.suggested_severity
    )
    
    # Prepare response
    return FeedbackResponse(
        id=feedback_obj.id,
        finding_id=feedback_obj.finding_id,
        user_id=feedback_obj.user_id,
        user_name=current_user.full_name or current_user.email,
        feedback_type=feedback_obj.feedback_type,
        comment=feedback_obj.comment,
        is_correct=feedback_obj.is_correct,
        suggested_severity=feedback_obj.suggested_severity,
        created_at=feedback_obj.created_at.isoformat()
    )


@router.get("/findings/{finding_id}/feedback", response_model=List[FeedbackResponse])
def get_finding_feedback(
    finding_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all feedback for a specific finding.
    """
    # Verify finding exists and user has access
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Check organization access
    from app.models import AnalysisRun, Submission, Project
    analysis_run = db.query(AnalysisRun).filter(
        AnalysisRun.id == finding.analysis_run_id
    ).first()
    if not analysis_run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    
    submission = db.query(Submission).filter(
        Submission.id == analysis_run.submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    project = db.query(Project).filter(Project.id == submission.project_id).first()
    if not project or project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get feedback
    service = FeedbackService(db)
    feedback_list = service.get_feedback(finding_id)
    
    # Build response
    responses = []
    for fb in feedback_list:
        user = db.query(User).filter(User.id == fb.user_id).first()
        responses.append(FeedbackResponse(
            id=fb.id,
            finding_id=fb.finding_id,
            user_id=fb.user_id,
            user_name=user.full_name or user.email if user else "Unknown",
            feedback_type=fb.feedback_type,
            comment=fb.comment,
            is_correct=fb.is_correct,
            suggested_severity=fb.suggested_severity,
            created_at=fb.created_at.isoformat()
        ))
    
    return responses


@router.get("/feedback/user", response_model=List[FeedbackResponse])
def get_user_feedback(
    limit: int = Query(default=50, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's feedback history.
    """
    service = FeedbackService(db)
    feedback_list = service.get_user_feedback(current_user.id, limit)
    
    responses = []
    for fb in feedback_list:
        responses.append(FeedbackResponse(
            id=fb.id,
            finding_id=fb.finding_id,
            user_id=fb.user_id,
            user_name=current_user.full_name or current_user.email,
            feedback_type=fb.feedback_type,
            comment=fb.comment,
            is_correct=fb.is_correct,
            suggested_severity=fb.suggested_severity,
            created_at=fb.created_at.isoformat()
        ))
    
    return responses


@router.put("/findings/{finding_id}/status")
def update_finding_status(
    finding_id: int,
    update: FindingStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update finding status with audit trail.
    
    Valid statuses: open, needs_review, verified, resolved, dismissed
    """
    # Verify finding exists and user has access
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Check organization access
    from app.models import AnalysisRun, Submission, Project
    analysis_run = db.query(AnalysisRun).filter(
        AnalysisRun.id == finding.analysis_run_id
    ).first()
    if not analysis_run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    
    submission = db.query(Submission).filter(
        Submission.id == analysis_run.submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    project = db.query(Project).filter(Project.id == submission.project_id).first()
    if not project or project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update status
    service = FeedbackService(db)
    updated_finding = service.update_finding_status(
        finding_id=finding_id,
        new_status=update.status,
        user_id=current_user.id,
        comment=update.comment
    )
    
    return {
        "id": updated_finding.id,
        "status": updated_finding.status,
        "message": f"Finding status updated to {update.status}"
    }


@router.post("/findings/{finding_id}/assign")
def assign_finding(
    finding_id: int,
    assignment: FindingAssignment,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Assign finding to a reviewer.
    """
    # Verify finding exists and user has access
    finding = db.query(Finding).filter(Finding.id == finding_id).first()
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    # Check organization access
    from app.models import AnalysisRun, Submission, Project
    analysis_run = db.query(AnalysisRun).filter(
        AnalysisRun.id == finding.analysis_run_id
    ).first()
    if not analysis_run:
        raise HTTPException(status_code=404, detail="Analysis run not found")
    
    submission = db.query(Submission).filter(
        Submission.id == analysis_run.submission_id
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    project = db.query(Project).filter(Project.id == submission.project_id).first()
    if not project or project.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify assignee is in same organization
    assignee = db.query(User).filter(User.id == assignment.assignee_id).first()
    if not assignee or assignee.organization_id != current_user.organization_id:
        raise HTTPException(status_code=400, detail="Invalid assignee")
    
    # Assign finding
    service = FeedbackService(db)
    updated_finding = service.assign_finding(
        finding_id=finding_id,
        assignee_id=assignment.assignee_id,
        assigner_id=current_user.id,
        comment=assignment.comment
    )
    
    return {
        "id": updated_finding.id,
        "assigned_to": assignment.assignee_id,
        "message": f"Finding assigned to {assignee.full_name or assignee.email}"
    }


@router.post("/findings/bulk-update")
def bulk_update_findings(
    update: BulkUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Perform bulk updates on multiple findings.
    
    Can update status, assignee, or severity for multiple findings at once.
    """
    # Verify all findings exist and user has access
    findings = db.query(Finding).filter(Finding.id.in_(update.finding_ids)).all()
    if len(findings) != len(update.finding_ids):
        raise HTTPException(status_code=404, detail="One or more findings not found")
    
    # Check organization access for all findings
    from app.models import AnalysisRun, Submission, Project
    for finding in findings:
        analysis_run = db.query(AnalysisRun).filter(
            AnalysisRun.id == finding.analysis_run_id
        ).first()
        if not analysis_run:
            raise HTTPException(status_code=404, detail="Analysis run not found")
        
        submission = db.query(Submission).filter(
            Submission.id == analysis_run.submission_id
        ).first()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        project = db.query(Project).filter(Project.id == submission.project_id).first()
        if not project or project.organization_id != current_user.organization_id:
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Verify assignee if provided
    if update.assignee_id:
        assignee = db.query(User).filter(User.id == update.assignee_id).first()
        if not assignee or assignee.organization_id != current_user.organization_id:
            raise HTTPException(status_code=400, detail="Invalid assignee")
    
    # Perform bulk update
    service = FeedbackService(db)
    updated_findings = service.bulk_update_findings(
        finding_ids=update.finding_ids,
        user_id=current_user.id,
        status=update.status,
        assignee_id=update.assignee_id,
        severity=update.severity
    )
    
    return {
        "updated_count": len(updated_findings),
        "finding_ids": [f.id for f in updated_findings],
        "message": f"Successfully updated {len(updated_findings)} findings"
    }


@router.get("/feedback/statistics", response_model=ReviewStatistics)
def get_review_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get review statistics for the current organization.
    """
    service = FeedbackService(db)
    stats = service.get_review_statistics(current_user.organization_id)
    
    return ReviewStatistics(
        by_status=stats["by_status"],
        by_severity=stats["by_severity"],
        by_feedback_type=stats["by_feedback_type"],
        total_findings=stats["total_findings"],
        total_feedback=stats["total_feedback"],
        needs_review_count=stats["needs_review_count"]
    )
