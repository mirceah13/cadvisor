"""
Submission API endpoints
Handles submission profile and analysis operations
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Submission
from app.tasks.cad import generate_submission_profile, reprocess_all_files

router = APIRouter()


# Response Models
class SubmissionProfileResponse(BaseModel):
    """Submission profile response"""
    submission_id: UUID
    submission_name: str
    profile: Dict[str, Any]
    status: str
    generated_at: Optional[str] = None


class RegenerateProfileResponse(BaseModel):
    """Response for profile regeneration"""
    message: str
    submission_id: UUID
    files_queued: int
    task_ids: list


@router.get("/{submission_id}/profile", response_model=SubmissionProfileResponse)
def get_submission_profile(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get submission profile with extracted metadata
    
    - Returns comprehensive profile generated from all CAD files
    - Includes building info, systems, elements, documents, completeness
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    # Get submission and verify access
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.org_id == org_id
    ).first()
    
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found"
        )
    
    # Get profile from metadata
    metadata = submission.metadata or {}
    profile = metadata.get("profile")
    
    if not profile:
        # Generate profile if not exists
        try:
            task = generate_submission_profile.delay(str(submission_id))
            
            return SubmissionProfileResponse(
                submission_id=submission_id,
                submission_name=submission.name,
                profile={},
                status="generating",
                generated_at=None
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate profile: {str(e)}"
            )
    
    return SubmissionProfileResponse(
        submission_id=submission_id,
        submission_name=submission.name,
        profile=profile,
        status=metadata.get("profile_status", "unknown"),
        generated_at=metadata.get("profile_generated_at")
    )


@router.post("/{submission_id}/regenerate-profile", response_model=RegenerateProfileResponse)
def regenerate_submission_profile(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerate submission profile by reprocessing all CAD files
    
    - Queues background tasks to reparse all CAD files
    - Useful after uploading additional files or fixing parsing issues
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
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
    
    # Queue reprocessing
    try:
        result = reprocess_all_files(str(submission_id))
        
        if not result.get("success"):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to queue reprocessing")
            )
        
        return RegenerateProfileResponse(
            message="Profile regeneration queued successfully",
            submission_id=submission_id,
            files_queued=result.get("files_queued", 0),
            task_ids=result.get("task_ids", [])
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate profile: {str(e)}"
        )


@router.get("/{submission_id}/processing-status")
def get_processing_status(
    submission_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get processing status for all files in submission
    
    - Shows which files have been parsed
    - Returns any processing errors
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
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
    
    # Get file processing status
    from app.models import File
    files = db.query(File).filter(
        File.submission_id == submission_id,
        File.deleted_at.is_(None)
    ).all()
    
    file_statuses = []
    for file in files:
        # Processing status is stored in parsed_metadata
        parsed_metadata = file.parsed_metadata or {}
        file_statuses.append({
            "file_id": str(file.id),
            "filename": file.filename,
            "mime_type": file.mime_type,
            "processing_status": parsed_metadata.get("processing_status", "pending"),
            "processing_started_at": parsed_metadata.get("processing_started_at"),
            "processing_completed_at": parsed_metadata.get("processing_completed_at"),
            "task_id": parsed_metadata.get("processing_task_id"),
            "error": parsed_metadata.get("processing_error"),
        })
    
    # Overall submission status
    total = len(files)
    completed = sum(1 for f in file_statuses if f["processing_status"] == "completed")
    failed = sum(1 for f in file_statuses if f["processing_status"] == "failed")
    processing = sum(1 for f in file_statuses if f["processing_status"] == "processing")
    
    return {
        "submission_id": str(submission_id),
        "overall_status": {
            "total_files": total,
            "completed": completed,
            "failed": failed,
            "processing": processing,
            "pending": total - completed - failed - processing
        },
        "files": file_statuses
    }
