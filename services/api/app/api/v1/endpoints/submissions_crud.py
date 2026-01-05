"""
Submissions CRUD endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models import Submission, User, OrgMember, Project
from app.core.security import get_current_user

router = APIRouter()


# Request/Response Models
class SubmissionCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    project_id: UUID  # Required - submissions must belong to a project


class SubmissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class FindingsSummary(BaseModel):
    total: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0


class SubmissionResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: str
    project_id: UUID
    project_name: Optional[str] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    files_count: int = 0
    findings_summary: Optional[FindingsSummary] = None
    profile: Optional[dict] = None
    
    class Config:
        from_attributes = True


# Endpoints
@router.post("", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_submission(
    submission_data: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new submission"""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == submission_data.project_id,
        Project.created_by == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or you don't have access"
        )
    
    # Create submission
    submission = Submission(
        name=submission_data.name,
        description=submission_data.description,
        project_id=submission_data.project_id,
        created_by=current_user.id,
        status="draft"
    )
    
    db.add(submission)
    db.commit()
    db.refresh(submission)
    
    # Get files count
    from app.models import File
    files_count = db.query(func.count(File.id)).filter(
        File.submission_id == submission.id
    ).scalar() or 0
    
    # Get project name
    project_name = project.name
    
    response = SubmissionResponse(
        id=submission.id,
        name=submission.name,
        description=submission.description,
        status=submission.status,
        project_id=submission.project_id,
        project_name=project_name,
        created_by=submission.created_by,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
        files_count=files_count,
        findings_summary=None,  # New submission has no findings yet
        profile=submission.profile
    )
    
    return response


