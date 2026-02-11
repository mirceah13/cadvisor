"""
Knowledge Base API Endpoints
Manages knowledge sources and semantic search
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
import logging

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, KnowledgeSource, KBChunk, KBImage
from app.services.knowledge_base import KnowledgeBaseService
from app.tasks.kb import ingest_knowledge_source

router = APIRouter()
logger = logging.getLogger(__name__)


# Request/Response Models
class CreateKnowledgeSourceRequest(BaseModel):
    """Request to create knowledge source"""
    title: str = Field(..., max_length=255)
    source_type: str = Field(..., description="document, url, or text")
    category: str = Field(..., description="building_code, fire_safety, accessibility, etc.")
    file_id: Optional[UUID] = None
    url: Optional[str] = None
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}


class KnowledgeSourceResponse(BaseModel):
    """Knowledge source response"""
    id: UUID
    title: str
    source_type: str
    category: str
    status: str
    file_id: Optional[UUID]
    url: Optional[str]
    chunks_count: Optional[int] = None
    images_count: Optional[int] = None
    chunks_with_embeddings: Optional[int] = None
    images_with_embeddings: Optional[int] = None
    text_length: Optional[int] = None
    processing_time: Optional[float] = None
    meta_data: Optional[Dict[str, Any]] = None
    created_at: str
    
    class Config:
        from_attributes = True


class SemanticSearchRequest(BaseModel):
    """Request for semantic search"""
    query: str = Field(..., min_length=3, max_length=500)
    limit: int = Field(default=5, ge=1, le=20)
    category: Optional[str] = None
    min_similarity: float = Field(default=0.7, ge=0.0, le=1.0)


class SearchResultResponse(BaseModel):
    """Single search result"""
    chunk_id: str
    content: str
    similarity: float
    source: Dict[str, str]
    metadata: Dict[str, Any]


class SemanticSearchResponse(BaseModel):
    """Response with search results"""
    query: str
    results: List[SearchResultResponse]
    count: int


# Endpoints
@router.post("/sources", response_model=KnowledgeSourceResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_source(
    request: CreateKnowledgeSourceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new knowledge source
    
    - Supports document upload, URL, or direct text
    - Automatically triggers ingestion task
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Validate source type
    if request.source_type not in ["document", "url", "text"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_type must be 'document', 'url', or 'text'"
        )
    
    # Validate required fields
    if request.source_type == "document" and not request.file_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="file_id required for document source"
        )
    
    if request.source_type == "url" and not request.url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="url required for url source"
        )
    
    if request.source_type == "text" and not request.content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="content required for text source"
        )
    
    # Create source
    kb_service = KnowledgeBaseService(db)
    
    metadata = request.metadata or {}
    if request.content:
        metadata["content"] = request.content
    
    source = kb_service.create_knowledge_source(
        org_id=org_id,
        title=request.title,
        source_type=request.source_type,
        category=request.category,
        uploaded_by=current_user.id,
        file_id=request.file_id,
        url=request.url,
        metadata=metadata
    )
    
    # Trigger ingestion task
    try:
        task = ingest_knowledge_source.delay(str(source.id))
        
        # Store task ID
        source.meta_data = source.meta_data or {}
        source.meta_data["ingestion_task_id"] = task.id
        db.commit()
    except Exception as e:
        # Log error but don't fail source creation
        print(f"Failed to queue ingestion task: {e}")
    
    return KnowledgeSourceResponse(
        id=source.id,
        title=source.title,
        source_type=source.source_type,
        category=source.category,
        status=source.status,
        file_id=source.file_id,
        url=source.url,
        chunks_count=source.meta_data.get("chunks_count") if source.meta_data else None,
        created_at=source.created_at.isoformat()
    )


@router.get("/sources", response_model=List[KnowledgeSourceResponse])
def list_knowledge_sources(
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List knowledge sources
    
    - Filter by category and status
    - Paginated results
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    kb_service = KnowledgeBaseService(db)
    sources = kb_service.list_sources(
        org_id=org_id,
        category=category,
        status=status,
        limit=limit,
        offset=offset
    )
    
    return [
        KnowledgeSourceResponse(
            id=s.id,
            title=s.title,
            source_type=s.source_type,
            category=s.category,
            status=s.status,
            file_id=s.file_id,
            url=s.url,
            chunks_count=kb_service.get_chunks_count(s.id),
            created_at=s.created_at.isoformat()
        )
        for s in sources
    ]


@router.get("/sources/{source_id}", response_model=KnowledgeSourceResponse)
def get_knowledge_source(
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific knowledge source with detailed statistics"""
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    kb_service = KnowledgeBaseService(db)
    source = kb_service.get_source(source_id, org_id)
    
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge source not found"
        )
    
    # Get comprehensive statistics
    chunks_count = kb_service.get_chunks_count(source.id)
    
    # Count images
    images_count = db.query(func.count(KBImage.id)).filter(
        KBImage.knowledge_source_id == source.id
    ).scalar() or 0
    
    # Count chunks with embeddings
    chunks_with_embeddings = db.query(func.count(KBChunk.id)).filter(
        KBChunk.knowledge_source_id == source.id,
        KBChunk.embedding.isnot(None)
    ).scalar() or 0
    
    # Count images with visual embeddings
    images_with_embeddings = db.query(func.count(KBImage.id)).filter(
        KBImage.knowledge_source_id == source.id,
        KBImage.visual_embedding.isnot(None)
    ).scalar() or 0
    
    # Calculate total text length
    text_length_result = db.query(
        func.sum(func.length(KBChunk.chunk_text))
    ).filter(
        KBChunk.knowledge_source_id == source.id
    ).scalar()
    text_length = int(text_length_result) if text_length_result else 0
    
    # Get processing time from metadata if available
    processing_time = None
    if source.meta_data and 'processing_time' in source.meta_data:
        processing_time = source.meta_data['processing_time']
    
    return KnowledgeSourceResponse(
        id=source.id,
        title=source.title,
        source_type=source.source_type,
        category=source.category,
        status=source.status,
        file_id=source.file_id,
        url=source.url,
        chunks_count=chunks_count,
        images_count=images_count,
        chunks_with_embeddings=chunks_with_embeddings,
        images_with_embeddings=images_with_embeddings,
        text_length=text_length,
        processing_time=processing_time,
        meta_data=source.meta_data,
        created_at=source.created_at.isoformat()
    )


