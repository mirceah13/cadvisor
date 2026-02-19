"""
CAD File Processing Celery Tasks
Handles background parsing and metadata extraction
"""

import logging
from uuid import UUID
from typing import Dict, Any, Optional
from celery import Task

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import File, Submission
from app.services.storage import StorageService
from app.services.cad_parser import CADParserService
from app.services.submission_profile import SubmissionProfileGenerator
from sqlalchemy.orm import attributes

logger = logging.getLogger(__name__)


class DatabaseTask(Task):
    """Base task with DB session management"""
    _db = None
    
    @property
    def db(self):
        if self._db is None:
            self._db = SessionLocal()
        return self._db
    
    def after_return(self, *args, **kwargs):
        """Close DB connection after task completion"""
        if self._db is not None:
            self._db.close()
            self._db = None


@celery_app.task(
    name="process_cad_file",
    base=DatabaseTask,
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def process_cad_file(self, file_id: str) -> Dict[str, Any]:
    """
    Process CAD file: download, parse, extract metadata
    
    Args:
        file_id: File UUID as string
        
    Returns:
        Dict with parsing results
    """
    file_uuid = UUID(file_id)
    db = self.db
    
    logger.info(f"Starting CAD file processing for file_id={file_id}")
    
    try:
        # Get file record
        file = db.query(File).filter(File.id == file_uuid).first()
        if not file:
            raise ValueError(f"File {file_id} not found")
        
        # Update status
        file.parsed_metadata = dict(file.parsed_metadata or {})
        file.parsed_metadata["processing_status"] = "processing"
        file.parsed_metadata["processing_started_at"] = str(file.created_at)
        attributes.flag_modified(file, "parsed_metadata")
        db.commit()
        
        # Download file from storage
        storage = StorageService()
        file_path = None
        
        try:
            # Download file directly from MinIO to temp location
            import tempfile
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
                file_path = tmp.name
            
            # Download directly from MinIO (no presigned URL needed for internal access)
            storage.client.fget_object(
                storage.bucket_name,
                file.storage_key,
                file_path
            )
            
            logger.info(f"Downloaded file to {file_path}")
            
            # Parse file
            parser = CADParserService()
            parsed_result = parser.parse_file(file_path, file.mime_type)
            
            logger.info(f"Successfully parsed file {file_id}, type={file.mime_type}")
            
            # Extract actual data from nested structure
            file_type = parsed_result.get("type", "unknown")
            parsed_data = parsed_result.get("data", {})
            
            # Store parsed metadata - merge with parsed data at top level
            metadata_dict = file.parsed_metadata or {}
            metadata_dict["file_type"] = file_type
            metadata_dict.update(parsed_data)  # Merge parsed CAD/IFC data directly
            metadata_dict["processing_status"] = "completed"
            metadata_dict["processing_completed_at"] = str(file.updated_at)
            
            # Extract key metrics for quick access
            if "building_info" in parsed_data:
                metadata_dict["building_type"] = parsed_data["building_info"].get("type")
            if "storeys" in parsed_data:
                metadata_dict["floor_count"] = len(parsed_data["storeys"])
            if "elements" in parsed_data:
                metadata_dict["element_count"] = sum(parsed_data["elements"].values())
            
            # Reassign to trigger SQLAlchemy change detection
            file.parsed_metadata = metadata_dict
            logger.info(f"Updating file metadata with {len(metadata_dict)} keys")
            
            # Mark as modified and commit
            attributes.flag_modified(file, "parsed_metadata")
            db.flush()
            db.commit()
            logger.info("Successfully committed metadata to database")
            
            # Trigger submission profile regeneration
            if file.submission_id:
                generate_submission_profile.delay(str(file.submission_id))
            
            return {
                "success": True,
                "file_id": file_id,
                "metadata": parsed_data
            }
            
        finally:
            # Cleanup temp file
            if file_path:
                import os
                try:
                    os.unlink(file_path)
                    logger.info(f"Cleaned up temp file {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file: {e}")
    
    except Exception as e:
        logger.error(f"Error processing file {file_id}: {e}", exc_info=True)
        
        # Update error status
        try:
            file = db.query(File).filter(File.id == file_uuid).first()
            if file:
                file.parsed_metadata = dict(file.parsed_metadata or {})
                file.parsed_metadata["processing_status"] = "failed"
                file.parsed_metadata["processing_error"] = str(e)
                attributes.flag_modified(file, "parsed_metadata")
                db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")
        
        # Retry on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        
        return {
            "success": False,
            "file_id": file_id,
            "error": str(e)
        }


@celery_app.task(
    name="generate_submission_profile",
    base=DatabaseTask,
    bind=True,
    max_retries=2
)
def generate_submission_profile(self, submission_id: str) -> Dict[str, Any]:
    """
    Generate comprehensive submission profile from all files
    
    Args:
        submission_id: Submission UUID as string
        
    Returns:
        Dict with profile data
    """
    submission_uuid = UUID(submission_id)
    db = self.db
    
    logger.info(f"Generating submission profile for submission_id={submission_id}")
    
    try:
        # Get submission
        submission = db.query(Submission).filter(
            Submission.id == submission_uuid
        ).first()
        
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")
        
        # Generate profile
        generator = SubmissionProfileGenerator(db)
        profile = generator.generate_profile(submission_uuid)
        
        # Store profile directly in submission.profile column
        submission.profile = profile
        
        db.commit()
        
        logger.info(f"Successfully generated profile for submission {submission_id}")
        
        return {
            "success": True,
            "submission_id": submission_id,
            "profile": profile
        }
    
    except Exception as e:
        logger.error(f"Error generating profile for submission {submission_id}: {e}", exc_info=True)
        
        # Retry on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        
        return {
            "success": False,
            "submission_id": submission_id,
            "error": str(e)
        }


@celery_app.task(name="reprocess_all_files")
def reprocess_all_files(submission_id: str) -> Dict[str, Any]:
    """
    Reprocess all CAD files in a submission
    
    Args:
        submission_id: Submission UUID as string
        
    Returns:
        Dict with task IDs
    """
    submission_uuid = UUID(submission_id)
    db = SessionLocal()
    
    try:
        # Get all CAD files
        files = db.query(File).filter(
            File.submission_id == submission_uuid,
            File.deleted_at.is_(None)
        ).all()
        
        cad_files = [
            f for f in files
            if any(ext in f.filename.lower() for ext in ['.ifc', '.dxf', '.dwg']) or
               any(mime in f.mime_type.lower() for mime in ['ifc', 'dxf', 'dwg', 'acad'])
        ]
        
        # Queue processing tasks
        task_ids = []
        for file in cad_files:
            task = process_cad_file.delay(str(file.id))
            task_ids.append(task.id)
        
        logger.info(f"Queued {len(task_ids)} files for reprocessing in submission {submission_id}")
        
        return {
            "success": True,
            "submission_id": submission_id,
            "files_queued": len(task_ids),
            "task_ids": task_ids
        }
    
    finally:
        db.close()