@router.get("", response_model=List[SubmissionResponse])
async def list_submissions(
    project_id: Optional[UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List submissions for the user"""
    # Get user's projects first
    user_projects = db.query(Project).filter(
        Project.created_by == current_user.id
    ).all()
    
    project_ids = [p.id for p in user_projects]
    
    if not project_ids:
        return []
    
    # Build query
    query = db.query(Submission).filter(
        Submission.project_id.in_(project_ids),
        Submission.is_deleted == False
    )
    
    if project_id:
        query = query.filter(Submission.project_id == project_id)
    
    if status:
        query = query.filter(Submission.status == status)
    
    submissions = query.order_by(desc(Submission.created_at)).offset(skip).limit(limit).all()
    
    # Enhance with files count and project names
    from app.models import File, Finding, AnalysisRun, FindingSeverity
    response_list = []
    
    for submission in submissions:
        files_count = db.query(func.count(File.id)).filter(
            File.submission_id == submission.id
        ).scalar() or 0
        
        project_name = None
        if submission.project_id:
            project = db.query(Project).filter(Project.id == submission.project_id).first()
            project_name = project.name if project else None
        
        # Get findings summary
        findings_summary = None
        analysis_runs = db.query(AnalysisRun).filter(
            AnalysisRun.submission_id == submission.id
        ).all()
        
        if analysis_runs:
            run_ids = [run.id for run in analysis_runs]
            total_findings = db.query(func.count(Finding.id)).filter(
                Finding.analysis_run_id.in_(run_ids)
            ).scalar() or 0
            
            critical = db.query(func.count(Finding.id)).filter(
                Finding.analysis_run_id.in_(run_ids),
                Finding.severity == FindingSeverity.CRITICAL
            ).scalar() or 0
            
            high = db.query(func.count(Finding.id)).filter(
                Finding.analysis_run_id.in_(run_ids),
                Finding.severity == FindingSeverity.HIGH
            ).scalar() or 0
            
            medium = db.query(func.count(Finding.id)).filter(
                Finding.analysis_run_id.in_(run_ids),
                Finding.severity == FindingSeverity.MEDIUM
            ).scalar() or 0
            
            low = db.query(func.count(Finding.id)).filter(
                Finding.analysis_run_id.in_(run_ids),
                Finding.severity == FindingSeverity.LOW
            ).scalar() or 0
            
            findings_summary = FindingsSummary(
                total=total_findings,
                critical=critical,
                high=high,
                medium=medium,
                low=low
            )
        
        response_list.append(SubmissionResponse(
            id=submission.id,
            name=submission.name,
            description=submission.description,
            status=submission.status,
            project_id=submission.project_id,
            project_name=project_name,
            created_by=submission.created_by,
            created_at=submission.created_at,
            updated_at=submission.updated_at,
            files_count=files_count,
            findings_summary=findings_summary,
            profile=submission.profile
        ))
    
    return response_list


@router.get("/{submission_id}", response_model=SubmissionResponse)
async def get_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific submission"""
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == False
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Get files count
    from app.models import File, Finding, AnalysisRun, FindingSeverity
    files_count = db.query(func.count(File.id)).filter(
        File.submission_id == submission.id
    ).scalar() or 0
    
    # Get project name
    project_name = None
    if submission.project_id:
        project = db.query(Project).filter(Project.id == submission.project_id).first()
        project_name = project.name if project else None
    
    # Get findings summary
    findings_summary = None
    analysis_runs = db.query(AnalysisRun).filter(
        AnalysisRun.submission_id == submission.id
    ).all()
    
    if analysis_runs:
        run_ids = [run.id for run in analysis_runs]
        total_findings = db.query(func.count(Finding.id)).filter(
            Finding.analysis_run_id.in_(run_ids)
        ).scalar() or 0
        
        critical = db.query(func.count(Finding.id)).filter(
            Finding.analysis_run_id.in_(run_ids),
            Finding.severity == FindingSeverity.CRITICAL
        ).scalar() or 0
        
        high = db.query(func.count(Finding.id)).filter(
            Finding.analysis_run_id.in_(run_ids),
            Finding.severity == FindingSeverity.HIGH
        ).scalar() or 0
        
        medium = db.query(func.count(Finding.id)).filter(
            Finding.analysis_run_id.in_(run_ids),
            Finding.severity == FindingSeverity.MEDIUM
        ).scalar() or 0
        
        low = db.query(func.count(Finding.id)).filter(
            Finding.analysis_run_id.in_(run_ids),
            Finding.severity == FindingSeverity.LOW
        ).scalar() or 0
        
        findings_summary = FindingsSummary(
            total=total_findings,
            critical=critical,
            high=high,
            medium=medium,
            low=low
        )
    
    return SubmissionResponse(
        id=submission.id,
        name=submission.name,
        description=submission.description,
        status=submission.status,
        project_id=submission.project_id,
        project_name=project_name,
        created_by=submission.created_by,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
        files_count=files_count,
        findings_summary=findings_summary,
        profile=submission.profile
    )


@router.put("/{submission_id}", response_model=SubmissionResponse)
async def update_submission(
    submission_id: UUID,
    submission_data: SubmissionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a submission"""
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.created_by == current_user.id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Update fields
    if submission_data.name is not None:
        submission.name = submission_data.name
    if submission_data.description is not None:
        submission.description = submission_data.description
    if submission_data.status is not None:
        submission.status = submission_data.status
    
    db.commit()
    db.refresh(submission)
    
    # Get files count and project name
    from app.models import File
    files_count = db.query(func.count(File.id)).filter(
        File.submission_id == submission.id
    ).scalar() or 0
    
    project_name = None
    if submission.project_id:
        project = db.query(Project).filter(Project.id == submission.project_id).first()
        project_name = project.name if project else None
    
    return SubmissionResponse(
        id=submission.id,
        name=submission.name,
        description=submission.description,
        status=submission.status,
        project_id=submission.project_id,
        project_name=project_name,
        created_by=submission.created_by,
        created_at=submission.created_at,
        updated_at=submission.updated_at,
        files_count=files_count
    )


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_submission(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a submission"""
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.created_by == current_user.id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    db.delete(submission)
    db.commit()
    
    return None
