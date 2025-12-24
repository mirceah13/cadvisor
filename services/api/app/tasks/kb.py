"""
Knowledge Base Celery Tasks
Handles async document ingestion and embedding
"""

import logging
from uuid import UUID
from typing import Dict, Any
import asyncio

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models import KnowledgeSource, File
from app.services.knowledge_base import KnowledgeBaseService
from app.services.storage import StorageService
from app.tasks.cad import DatabaseTask

logger = logging.getLogger(__name__)


@celery_app.task(
    name="ingest_knowledge_source",
    base=DatabaseTask,
    bind=True,
    max_retries=2,
    default_retry_delay=120
)
def ingest_knowledge_source(self, source_id: str) -> Dict[str, Any]:
    """
    Ingest knowledge source: extract text, chunk, embed
    
    Args:
        source_id: KnowledgeSource UUID as string
        
    Returns:
        Dict with ingestion results
    """
    source_uuid = UUID(source_id)
    db = self.db
    
    logger.info(f"Starting knowledge source ingestion for source_id={source_id}")
    
    try:
        # Get source record
        source = db.query(KnowledgeSource).filter(
            KnowledgeSource.id == source_uuid
        ).first()
        
        if not source:
            raise ValueError(f"KnowledgeSource {source_id} not found")
        
        # Update status
        source.status = "processing"
        db.commit()
        
        # Extract text based on source type
        text_content = None
        
        if source.source_type == "document" and source.file_id:
            # Get file record
            file = db.query(File).filter(File.id == source.file_id).first()
            
            if not file:
                raise ValueError(f"File {source.file_id} not found")
            
            # Download and extract text
            text_content = _extract_text_from_file(file)
            
        elif source.source_type == "url" and source.url:
            # Fetch and extract text from URL
            text_content = _extract_text_from_url(source.url)
            
        elif source.source_type == "text":
            # Direct text input
            text_content = source.metadata.get("content", "")
        
        if not text_content or len(text_content) < 50:
            raise ValueError("Insufficient text content extracted")
        
        logger.info(f"Extracted {len(text_content)} characters from source {source_id}")
        
        # Determine chunking strategy
        chunking_strategy = "general"
        if source.category in ["building_code", "fire_safety", "accessibility"]:
            chunking_strategy = "code_standards"
        elif source.category in ["technical_spec", "engineering"]:
            chunking_strategy = "technical_specs"
        
        # Ingest document (chunk and embed)
        kb_service = KnowledgeBaseService(db)
        
        # Run async embedding in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            chunks_count = loop.run_until_complete(
                kb_service.ingest_document(
                    source_uuid,
                    text_content,
                    chunking_strategy
                )
            )
        finally:
            loop.close()
        
        logger.info(f"Successfully ingested source {source_id} with {chunks_count} chunks")
        
        return {
            "success": True,
            "source_id": source_id,
            "chunks_count": chunks_count,
            "text_length": len(text_content)
        }
    
    except Exception as e:
        logger.error(f"Error ingesting source {source_id}: {e}", exc_info=True)
        
        # Update error status
        try:
            source = db.query(KnowledgeSource).filter(
                KnowledgeSource.id == source_uuid
            ).first()
            
            if source:
                source.status = "failed"
                source.metadata = source.metadata or {}
                source.metadata["error"] = str(e)
                db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")
        
        # Retry on transient errors
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)
        
        return {
            "success": False,
            "source_id": source_id,
            "error": str(e)
        }


def _extract_text_from_file(file: File) -> str:
    """
    Extract text from file
    
    Args:
        file: File model instance
        
    Returns:
        Extracted text content
    """
    import tempfile
    import requests
    from app.services.cad_parser import PDFParser, DOCXParser
    
    storage = StorageService()
    
    # Download file
    download_url = storage.generate_download_url(
        file.storage_path,
        expires_in=3600
    )
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        file_path = tmp.name
        response = requests.get(download_url, stream=True)
        response.raise_for_status()
        
        for chunk in response.iter_content(chunk_size=8192):
            tmp.write(chunk)
    
    try:
        # Extract text based on MIME type
        if file.mime_type == "application/pdf":
            parser = PDFParser()
            result = parser.parse(file_path)
            text = result.get("text", "")
            
        elif "word" in file.mime_type.lower() or file.filename.endswith('.docx'):
            parser = DOCXParser()
            result = parser.parse(file_path)
            text = result.get("text", "")
            
        elif file.mime_type.startswith("text/"):
            with open(file_path, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            raise ValueError(f"Unsupported file type: {file.mime_type}")
        
        return text
    
    finally:
        # Cleanup
        import os
        try:
            os.unlink(file_path)
        except Exception as e:
            logger.warning(f"Failed to cleanup temp file: {e}")


def _extract_text_from_url(url: str) -> str:
    """
    Extract text from URL (simple implementation)
    
    Args:
        url: URL to fetch
        
    Returns:
        Extracted text
    """
    import requests
    from bs4 import BeautifulSoup
    
    # Fetch URL
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    # Parse HTML
    soup = BeautifulSoup(response.content, 'html.parser')
    
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
    
    # Get text
    text = soup.get_text()
    
    # Clean up whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return text
