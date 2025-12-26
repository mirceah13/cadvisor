"""
Fix stuck knowledge base documents that are at 100% but still processing
"""

import sys
sys.path.insert(0, '/app')

from app.core.database import SessionLocal
from app.models import KnowledgeSource
from sqlalchemy.orm.attributes import flag_modified

def fix_stuck_documents():
    db = SessionLocal()
    try:
        # Find all sources with status = "processing"
        stuck_sources = db.query(KnowledgeSource).filter(
            KnowledgeSource.status == "processing"
        ).all()
        
        fixed_count = 0
        
        for source in stuck_sources:
            # Check if it has progress indicating completion
            if source.meta_data and source.meta_data.get("progress"):
                progress = source.meta_data["progress"]
                total = progress.get("total_chunks", 0)
                processed = progress.get("processed_chunks", 0)
                
                # If at 100% or in embedding stage with all chunks processed
                if total > 0 and processed >= total:
                    print(f"Fixing source: {source.id} - {source.title}")
                    
                    # Update to indexed status
                    source.status = "indexed"
                    source.meta_data["progress"] = {
                        "stage": "complete",
                        "total_chunks": total,
                        "processed_chunks": total,
                        "message": "Processing complete"
                    }
                    flag_modified(source, "meta_data")
                    fixed_count += 1
        
        if fixed_count > 0:
            db.commit()
            print(f"\n✅ Fixed {fixed_count} stuck document(s)")
        else:
            print("\n✅ No stuck documents found")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("🔧 Checking for stuck knowledge base documents...\n")
    fix_stuck_documents()
