"""
AI Service Configuration
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """AI Service settings"""

    # LLM backend — Groq (production) OR Ollama (local dev)
    # Groq: https://console.groq.com → API Keys
    GROQ_API_KEY: Optional[str] = Field(default=None, env="GROQ_API_KEY")

    # Ollama (optional — local dev only; not used when GROQ_API_KEY is set)
    OLLAMA_BASE_URL: Optional[str] = Field(default="http://localhost:11434", env="OLLAMA_BASE_URL")

    DEFAULT_LLM_MODEL: str = Field(default="llama-3.3-70b-versatile", env="DEFAULT_LLM_MODEL")
    DEFAULT_EMBEDDING_MODEL: str = Field(default="nomic-embed-text", env="DEFAULT_EMBEDDING_MODEL")

    @property
    def use_groq(self) -> bool:
        return bool(self.GROQ_API_KEY)

    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    
    # Redis
    REDIS_URL: str = Field(..., env="REDIS_URL")
    
    # Chunking
    CHUNK_SIZE: int = Field(default=1000, env="CHUNK_SIZE")
    CHUNK_OVERLAP: int = Field(default=200, env="CHUNK_OVERLAP")
    
    # RAG
    RAG_TOP_K: int = Field(default=10, env="RAG_TOP_K")
    RAG_SIMILARITY_THRESHOLD: float = Field(default=0.7, env="RAG_SIMILARITY_THRESHOLD")
    RAG_MAX_CONTEXT_LENGTH: int = Field(default=8000, env="RAG_MAX_CONTEXT_LENGTH")
    
    # Embeddings
    EMBEDDING_DIMENSION: int = Field(default=768, env="EMBEDDING_DIMENSION")
    
    # Logging
    LOG_LEVEL: str = Field(default="info", env="LOG_LEVEL")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
