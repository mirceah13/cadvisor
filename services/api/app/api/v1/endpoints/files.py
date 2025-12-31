"""
File Management API endpoints
Handles upload, download, and file operations
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
import hashlib

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User
from app.services.file import FileService
from app.services.storage import StorageService
from app.tasks.cad import process_cad_file

router = APIRouter()

# Request/Response Models
class PreSignUploadRequest(BaseModel):
    """Request for pre-signed upload URL"""
    filename: str = Field(..., max_length=255, description="Original filename")
    mime_type: str = Field(..., description="MIME type")
    size: int = Field(..., gt=0, description="File size in bytes")
    submission_id: Optional[UUID] = Field(None, description="Optional submission ID")


class PreSignUploadResponse(BaseModel):
    """Response with pre-signed upload URL"""
    upload_url: str
    storage_key: str
    expires_in: int = Field(default=900, description="URL expiry in seconds")


class CompleteUploadRequest(BaseModel):
    """Request to complete file upload"""
    storage_key: str
    filename: str
    mime_type: str
    size: int
    sha256: Optional[str] = None
    submission_id: Optional[UUID] = None


class FileResponse(BaseModel):
    """File record response"""
    id: UUID
    filename: str
    mime_type: str
    size: int
    storage_key: str
    sha256: Optional[str]
    uploaded_by: UUID
    submission_id: Optional[UUID]
    status: str
    created_at: str
    
    class Config:
        from_attributes = True


class DownloadUrlResponse(BaseModel):
    """Download URL response"""
    download_url: str
    expires_in: int = 900


@router.post("/presign-upload", response_model=PreSignUploadResponse)
def presign_upload(
    request: PreSignUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate a pre-signed URL for direct upload to MinIO
    
    - Validates file type and size
    - Returns URL valid for 15 minutes
    - Files are isolated by organization
    """
    # Get user's organization
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    # Generate upload URL
    file_service = FileService(db)
    upload_url, storage_key, error = file_service.generate_upload_url(
        org_id=org_id,
        filename=request.filename,
        mime_type=request.mime_type,
        size=request.size
    )
    
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )
    
    return PreSignUploadResponse(
        upload_url=upload_url,
        storage_key=storage_key,
        expires_in=900
    )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    submission_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Direct file upload via API (proxy to MinIO)
    
    - Upload file through API instead of presigned URL
    - Avoids CORS and signature issues
    - Returns file record after upload
    """
    # Get user's organization
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Calculate SHA256
    sha256_hash = hashlib.sha256(content).hexdigest()
    
    # Upload to MinIO
    storage_service = StorageService()
    # Add timestamp to make storage_key unique
    import time
    timestamp = int(time.time() * 1000)
    storage_key = f"orgs/{org_id}/uploads/{timestamp}_{file.filename}"
    
    try:
        from io import BytesIO
        storage_service.client.put_object(
            storage_service.bucket_name,
            storage_key,
            data=BytesIO(content),
            length=file_size,
            content_type=file.content_type or "application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}"
        )
    
    # Create file record
    file_service = FileService(db)
    submission_uuid = UUID(submission_id) if submission_id else None
    
    file_record = file_service.create_file_record(
        org_id=org_id,
        submission_id=submission_uuid,
        filename=file.filename,
        mime_type=file.content_type or "application/octet-stream",
        size=file_size,
        storage_key=storage_key,
        uploaded_by=current_user.id,
        sha256=sha256_hash
    )
    
    # Trigger background processing for CAD files
    if _is_cad_file(file.content_type, file.filename):
        try:
            process_cad_file.delay(str(file_record.id))
        except Exception as e:
            # Log but don't fail the upload
            print(f"Failed to queue CAD processing: {e}")
    
    return FileResponse(
        id=file_record.id,
        filename=file_record.filename,
        mime_type=file_record.mime_type,
        size=file_record.size_bytes,
        storage_key=file_record.storage_key,
        sha256=file_record.sha256,
        uploaded_by=file_record.uploaded_by,
        submission_id=file_record.submission_id,
        created_at=str(file_record.created_at),
        status=file_record.scan_status or "pending"
    )

@router.post("/complete-upload", response_model=FileResponse)
def complete_upload(
    request: CompleteUploadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Complete file upload and create database record
    
    - Called after client successfully uploads to pre-signed URL
    - Creates file record in database
    - Triggers background scan and processing
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    # Create file record
    file_service = FileService(db)
    file_record = file_service.create_file_record(
        org_id=org_id,
        submission_id=request.submission_id,
        filename=request.filename,
        mime_type=request.mime_type,
        size=request.size,
        storage_key=request.storage_key,
        uploaded_by=current_user.id,
        sha256=request.sha256
    )
    
    # Trigger background processing for CAD files
    if _is_cad_file(request.mime_type, request.filename):
        try:
            task = process_cad_file.delay(str(file_record.id))
            # Store task ID in parsed_metadata for tracking
            file_record.parsed_metadata = file_record.parsed_metadata or {}
            file_record.parsed_metadata["processing_task_id"] = task.id
            db.commit()
        except Exception as e:
            # Log error but don't fail upload
            print(f"Failed to queue CAD processing task: {e}")
    
    return FileResponse(
        id=file_record.id,
        filename=file_record.filename,
        mime_type=file_record.mime_type,
        size=file_record.size,
        sha256=file_record.sha256,
        scan_status=file_record.scan_status,
        uploaded_by=file_record.uploaded_by,
        created_at=file_record.created_at.isoformat()
    )


@router.get("/{file_id}/download", response_model=DownloadUrlResponse)
def get_download_url(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get pre-signed download URL for a file
    
    - Enforces organization-level access control
    - Returns URL valid for 15 minutes
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    # Generate download URL
    file_service = FileService(db)
    download_url = file_service.generate_download_url(
        file_id=file_id,
        org_id=org_id
    )
    
    if not download_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied"
        )
    
    return DownloadUrlResponse(
        download_url=download_url,
        expires_in=900
    )


@router.get("/", response_model=List[FileResponse])
def list_files(
    submission_id: Optional[UUID] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List files for the user's organization
    
    - Optionally filter by submission
    - Returns paginated results
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    file_service = FileService(db)
    files = file_service.list_files(
        org_id=org_id,
        submission_id=submission_id,
        limit=min(limit, 100),
        offset=offset
    )
    
    return [
        FileResponse(
            id=f.id,
            filename=f.filename,
            mime_type=f.mime_type,
            size=f.size_bytes,
            storage_key=f.storage_key,
            sha256=f.sha256,
            scan_status=f.scan_status,
            uploaded_by=f.uploaded_by,
            submission_id=f.submission_id,
            status=f.scan_status or "pending",
            created_at=f.created_at.isoformat()
        )
        for f in files
    ]


@router.delete("/{file_id}")
def delete_file(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a file (soft delete)
    
    - File is marked as deleted but not immediately removed from storage
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    file_service = FileService(db)
    success = file_service.delete_file(
        file_id=file_id,
        org_id=org_id,
        user_id=current_user.id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or already deleted"
        )
    
    return {"message": "File deleted successfully"}


def _is_cad_file(mime_type: str, filename: str) -> bool:
    """Check if file is a CAD file that needs processing"""
    cad_extensions = ['.ifc', '.dxf', '.dwg']
    cad_mime_types = ['ifc', 'dxf', 'dwg']
    
    filename_lower = filename.lower()
    mime_lower = mime_type.lower()
    
    return (
        any(filename_lower.endswith(ext) for ext in cad_extensions) or
        any(mime in mime_lower for mime in cad_mime_types)
    )
