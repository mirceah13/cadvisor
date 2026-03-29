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
from datetime import datetime, timezone
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
        file = None  # Initialize file variable
        local_file_path = None  # reuse downloaded file for image processing

        if source.source_type == "document" and source.file_id:
            # Get file record
            file = db.query(File).filter(File.id == source.file_id).first()

            if not file:
                raise ValueError(f"File {source.file_id} not found")

            # Download file ONCE — reuse for both text extraction and image processing
            text_content, local_file_path = _extract_text_from_file(file)

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
        
        # Determine chunking strategy
        chunking_strategy = "general"
        if source.category in ["building_code", "fire_safety", "accessibility"]:
            chunking_strategy = "code_standards"
        elif source.category in ["technical_spec", "engineering"]:
            chunking_strategy = "technical_specs"
        
        # Ingest document (chunk and embed).
        # NOTE: ingest_document deletes existing KBChunk + KBImage rows first,
        # so image processing MUST run AFTER this to avoid being wiped.
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
        
        # Extract and process images AFTER chunk ingestion so the KBImage
        # cleanup inside ingest_document does not wipe freshly-saved images.
        try:
            image_count = _process_document_images(source, file, db, local_file_path) if file else 0
        except Exception as img_err:
            logger.error(f"Image processing failed (non-fatal) for {source_id}: {img_err}", exc_info=True)
            image_count = 0
        finally:
            # Cleanup the locally cached file now that both text and image steps are done
            if local_file_path:
                import os as _os
                try:
                    _os.unlink(local_file_path)
                except Exception:
                    pass

        logger.info(f"Extracted {image_count} images from source {source_id}")

        # Persist image count back to the source record so the UI reflects reality.
        # (ingest_document already set status="indexed" and chunks_count; we just add images_count).
        try:
            from app.models import KBImage
            db.refresh(source)
            source.meta_data = source.meta_data or {}
            source.meta_data["images_count"] = image_count
            if image_count > 0:
                embedded = db.query(KBImage).filter(
                    KBImage.knowledge_source_id == source_uuid,
                    KBImage.visual_embedding.isnot(None)
                ).count()
                source.meta_data["images_embedded"] = embedded
            else:
                source.meta_data["images_embedded"] = 0
            flag_modified(source, "meta_data")
            db.commit()
        except Exception as meta_err:
            logger.warning(f"Failed to persist image count for {source_id}: {meta_err}")

        return {
            "success": True,
            "source_id": source_id,
            "chunks_count": chunks_count,
            "images_count": image_count,
            "text_length": len(text_content)
        }
    
    except Exception as e:
        logger.error(f"Error ingesting source {source_id}: {e}", exc_info=True)

        # Update error status — rollback broken transaction first
        try:
            db.rollback()  # clear any failed transaction so new queries work
            source = db.query(KnowledgeSource).filter(
                KnowledgeSource.id == source_uuid
            ).first()

            if source:
                source.status = "failed"
                source.meta_data = source.meta_data or {}
                source.meta_data["error"] = str(e)
                source.meta_data["error_time"] = datetime.now(timezone.utc).isoformat()
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


def _extract_text_from_file(file: File):
    """
    Download file from storage and extract its text content.

    Returns:
        (text: str, local_file_path: str) — caller is responsible for deleting the temp file.
    """
    import tempfile
    import os
    from app.services.cad_parser import PDFParser, DOCXParser

    storage = StorageService()

    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        file_path = tmp.name

    try:
        storage.download_file_to_path(file.storage_key, file_path)

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

        # Return text AND file path; caller cleans up after image processing.
        return text, file_path

    except Exception:
        # On error, clean up immediately and re-raise
        try:
            os.unlink(file_path)
        except Exception:
            pass
        raise


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


def _process_document_images(source: 'KnowledgeSource', file: 'File', db, predownloaded_path: str = None) -> int:
    """
    Extract and process images from a document.

    Args:
        source: KnowledgeSource record
        file: File record
        db: Database session
        predownloaded_path: If provided, use this local file instead of re-downloading.

    Returns:
        Number of images stored.
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

        # Use pre-downloaded file if provided; otherwise download now.
        owns_file = False
        if predownloaded_path:
            file_path = predownloaded_path
        else:
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
                file_path = tmp.name
            storage.download_file_to_path(file.storage_key, file_path)
            owns_file = True

        try:
            # Extract images
            extracted_images = image_extractor.extract_images(file_path, file.mime_type)

            if not extracted_images:
                logger.info(f"No images found in {file.filename}")
                return 0

            logger.info(f"Extracted {len(extracted_images)} raw images from {file.filename}")
            
            # Process each image
            images_processed = 0

            # Vector/metafile formats: Jina CLIP and PIL can't handle raw EMF/WMF bytes.
            # We still store them in MinIO and create DB records, just without
            # visual embeddings or OCR.
            VECTOR_FORMATS = {'.emf', '.wmf', '.svg'}
            # Minimum size to skip decorative elements (bullets, rules, small logos)
            MIN_IMAGE_BYTES = 5_000

            for idx, img_data in enumerate(extracted_images):
                try:
                    # Skip tiny decorative images (bullets, borders, small logos)
                    if img_data['size'] < MIN_IMAGE_BYTES:
                        logger.debug(f"Skipping small image {idx} ({img_data['size']} bytes)")
                        continue

                    is_vector = img_data['format'].lower() in VECTOR_FORMATS

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
                    
                    # Perform OCR (skip for vector/metafile formats)
                    if is_vector:
                        ocr_result = {'text': '', 'confidence': 0.0, 'annotations': [], 'word_count': 0}
                    else:
                        ocr_result = ocr_service.extract_technical_annotations(img_temp_path)
                    
                    # Generate visual embedding via Jina CLIP API (skip for vector formats)
                    if is_vector:
                        visual_embedding = None
                    else:
                        visual_embedding = visual_embedder.generate_image_embedding(img_data['data'])
                    
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
                    logger.warning(f"Failed to process image {idx}: {e}", exc_info=True)
                    continue
            
            # Final commit
            db.commit()
            
            logger.info(f"Successfully processed {images_processed} images for source {source.id}")
            return images_processed
            
        finally:
            # Only delete the temp file if this function downloaded it
            if owns_file:
                try:
                    os.unlink(file_path)
                except Exception:
                    pass

    except Exception as e:
        logger.error(f"Error processing images: {e}", exc_info=True)
        return 0
