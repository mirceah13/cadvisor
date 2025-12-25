"""
Knowledge Base Service
Manages ingestion, storage, and retrieval of knowledge sources
"""

import logging
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from sqlalchemy.orm.attributes import flag_modified

from app.models import KnowledgeSource, KBChunk
from app.services.storage import StorageService
from app.services.chunking import ChunkingService, ChunkingStrategy
from app.services.embeddings import EmbeddingService

logger = logging.getLogger(__name__)


class KnowledgeBaseService:
    """Service for managing knowledge base"""
    
    def __init__(self, db: Session):
        self.db = db
        self.storage = StorageService()
        self.embedding_service = EmbeddingService()
    
    async def ingest_document(
        self,
        source_id: UUID,
        text_content: str,
        chunking_strategy: str = "general"
    ) -> int:
        """
        Ingest document into knowledge base
        
        Args:
            source_id: KnowledgeSource ID
            text_content: Extracted text from document
            chunking_strategy: "general", "code_standards", or "technical_specs"
            
        Returns:
            Number of chunks created
        """
        # Get source record
        source = self.db.query(KnowledgeSource).filter(
            KnowledgeSource.id == source_id
        ).first()
        
        if not source:
            raise ValueError(f"KnowledgeSource {source_id} not found")
        
        # Select chunking strategy
        if chunking_strategy == "code_standards":
            chunker = ChunkingStrategy.code_standards()
        elif chunking_strategy == "technical_specs":
            chunker = ChunkingStrategy.technical_specs()
        else:
            chunker = ChunkingStrategy.general_documents()
        
        # Chunk text
        metadata = {
            "source_id": str(source_id),
            "source_type": source.source_type,
            "title": source.title,
            "category": source.category
        }
        
        chunks = chunker.chunk_text(text_content, metadata)
        
        logger.info(f"Created {len(chunks)} chunks for source {source_id}")
        
        # Update progress: chunking complete
        source.meta_data = source.meta_data or {}
        source.meta_data["progress"] = {
            "stage": "embedding",
            "total_chunks": len(chunks),
            "processed_chunks": 0,
            "message": "Generating embeddings..."
        }
        flag_modified(source, "meta_data")
        self.db.commit()
        
        # Generate embeddings and store chunks
        chunks_created = 0
        total_chunks = len(chunks)
        
        for i, chunk in enumerate(chunks):
            # Generate embedding
            embedding = await self.embedding_service.generate_embedding(chunk.text)
            
            if not embedding:
                logger.warning(f"Failed to generate embedding for chunk {chunk.chunk_index}")
                continue
            
            # Create chunk record
            kb_chunk = KBChunk(
                knowledge_source_id=source_id,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.text,
                embedding=embedding,
                chunk_metadata={
                    **chunk.metadata,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                    "length": len(chunk.text)
                }
            )
            
            self.db.add(kb_chunk)
            chunks_created += 1
            
            # Update progress every 10 chunks or on last chunk
            if (i + 1) % 10 == 0 or (i + 1) == total_chunks:
                source.meta_data["progress"] = {
                    "stage": "embedding",
                    "total_chunks": total_chunks,
                    "processed_chunks": i + 1,
                    "message": f"Processing chunk {i + 1} of {total_chunks}..."
                }
                flag_modified(source, "meta_data")
                self.db.commit()
        
        # Update source status
        source.status = "ready"
        source.meta_data = source.meta_data or {}
        source.meta_data["chunks_count"] = chunks_created
        source.meta_data["progress"] = {
            "stage": "complete",
            "total_chunks": chunks_created,
            "processed_chunks": chunks_created,
            "message": "Processing complete"
        }
        flag_modified(source, "meta_data")
        
        self.db.commit()
        
        logger.info(f"Ingested {chunks_created} chunks for source {source_id}")
        return chunks_created
    
    async def semantic_search(
        self,
        query: str,
        org_id: UUID,
        limit: int = 5,
        category: Optional[str] = None,
        min_similarity: float = 0.7
    ) -> List[Dict[str, Any]]:
        """
        Semantic search over knowledge base
        
        Args:
            query: Search query
            org_id: Organization ID
            limit: Maximum number of results
            category: Optional category filter
            min_similarity: Minimum cosine similarity threshold
            
        Returns:
            List of relevant chunks with similarity scores
        """
        # Generate query embedding
        query_embedding = await self.embedding_service.generate_embedding(query)
        
        if not query_embedding:
            logger.error("Failed to generate query embedding")
            return []
        
        # Build query
        query_obj = self.db.query(
            KBChunk.id,
            KBChunk.content,
            KBChunk.chunk_index,
            KBChunk.metadata,
            KnowledgeSource.title,
            KnowledgeSource.source_type,
            KnowledgeSource.category,
            # Cosine similarity using pgvector
            (1 - func.cosine_distance(KBChunk.embedding, query_embedding)).label('similarity')
        ).join(
            KnowledgeSource,
            KBChunk.knowledge_source_id == KnowledgeSource.id
        ).filter(
            KnowledgeSource.org_id == org_id,
            KnowledgeSource.status == "ready"
        )
        
        # Apply category filter
        if category:
            query_obj = query_obj.filter(KnowledgeSource.category == category)
        
        # Apply similarity threshold and order
        query_obj = query_obj.having(
            text(f"similarity >= {min_similarity}")
        ).order_by(
            text("similarity DESC")
        ).limit(limit)
        
        results = query_obj.all()
        
        # Format results
        formatted_results = []
        for result in results:
            formatted_results.append({
                "chunk_id": str(result.id),
                "content": result.content,
                "chunk_index": result.chunk_index,
                "similarity": float(result.similarity),
                "source": {
                    "title": result.title,
                    "type": result.source_type,
                    "category": result.category
                },
                "metadata": result.metadata
            })
        
        logger.info(f"Found {len(formatted_results)} results for query: {query[:50]}...")
        return formatted_results
    
    def create_knowledge_source(
        self,
        org_id: UUID,
        title: str,
        source_type: str,
        category: str,
        uploaded_by: UUID,
        file_id: Optional[UUID] = None,
        url: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> KnowledgeSource:
        """
        Create a new knowledge source
        
        Args:
            org_id: Organization ID
            title: Source title
            source_type: "document", "url", "text"
            category: Category (e.g., "building_code", "fire_safety")
            uploaded_by: User ID who uploaded
            file_id: Optional file ID if source is a document
            url: Optional URL if source is from web
            metadata: Additional metadata
            
        Returns:
            Created KnowledgeSource
        """
        # Get storage_key from file if document type
        storage_key = None
        if source_type == "document" and file_id:
            from app.models import File
            file_record = self.db.query(File).filter(File.id == file_id).first()
            if file_record:
                storage_key = file_record.storage_key
        
        source = KnowledgeSource(
            org_id=org_id,
            title=title,
            source_type=source_type,
            category=category,
            file_id=file_id,
            url=url,
            storage_key=storage_key,
            status="uploaded",
            uploaded_by=uploaded_by,
            meta_data=metadata or {}
        )
        
        self.db.add(source)
        self.db.commit()
        self.db.refresh(source)
        
        logger.info(f"Created knowledge source {source.id}: {title}")
        return source
    
    def get_source(self, source_id: UUID, org_id: UUID) -> Optional[KnowledgeSource]:
        """Get knowledge source by ID"""
        return self.db.query(KnowledgeSource).filter(
            KnowledgeSource.id == source_id,
            KnowledgeSource.org_id == org_id
        ).first()
    
    def list_sources(
        self,
        org_id: UUID,
        category: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[KnowledgeSource]:
        """List knowledge sources"""
        query = self.db.query(KnowledgeSource).filter(
            KnowledgeSource.org_id == org_id
        )
        
        if category:
            query = query.filter(KnowledgeSource.category == category)
        
        if status:
            query = query.filter(KnowledgeSource.status == status)
        
        return query.order_by(
            KnowledgeSource.created_at.desc()
        ).limit(limit).offset(offset).all()
    
    def delete_source(self, source_id: UUID, org_id: UUID) -> bool:
        """Delete knowledge source and all its chunks"""
        source = self.get_source(source_id, org_id)
        
        if not source:
            return False
        
        # Delete all chunks
        self.db.query(KBChunk).filter(
            KBChunk.knowledge_source_id == source_id
        ).delete()
        
        # Delete source
        self.db.delete(source)
        self.db.commit()
        
        logger.info(f"Deleted knowledge source {source_id}")
        return True
