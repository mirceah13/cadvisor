"""
File Service - Business logic for file operations
Handles file records, validation, access control, and lifecycle
"""

import logging
import mimetypes
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from sqlalchemy.orm import Session
from app.models import File, User, Organization
from app.services.storage import StorageService

logger = logging.getLogger(__name__)


# File size limits (in bytes)
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB default
ALLOWED_MIME_TYPES = {
    # CAD/BIM
    "application/x-step",  # STEP
    "model/iges",  # IGES
    "image/vnd.dxf",  # DXF
    "application/x-dxf",
    "application/acad",  # DWG
    "application/x-acad",  # DWG
    "application/dwg",  # DWG
    "image/vnd.dwg",  # DWG
    "model/ifc",  # IFC
    "application/x-ifc",
    # Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # DOCX
    "application/msword",  # DOC
    "text/plain",
    "text/markdown",
    # Images
    "image/png",
    "image/jpeg",
    "image/jpg",
    # Archives (for batch uploads)
    "application/zip",
    "application/x-7z-compressed",
}


class FileService:
    """Service for managing file records and operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.storage = StorageService()
    
    def validate_file(
        self,
        filename: str,
        size: int,
        mime_type: str,
        max_size: Optional[int] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Validate file before upload
        
        Args:
            filename: Original filename
            size: File size in bytes
            mime_type: MIME type
            max_size: Optional custom max size (from subscription limits)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check size
        limit = max_size or MAX_FILE_SIZE
        if size > limit:
            return False, f"File size {size} bytes exceeds limit of {limit} bytes"
        
        # Check MIME type
        if mime_type not in ALLOWED_MIME_TYPES:
            return False, f"File type {mime_type} is not allowed"
        
        # Check filename
        if not filename or len(filename) > 255:
            return False, "Invalid filename"
        
        return True, None
    
    def create_file_record(
        self,
        org_id: UUID,
        submission_id: Optional[UUID],
        filename: str,
        mime_type: str,
        size: int,
        storage_key: str,
        uploaded_by: UUID,
        sha256: Optional[str] = None
    ) -> File:
        """
        Create a database record for an uploaded file
        
        Args:
            org_id: Organization ID
            submission_id: Optional submission ID
            filename: Original filename
            mime_type: MIME type
            size: File size in bytes
            storage_key: MinIO storage key
            uploaded_by: User ID who uploaded
            sha256: Optional file checksum
            
        Returns:
            Created File record
        """
        file_record = File(
            org_id=org_id,
            submission_id=submission_id,
            filename=filename,
            mime_type=mime_type,
            size_bytes=size,
            storage_key=storage_key,
            uploaded_by=uploaded_by,
            sha256=sha256,
            scan_status="pending"  # Will be updated by scan job
        )
        
        self.db.add(file_record)
        self.db.commit()
        self.db.refresh(file_record)
        
        logger.info(f"Created file record: {file_record.id} for {filename}")
        return file_record
    
    def get_file(self, file_id: UUID, org_id: UUID) -> Optional[File]:
        """
        Get a file record with organization isolation
        
        Args:
            file_id: File ID
            org_id: Organization ID for access control
            
        Returns:
            File record or None
        """
        return self.db.query(File).filter(
            File.id == file_id,
            File.org_id == org_id,
            File.deleted_at.is_(None)
        ).first()
    
    def list_files(
        self,
        org_id: UUID,
        submission_id: Optional[UUID] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[File]:
        """
        List files for an organization
        
        Args:
            org_id: Organization ID
            submission_id: Optional filter by submission
            limit: Max results
            offset: Pagination offset
            
        Returns:
            List of File records
        """
        query = self.db.query(File).filter(
            File.org_id == org_id,
            File.deleted_at.is_(None)
        )
        
        if submission_id:
            query = query.filter(File.submission_id == submission_id)
        
        return query.order_by(File.created_at.desc()).limit(limit).offset(offset).all()
    
    def delete_file(self, file_id: UUID, org_id: UUID, user_id: UUID) -> bool:
        """
        Soft delete a file
        
        Args:
            file_id: File ID
            org_id: Organization ID
            user_id: User performing deletion
            
        Returns:
            True if successful
        """
        file_record = self.get_file(file_id, org_id)
        if not file_record:
            return False
        
        # Soft delete
        file_record.deleted_at = datetime.utcnow()
        file_record.deleted_by = user_id
        self.db.commit()
        
        # Optionally delete from storage (can be done async)
        # self.storage.delete_file(file_record.storage_key)
        
        logger.info(f"Deleted file: {file_id}")
        return True
    
    def generate_upload_url(
        self,
        org_id: UUID,
        filename: str,
        mime_type: str,
        size: int
    ) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Generate pre-signed upload URL with validation
        
        Args:
            org_id: Organization ID
            filename: Original filename
            mime_type: MIME type
            size: File size
            
        Returns:
            Tuple of (upload_url, storage_key, error_message)
        """
        # Validate
        is_valid, error = self.validate_file(filename, size, mime_type)
        if not is_valid:
            return None, None, error
        
        # Generate upload URL
        try:
            upload_url, storage_key = self.storage.generate_upload_url(
                str(org_id),
                filename,
                mime_type
            )
            return upload_url, storage_key, None
        except Exception as e:
            logger.error(f"Error generating upload URL: {e}")
            return None, None, str(e)
    
    def generate_download_url(
        self,
        file_id: UUID,
        org_id: UUID
    ) -> Optional[str]:
        """
        Generate pre-signed download URL with access control
        
        Args:
            file_id: File ID
            org_id: Organization ID for access control
            
        Returns:
            Download URL or None
        """
        file_record = self.get_file(file_id, org_id)
        if not file_record:
            return None
        
        try:
            return self.storage.generate_download_url(file_record.storage_key)
        except Exception as e:
            logger.error(f"Error generating download URL: {e}")
            return None
    
    def update_checksum(self, file_id: UUID, sha256: str):
        """Update file checksum after upload"""
        file_record = self.db.query(File).filter(File.id == file_id).first()
        if file_record:
            file_record.sha256 = sha256
            self.db.commit()
