#!/usr/bin/env python3
"""Simple script to trigger KB reprocessing"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Source ID
SOURCE_ID = 'b06b95cb-3b0b-4cbb-bdb4-1a155f7ada41'

if __name__ == "__main__":
    from app.tasks.kb import ingest_knowledge_source
    
    print("=" * 80)
    print("TRIGGERING MULTIMODAL KB REPROCESSING")
    print("=" * 80)
    print(f"\nSource ID: {SOURCE_ID}")
    print("\nThis will process the document with:")
    print("  • Image extraction (DOCX/PDF)")
    print("  • OCR (Romanian + English)")
    print("  • Visual embeddings (CLIP)")
    print("  • Text chunking & embeddings")
    print("\nStarting...")
    
    # Queue the task
    result = ingest_knowledge_source.delay(SOURCE_ID)
    
    print(f"\n✓ Task queued: {result.id}")
    print(f"\nMonitor with: docker compose logs -f celery-worker")
    print("=" * 80)
