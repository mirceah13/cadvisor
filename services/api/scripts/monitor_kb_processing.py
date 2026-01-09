#!/usr/bin/env python3
"""
Monitor Knowledge Base Processing Progress
Shows real-time status of document processing including images
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import SessionLocal
from app.models import KnowledgeSource, KBChunk, KBImage
from sqlalchemy import func
import json

# Source ID
SOURCE_ID = 'b06b95cb-3b0b-4cbb-bdb4-1a155f7ada41'

def format_bytes(bytes_val):
    """Format bytes to human readable"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} TB"

def main():
    db = SessionLocal()
    
    print("=" * 80)
    print("KNOWLEDGE BASE PROCESSING MONITOR")
    print("=" * 80)
    print()
    
    # Get source
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.id == SOURCE_ID
    ).first()
    
    if not source:
        print(f"❌ Source {SOURCE_ID} not found!")
        return
    
    # Basic info
    print(f"📄 Document: {source.title}")
    print(f"📁 Type: {source.source_type}")
    print(f"🏷️  Category: {source.category}")
    print(f"📊 Status: {source.status}")
    print()
    
    # Progress info
    metadata = source.meta_data if hasattr(source, 'meta_data') else {}
    if metadata and 'progress' in metadata:
        progress = metadata['progress']
        print("⏳ Current Progress:")
        print(f"   Stage: {progress.get('stage', 'Unknown')}")
        print(f"   Message: {progress.get('message', 'N/A')}")
        
        if 'total_chunks' in progress:
            total = progress['total_chunks']
            processed = progress.get('processed_chunks', 0)
            percentage = (processed / total * 100) if total > 0 else 0
            print(f"   Chunks: {processed:,}/{total:,} ({percentage:.1f}%)")
            
            # Progress bar
            bar_width = 50
            filled = int(bar_width * processed / total) if total > 0 else 0
            bar = '█' * filled + '░' * (bar_width - filled)
            print(f"   [{bar}]")
        print()
    
    # Text chunks stats
    chunk_count = db.query(func.count(KBChunk.id)).filter(
        KBChunk.knowledge_source_id == SOURCE_ID
    ).scalar()
    
    avg_chunk_size = db.query(func.avg(func.length(KBChunk.chunk_text))).filter(
        KBChunk.knowledge_source_id == SOURCE_ID
    ).scalar()
    
    total_text_size = db.query(func.sum(func.length(KBChunk.chunk_text))).filter(
        KBChunk.knowledge_source_id == SOURCE_ID
    ).scalar()
    
    print("📝 Text Chunks:")
    print(f"   Total Chunks: {chunk_count:,}")
    if avg_chunk_size:
        print(f"   Average Size: {avg_chunk_size:.0f} characters")
    if total_text_size:
        print(f"   Total Text: {format_bytes(total_text_size)}")
    print()
    
    # Images stats
    image_count = db.query(func.count(KBImage.id)).filter(
        KBImage.knowledge_source_id == SOURCE_ID
    ).scalar()
    
    print("🖼️  Images:")
    print(f"   Total Images: {image_count:,}")
    
    if image_count > 0:
        # Count images with OCR text
        ocr_count = db.query(func.count(KBImage.id)).filter(
            KBImage.knowledge_source_id == SOURCE_ID,
            KBImage.ocr_text.isnot(None),
            func.length(KBImage.ocr_text) > 0
        ).scalar()
        
        # Get image format distribution
        format_stats = db.query(
            KBImage.format,
            func.count(KBImage.id)
        ).filter(
            KBImage.knowledge_source_id == SOURCE_ID
        ).group_by(KBImage.format).all()
        
        print(f"   With OCR Text: {ocr_count:,}")
        print(f"   Image Formats:")
        for fmt, count in format_stats:
            print(f"      {fmt}: {count:,}")
        
        # Sample images with OCR
        sample_images = db.query(KBImage).filter(
            KBImage.knowledge_source_id == SOURCE_ID,
            KBImage.ocr_text.isnot(None),
            func.length(KBImage.ocr_text) > 10
        ).limit(3).all()
        
        if sample_images:
            print()
            print("   📋 Sample OCR Results:")
            for idx, img in enumerate(sample_images, 1):
                ocr_preview = img.ocr_text[:100].replace('\n', ' ') if img.ocr_text else 'N/A'
                print(f"      {idx}. Image #{img.image_index}: \"{ocr_preview}...\"")
    
    print()
    
    # Storage stats
    metadata = source.meta_data if hasattr(source, 'meta_data') else {}
    if metadata:
        progress_data = metadata.get('progress', {})
        if 'char_count' in progress_data:
            char_count = progress_data['char_count']
            print(f"📊 Total Characters Extracted: {char_count:,}")
        
        if 'images_extracted' in metadata:
            print(f"📊 Images Extracted (metadata): {metadata['images_extracted']}")
    
    print()
    
    # Status summary
    print("=" * 80)
    metadata = source.meta_data if hasattr(source, 'meta_data') else {}
    if source.status == 'completed':
        print("✅ Processing COMPLETE!")
        print(f"   📝 {chunk_count:,} text chunks indexed")
        print(f"   🖼️  {image_count:,} images processed")
    elif source.status == 'processing':
        print("⏳ Processing IN PROGRESS...")
        if metadata and 'progress' in metadata:
            progress = metadata['progress']
            if 'total_chunks' in progress and 'processed_chunks' in progress:
                remaining = progress['total_chunks'] - progress['processed_chunks']
                print(f"   Remaining: {remaining:,} chunks")
    elif source.status == 'failed':
        print("❌ Processing FAILED")
        if metadata and 'error' in metadata:
            print(f"   Error: {metadata['error']}")
    else:
        print(f"📊 Status: {source.status}")
    
    print("=" * 80)
    
    db.close()

if __name__ == "__main__":
    main()
