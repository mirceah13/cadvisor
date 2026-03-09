# Re-export the real implementation from app.tasks.kb
from app.tasks.kb import ingest_knowledge_source

__all__ = ["ingest_knowledge_source"]
