"""
Reparse a CAD file with improved error handling
"""
import sys
import asyncio
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models import File
from app.services.cad_parser import CADParserService
from app.services.s3 import S3Service
import tempfile
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def reparse_file(file_id: str = None):
    """Reparse a specific file or the most recent DWG"""
    db = SessionLocal()
    s3_service = S3Service()
    parser = CADParserService(db)
    
    try:
        # Get file
        if file_id:
            file = db.query(File).filter(File.id == file_id).first()
        else:
            # Get most recent DWG file
            file = db.query(File).filter(
                File.filename.ilike('%.dwg')
            ).order_by(File.created_at.desc()).first()
        
        if not file:
            logger.error("No file found")
            return
        
        logger.info(f"Reparsing file: {file.filename}")
        logger.info(f"Storage key: {file.storage_key}")
        
        # Download file from S3
        with tempfile.TemporaryDirectory() as temp_dir:
            local_path = Path(temp_dir) / file.filename
            
            logger.info("Downloading file from S3...")
            file_bytes = await s3_service.get_file(file.storage_key)
            
            with open(local_path, 'wb') as f:
                f.write(file_bytes)
            
            logger.info(f"File downloaded to: {local_path}")
            logger.info(f"File size: {local_path.stat().st_size / 1024 / 1024:.2f} MB")
            
            # Parse the file
            logger.info("Parsing CAD file...")
            metadata = parser.parse_file(str(local_path))
            
            logger.info("Parse result:")
            import json
            print(json.dumps(metadata, indent=2, default=str))
            
            # Update file metadata
            file.parsed_metadata = metadata
            db.commit()
            
            logger.info(f"Successfully updated metadata for file {file.id}")
            
    finally:
        db.close()


if __name__ == "__main__":
    file_id = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(reparse_file(file_id))
