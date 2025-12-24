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
        file.metadata = file.metadata or {}
        file.metadata["processing_status"] = "processing"
        file.metadata["processing_started_at"] = str(file.created_at)
        db.commit()
        
        # Download file from storage
        storage = StorageService()
        file_path = None
        
        try:
            # Generate download URL
            download_url = storage.generate_download_url(
                file.storage_path,
                expires_in=3600  # 1 hour for processing
            )
            
            # Download file to temp location
            import tempfile
            import requests
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
                file_path = tmp.name
                response = requests.get(download_url, stream=True)
                response.raise_for_status()
                
                for chunk in response.iter_content(chunk_size=8192):
                    tmp.write(chunk)
            
            logger.info(f"Downloaded file to {file_path}")
            
            # Parse file
            parser = CADParserService()
            parsed_data = parser.parse_file(file_path, file.mime_type)
            
            logger.info(f"Successfully parsed file {file_id}, type={file.mime_type}")
            
            # Store parsed metadata
            file.metadata["parsed_data"] = parsed_data
            file.metadata["processing_status"] = "completed"
            file.metadata["processing_completed_at"] = str(file.updated_at)
            
            # Extract key metrics for quick access
            if "building_info" in parsed_data:
                file.metadata["building_type"] = parsed_data["building_info"].get("type")
            if "storeys" in parsed_data:
                file.metadata["floor_count"] = len(parsed_data["storeys"])
            if "elements" in parsed_data:
                file.metadata["element_count"] = sum(parsed_data["elements"].values())
            
            db.commit()
            
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
                file.metadata = file.metadata or {}
                file.metadata["processing_status"] = "failed"
                file.metadata["processing_error"] = str(e)
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
        
        # Store profile in submission
        submission.metadata = submission.metadata or {}
        submission.metadata["profile"] = profile
        submission.metadata["profile_generated_at"] = str(submission.updated_at)
        
        # Update submission status based on completeness
        completeness_score = profile.get("completeness", {}).get("score", 0)
        if completeness_score >= 80:
            submission.metadata["profile_status"] = "complete"
        elif completeness_score >= 50:
            submission.metadata["profile_status"] = "partial"
        else:
            submission.metadata["profile_status"] = "incomplete"
        
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
            if any(ext in f.filename.lower() for ext in ['.ifc', '.dxf']) or
               any(mime in f.mime_type.lower() for mime in ['ifc', 'dxf'])
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
