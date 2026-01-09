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
from sqlalchemy.orm.attributes import flag_modified
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
        
        # Update status with progress
        source.status = "processing"
        source.meta_data = source.meta_data or {}
        source.meta_data["progress"] = {
            "stage": "downloading",
            "message": "Downloading and extracting text..."
        }
        flag_modified(source, "meta_data")
        db.commit()
        db.refresh(source)
        
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
            text_content = source.meta_data.get("content", "") if source.meta_data else ""
        
        if not text_content or len(text_content) < 50:
            raise ValueError("Insufficient text content extracted")
        
        logger.info(f"Extracted {len(text_content)} characters from source {source_id}")
        
        # Update progress: extraction complete
        source.meta_data["progress"] = {
            "stage": "chunking",
            "message": "Creating text chunks...",
            "char_count": len(text_content)
        }
        flag_modified(source, "meta_data")
        db.commit()
        db.refresh(source)
        
        # Extract and process images from document
        image_count = _process_document_images(source, file, db) if file else 0
        
        logger.info(f"Extracted {image_count} images from source {source_id}")
        
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
                source.meta_data = source.meta_data or {}
                source.meta_data["error"] = str(e)
                source.meta_data["error_time"] = str(db.query(func.now()).scalar())
                flag_modified(source, "meta_data")
                db.commit()
                db.refresh(source)
                logger.info(f"Set source {source_id} status to failed")
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
    import os
    from app.services.cad_parser import PDFParser, DOCXParser
    
    storage = StorageService()
    
    # Download file directly from MinIO (works inside Docker)
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        file_path = tmp.name
    
    try:
        # Download from MinIO
        storage.download_file_to_path(file.storage_key, file_path)
        
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


def _process_document_images(source: 'KnowledgeSource', file: 'File', db) -> int:
    """
    Extract and process images from a document
    
    Args:
        source: KnowledgeSource record
        file: File record
        db: Database session
        
    Returns:
        Number of images processed
    """
    import tempfile
    import asyncio
    from app.services.image_extraction import ImageExtractionService
    from app.services.ocr import OCRService
    from app.services.visual_embeddings import VisualEmbeddingService
    from app.services.storage import StorageService
    from app.models import KBImage
    from PIL import Image as PILImage
    
    try:
        storage = StorageService()
        image_extractor = ImageExtractionService()
        ocr_service = OCRService()
        visual_embedder = VisualEmbeddingService()
        
        # Download file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            file_path = tmp.name
        
        try:
            storage.download_file_to_path(file.storage_key, file_path)
            
            # Extract images
            extracted_images = image_extractor.extract_images(file_path, file.mime_type)
            
            if not extracted_images:
                logger.info(f"No images found in {file.filename}")
                return 0
            
            logger.info(f"Extracted {len(extracted_images)} images from {file.filename}")
            
            # Process each image
            images_processed = 0
            
            for idx, img_data in enumerate(extracted_images):
                try:
                    # Save image to temp file for processing
                    img_temp_path = image_extractor.save_image_to_temp(
                        img_data['data'],
                        img_data['format']
                    )
                    
                    # Get image dimensions
                    try:
                        with PILImage.open(img_temp_path) as pil_img:
                            width, height = pil_img.size
                    except:
                        width, height = None, None
                    
                    # Perform OCR
                    ocr_result = ocr_service.extract_technical_annotations(img_temp_path)
                    
                    # Generate visual embedding
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    try:
                        visual_embedding = visual_embedder.generate_image_embedding(img_data['data'])
                    finally:
                        loop.close()
                    
                    # Upload image to MinIO
                    image_storage_key = f"orgs/{source.org_id}/kb/{source.id}/images/{img_data['hash']}{img_data['format']}"
                    
                    from io import BytesIO
                    storage.client.put_object(
                        storage.bucket_name,
                        image_storage_key,
                        data=BytesIO(img_data['data']),
                        length=len(img_data['data']),
                        content_type=img_data['content_type']
                    )
                    
                    # Create KB image record
                    kb_image = KBImage(
                        knowledge_source_id=source.id,
                        org_id=source.org_id,
                        storage_key=image_storage_key,
                        image_hash=img_data['hash'],
                        image_index=idx,
                        format=img_data['format'],
                        content_type=img_data['content_type'],
                        size_bytes=img_data['size'],
                        width=width,
                        height=height,
                        ocr_text=ocr_result.get('text', ''),
                        ocr_confidence=ocr_result.get('confidence', 0.0),
                        ocr_language=ocr_result.get('language', 'ron+eng'),
                        visual_embedding=visual_embedding,
                        image_metadata={
                            'source_file': img_data.get('source', 'unknown'),
                            'page': img_data.get('page'),
                            'filename': img_data.get('filename'),
                            'annotations': ocr_result.get('annotations', []),
                            'word_count': ocr_result.get('word_count', 0)
                        }
                    )
                    
                    db.add(kb_image)
                    images_processed += 1
                    
                    # Cleanup temp file
                    try:
                        import os
                        os.unlink(img_temp_path)
                    except:
                        pass
                    
                    # Commit in batches
                    if images_processed % 10 == 0:
                        db.commit()
                        logger.info(f"Processed {images_processed}/{len(extracted_images)} images")
                        
                except Exception as e:
                    logger.warning(f"Failed to process image {idx}: {e}")
                    continue
            
            # Final commit
            db.commit()
            
            logger.info(f"Successfully processed {images_processed} images for source {source.id}")
            return images_processed
            
        finally:
            # Cleanup downloaded file
            try:
                import os
                os.unlink(file_path)
            except:
                pass
                
    except Exception as e:
        logger.error(f"Error processing images: {e}", exc_info=True)
        return 0
