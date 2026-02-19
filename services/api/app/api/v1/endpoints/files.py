"""
File Management API endpoints
Handles upload, download, and file operations
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
import hashlib
from datetime import datetime, timedelta, timezone

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, File as FileModel
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
    file_metadata: Optional[dict] = Field(None, description="Parsed CAD/BIM metadata")
    
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
        status=file_record.scan_status or "pending",
        file_metadata=file_record.parsed_metadata
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
        size=file_record.size_bytes,
        storage_key=file_record.storage_key,
        sha256=file_record.sha256,
        uploaded_by=file_record.uploaded_by,
        submission_id=file_record.submission_id,
        status=file_record.scan_status or "pending",
        created_at=file_record.created_at.isoformat(),
        file_metadata=file_record.parsed_metadata
    )


@router.get("/{file_id}/download")
def download_file(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream a file directly from MinIO through the API.

    Avoids presigned URLs which require the Host header to match the
    endpoint used for signing — a problem in Docker where the internal
    hostname (minio:9000) differs from the external one (localhost:9002).
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )

    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id

    file_service = FileService(db)
    storage = StorageService()

    file_record = file_service.get_file(file_id=file_id, org_id=org_id)
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied"
        )

    try:
        response = storage.get_object_stream(file_record.storage_key)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage error: {e}"
        )

    def iter_chunks():
        try:
            for chunk in response.stream(amt=65536):
                yield chunk
        finally:
            response.close()
            response.release_conn()

    mime = file_record.mime_type or "application/octet-stream"
    # Use RFC 5987 encoding for filenames with non-ASCII / special characters
    import urllib.parse
    encoded_name = urllib.parse.quote(file_record.filename)
    return StreamingResponse(
        iter_chunks(),
        media_type=mime,
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_name}",
            "Content-Length": str(file_record.size_bytes),
        },
    )


@router.get("/{file_id}/aps-raw-download")
def download_aps_raw_data(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download complete unfiltered APS API responses as JSON file
    
    - Returns raw APS metadata without truncation
    - Enforces organization-level access control
    - Downloads as file to avoid browser performance issues
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    # Get file service and fetch file
    file_service = FileService(db)
    file_record = file_service.get_file(file_id=file_id, org_id=org_id)
    
    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found or access denied"
        )
    
    # Extract APS raw responses from metadata
    metadata = file_record.parsed_metadata or {}
    aps_raw_responses = metadata.get("aps_raw_responses")
    
    if not aps_raw_responses or not aps_raw_responses.get("available"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="APS raw responses not available for this file"
        )
    
    # Return as downloadable JSON file
    filename = f"{file_record.filename}_aps_raw.json"
    return JSONResponse(
        content=aps_raw_responses,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "application/json"
        }
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
            status=(f.parsed_metadata or {}).get("processing_status", "pending"),  # Use processing status, not scan status
            created_at=f.created_at.isoformat(),
            file_metadata=f.parsed_metadata
        )
        for f in files
    ]

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a file
    
    - Soft deletes the file
    - Removes it from submission
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    # Get file and verify access
    file_service = FileService(db)
    file = db.query(FileModel).filter(
        FileModel.id == file_id,
        FileModel.org_id == org_id,
        FileModel.is_deleted == False
    ).first()
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Soft delete
    from datetime import datetime, timezone
    file.is_deleted = True
    file.deleted_at = datetime.now(timezone.utc)
    db.commit()
    
    return None

@router.post("/{file_id}/retry")
def retry_file_processing(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retry processing for a stuck or failed file
    
    - Resets file status to pending and queues processing task
    - Useful for files stuck in 'processing' state due to worker crashes
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_membership = current_user.org_memberships[0]
    org_id = org_membership.org_id
    
    file_service = FileService(db)
    file = file_service.get_file(file_id=file_id, org_id=org_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Check if it's a CAD file
    if not _is_cad_file(file.mime_type, file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CAD files can be reprocessed"
        )
    
    # Reset file metadata to pending status
    file.file_metadata = file.file_metadata or {}
    file.file_metadata["processing_status"] = "pending"
    file.file_metadata["retry_requested_at"] = datetime.now(timezone.utc).isoformat()
    file.file_metadata.pop("processing_started_at", None)
    file.file_metadata.pop("processing_completed_at", None)
    file.file_metadata.pop("error", None)
    
    db.commit()
    
    # Queue processing task
    task = process_cad_file.delay(str(file_id))
    
    return {
        "message": "File processing queued",
        "file_id": str(file_id),
        "task_id": task.id,
        "status": "pending"
    }


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