@router.delete("/sources/{source_id}")
def delete_knowledge_source(
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a knowledge source and all its chunks"""
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    kb_service = KnowledgeBaseService(db)
    success = kb_service.delete_source(source_id, org_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge source not found"
        )
    
    return {"message": "Knowledge source deleted successfully"}


@router.post("/search", response_model=SemanticSearchResponse)
async def semantic_search(
    request: SemanticSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Semantic search over knowledge base
    
    - Uses vector similarity with pgvector
    - Returns most relevant chunks with similarity scores
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    kb_service = KnowledgeBaseService(db)
    
    try:
        results = await kb_service.semantic_search(
            query=request.query,
            org_id=org_id,
            limit=request.limit,
            category=request.category,
            min_similarity=request.min_similarity
        )
        
        return SemanticSearchResponse(
            query=request.query,
            results=[
                SearchResultResponse(
                    chunk_id=r["chunk_id"],
                    content=r["content"],
                    similarity=r["similarity"],
                    source=r["source"],
                    metadata=r["metadata"]
                )
                for r in results
            ],
            count=len(results)
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}"
        )


@router.post("/sources/{source_id}/reingest")
def reingest_source(
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Trigger re-ingestion of a knowledge source
    
    - Useful after changing chunking strategy or fixing embeddings
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    kb_service = KnowledgeBaseService(db)
    source = kb_service.get_source(source_id, org_id)
    
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge source not found"
        )
    
    # Delete old chunks and images before re-processing
    chunks_deleted = db.query(KBChunk).filter(KBChunk.knowledge_source_id == source_id).delete()
    images_deleted = db.query(KBImage).filter(KBImage.knowledge_source_id == source_id).delete()
    
    logger.info(f"Deleted {chunks_deleted} chunks and {images_deleted} images for source {source_id}")
    
    # Reset status to uploaded
    source.status = "uploaded"
    source.meta_data = source.meta_data or {}
    source.meta_data.pop("chunks_count", None)
    source.meta_data.pop("images_count", None)
    source.meta_data.pop("error", None)
    db.commit()
    
    # Trigger ingestion
    try:
        task = ingest_knowledge_source.delay(str(source_id))
        
        source.meta_data["ingestion_task_id"] = task.id
        db.commit()
        
        return {
            "message": "Re-ingestion queued successfully",
            "task_id": task.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue re-ingestion: {str(e)}"
        )


@router.post("/sources/{source_id}/cancel")
def cancel_source_processing(
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel/stop processing of a knowledge source
    
    - Marks the source as failed to stop polling
    - Revokes the Celery task if still running
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    kb_service = KnowledgeBaseService(db)
    source = kb_service.get_source(source_id, org_id)
    
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Knowledge source not found"
        )
    
    # Get task ID if available
    task_id = None
    if source.meta_data:
        task_id = source.meta_data.get("ingestion_task_id")
    
    # Revoke celery task
    if task_id:
        try:
            from app.core.celery_app import celery_app
            celery_app.control.revoke(task_id, terminate=True, signal='SIGKILL')
        except Exception as e:
            logger.warning(f"Failed to revoke task {task_id}: {e}")
    
    # Update source status
    source.status = "failed"
    source.meta_data = source.meta_data or {}
    source.meta_data["error"] = "Processing cancelled by user"
    source.meta_data["cancelled_at"] = str(func.now())
    flag_modified(source, "meta_data")
    db.commit()
    
    return {
        "message": "Processing cancelled successfully",
        "source_id": str(source_id),
        "task_id": task_id
    }


@router.get("/stats")
def get_knowledge_base_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get knowledge base statistics
    
    - Returns actual counts from database
    - Includes sources by status and category
    - Returns total chunks count
    """
    if not current_user.org_memberships:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must belong to an organization"
        )
    
    org_id = current_user.org_memberships[0].org_id
    
    # Get total sources count
    total_sources = db.query(func.count(KnowledgeSource.id)).filter(
        KnowledgeSource.org_id == org_id
    ).scalar() or 0
    
    # Get sources by status
    sources_by_status = dict(
        db.query(
            KnowledgeSource.status,
            func.count(KnowledgeSource.id)
        ).filter(
            KnowledgeSource.org_id == org_id
        ).group_by(KnowledgeSource.status).all()
    )
    
    # Get sources by category
    sources_by_category = dict(
        db.query(
            KnowledgeSource.category,
            func.count(KnowledgeSource.id)
        ).filter(
            KnowledgeSource.org_id == org_id
        ).group_by(KnowledgeSource.category).all()
    )
    
    # Get total chunks count
    total_chunks = db.query(func.count(KBChunk.id)).filter(
        KBChunk.org_id == org_id
    ).scalar() or 0
    
    # Get total images count
    total_images = db.query(func.count(KBImage.id)).filter(
        KBImage.org_id == org_id
    ).scalar() or 0
    
    # Get chunks with embeddings
    chunks_with_embeddings = db.query(func.count(KBChunk.id)).filter(
        KBChunk.org_id == org_id,
        KBChunk.embedding.isnot(None)
    ).scalar() or 0
    
    # Get images with embeddings
    images_with_embeddings = db.query(func.count(KBImage.id)).filter(
        KBImage.org_id == org_id,
        KBImage.visual_embedding.isnot(None)
    ).scalar() or 0
    
    return {
        "total_sources": total_sources,
        "sources_by_status": sources_by_status,
        "sources_by_category": sources_by_category,
        "total_chunks": total_chunks,
        "total_images": total_images,
        "chunks_with_embeddings": chunks_with_embeddings,
        "images_with_embeddings": images_with_embeddings
    }

