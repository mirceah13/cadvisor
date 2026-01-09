"""
Reprocess Knowledge Base Document with Multimodal Support
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / 'app'))

from core.database import SessionLocal
from models import KnowledgeSource, KBChunk, KBImage
from tasks.kb import ingest_knowledge_source
from sqlalchemy import func

# Source ID from your Romanian fire safety document
SOURCE_ID = 'b06b95cb-3b0b-4cbb-bdb4-1a155f7ada41'

def main():
    db = SessionLocal()
    
    print("=" * 80)
    print("REPROCESSING KNOWLEDGE BASE WITH MULTIMODAL SUPPORT")
    print("=" * 80)
    
    # Get source
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == SOURCE_ID
    ).first()
    
    if not source:
        print(f"❌ Source {SOURCE_ID} not found!")
        return
    
    print(f"\nDocument: {source.title}")
    print(f"Status: {source.status}")
    
    # Count existing data
    chunks_before = db.query(func.count(KBChunk.id)).filter(
        KBChunk.knowledge_source_id == SOURCE_ID
    ).scalar() or 0
    
    images_before = db.query(func.count(KBImage.id)).filter(
        KBImage.knowledge_source_id == SOURCE_ID
    ).scalar() or 0
    
    print(f"\nCurrent state:")
    print(f"  Text chunks: {chunks_before}")
    print(f"  Images: {images_before}")
    
    # Delete old chunks (will keep KB source)
    print(f"\n🗑️  Deleting old chunks...")
    db.query(KBChunk).filter(
        KBChunk.knowledge_source_id == SOURCE_ID
    ).delete()
    
    db.query(KBImage).filter(
        KBImage.knowledge_source_id == SOURCE_ID
    ).delete()
    
    db.commit()
    print("✅ Old data deleted")
    
    # Reset source status
    source.status = "uploaded"
    source.meta_data = {}
    db.commit()
    
    print(f"\n🚀 Triggering multimodal ingestion...")
    print("   This will:")
    print("   - Extract text → chunk → embed")
    print("   - Extract images → OCR → visual embed")
    print("   - Process ~100+ images with annotations")
    print("   - ETA: 15-20 minutes")
    
    # Trigger async task
    task = ingest_knowledge_source.delay(str(SOURCE_ID))
    
    print(f"\n✅ Task queued: {task.id}")
    print(f"\nMonitor progress:")
    print(f"  docker compose logs -f celery")
    print(f"\nOr check database:")
    print(f"  docker compose exec api python scripts/check_kb_progress.py")
    
    db.close()

if __name__ == "__main__":
    main()
