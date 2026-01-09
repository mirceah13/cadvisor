"""
Check Knowledge Base Processing Progress
"""

from app.core.database import SessionLocal
from app.models import KnowledgeSource, KBChunk, KBImage
from sqlalchemy import func
import sys

SOURCE_ID = sys.argv[1] if len(sys.argv) > 1 else 'b06b95cb-3b0b-4cbb-bdb4-1a155f7ada41'

def main():
    db = SessionLocal()
    
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == SOURCE_ID
    ).first()
    
    if not source:
        print(f"❌ Source not found: {SOURCE_ID}")
        return
    
    print("=" * 80)
    print(f"PROCESSING STATUS: {source.title}")
    print("=" * 80)
    
    print(f"\nStatus: {source.status}")
    
    # Progress info
    if source.meta_data and 'progress' in source.meta_data:
        progress = source.meta_data['progress']
        print(f"\nProgress:")
        print(f"  Stage: {progress.get('stage', 'N/A')}")
        print(f"  Message: {progress.get('message', 'N/A')}")
        
        if 'total_chunks' in progress:
            total = progress['total_chunks']
            processed = progress.get('processed_chunks', 0)
            pct = int((processed / total * 100)) if total > 0 else 0
            print(f"  Chunks: {processed}/{total} ({pct}%)")
    
    # Count data
    chunks = db.query(func.count(KBChunk.id)).filter(
        KBChunk.knowledge_source_id == SOURCE_ID
    ).scalar() or 0
    
    images = db.query(func.count(KBImage.id)).filter(
        KBImage.knowledge_source_id == SOURCE_ID
    ).scalar() or 0
    
    print(f"\n📊 Data Created:")
    print(f"  Text chunks: {chunks:,}")
    print(f"  Images: {images:,}")
    
    # Sample image if available
    if images > 0:
        sample = db.query(KBImage).filter(
            KBImage.knowledge_source_id == SOURCE_ID
        ).first()
        
        print(f"\n🖼️  Sample Image:")
        print(f"  Format: {sample.format}")
        print(f"  Size: {sample.size_bytes / 1024:.1f} KB")
        print(f"  OCR Text: {sample.ocr_text[:150] if sample.ocr_text else 'N/A'}...")
        if sample.image_metadata:
            annotations = sample.image_metadata.get('annotations', [])
            if annotations:
                print(f"  Annotations: {', '.join(annotations[:5])}")
        print(f"  Visual Embedding: {'✅ Yes' if sample.visual_embedding else '❌ No'}")
    
    print("\n" + "=" * 80)
    
    db.close()

if __name__ == "__main__":
    main()
