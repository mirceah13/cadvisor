#!/usr/bin/env python3
"""
Clear all KB data for a source and trigger fresh processing
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from sqlalchemy import delete
from app.core.database import get_db
from app.models import KnowledgeSource, KBChunk, KBImage
from app.tasks.kb import ingest_knowledge_source

async def clear_and_reprocess(source_id: str):
    """Clear all KB data and trigger fresh processing"""
    db = next(get_db())
    
    try:
        # Delete all images
        result = db.execute(
            delete(KBImage).where(KBImage.knowledge_source_id == source_id)
        )
        images_deleted = result.rowcount
        print(f"✓ Deleted {images_deleted} images")
        
        # Delete all chunks
        result = db.execute(
            delete(KBChunk).where(KBChunk.knowledge_source_id == source_id)
        )
        chunks_deleted = result.rowcount
        print(f"✓ Deleted {chunks_deleted} chunks")
        
        # Reset source status
        source = db.query(KnowledgeSource).filter(KnowledgeSource.id == source_id).first()
        if source:
            source.status = 'uploaded'
            source.metadata = {}
            db.commit()
            print(f"✓ Reset source status to uploaded")
            
            # Trigger processing
            task = ingest_knowledge_source.delay(source_id)
            print(f"✓ Task queued: {task.id}")
            print(f"\nSource: {source.title}")
            print(f"File: {source.file.filename if source.file else 'N/A'}")
        else:
            print(f"✗ Source not found: {source_id}")
            
    except Exception as e:
        print(f"✗ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python clear_and_reprocess.py <source_id>")
        sys.exit(1)
    
    source_id = sys.argv[1]
    asyncio.run(clear_and_reprocess(source_id))
