"""
Configuration Settings
"""
from typing import List, Optional, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator, field_validator, model_validator
import os
import json


class Settings(BaseSettings):
    """Application settings"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )
    
    # Application
    APP_NAME: str = "CADVisor"
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG: bool = Field(default=True, env="DEBUG")
    LOG_LEVEL: str = Field(default="info", env="LOG_LEVEL")
    
    # API
    API_HOST: str = Field(default="0.0.0.0", env="API_HOST")
    API_PORT: int = Field(default=8000, env="API_PORT")
    API_WORKERS: int = Field(default=4, env="API_WORKERS")
    
    # Database
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    DB_POOL_SIZE: int = Field(default=20, env="DB_POOL_SIZE")
    DB_MAX_OVERFLOW: int = Field(default=40, env="DB_MAX_OVERFLOW")
    
    # Redis
    REDIS_URL: str = Field(..., env="REDIS_URL")
    
    # Security
    JWT_SECRET: str = Field(..., env="JWT_SECRET")
    JWT_ALGORITHM: str = Field(default="HS256", env="JWT_ALGORITHM")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, env="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, env="JWT_REFRESH_TOKEN_EXPIRE_DAYS")
    
    SESSION_SECRET: str = Field(..., env="SESSION_SECRET")
    
    # Password hashing (Argon2)
    PASSWORD_HASH_TIME_COST: int = Field(default=2, env="PASSWORD_HASH_TIME_COST")
    PASSWORD_HASH_MEMORY_COST: int = Field(default=65536, env="PASSWORD_HASH_MEMORY_COST")
    PASSWORD_HASH_PARALLELISM: int = Field(default=4, env="PASSWORD_HASH_PARALLELISM")
    
    # CORS - stored as string, converted to list via property
    cors_origins_str: str = Field(
        default="http://localhost:3000",
        validation_alias="CORS_ORIGINS"
    )
    CORS_CREDENTIALS: bool = Field(default=True, env="CORS_CREDENTIALS")
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Parse CORS_ORIGINS from string to list"""
        v = self.cors_origins_str
        # Handle empty string
        if not v or v.strip() == "":
            return ["http://localhost:3000"]
        # Try JSON first
        try:
            parsed = json.loads(v)
            return parsed if isinstance(parsed, list) else [str(parsed)]
        except json.JSONDecodeError:
            # Fallback to comma-separated
            return [origin.strip() for origin in v.split(',') if origin.strip()]
    
    # Trusted hosts (production)
    ALLOWED_HOSTS: List[str] = Field(default=["*"], env="ALLOWED_HOSTS")
    
    # Rate limiting
    RATE_LIMIT_AUTH_PER_MINUTE: int = Field(default=5, env="RATE_LIMIT_AUTH_PER_MINUTE")
    RATE_LIMIT_API_PER_MINUTE: int = Field(default=100, env="RATE_LIMIT_API_PER_MINUTE")
    
    # MinIO/S3 Storage
    MINIO_ENDPOINT: str = Field(..., env="MINIO_ENDPOINT")
    MINIO_EXTERNAL_ENDPOINT: str = Field(default="localhost:9002", env="MINIO_EXTERNAL_ENDPOINT")
    MINIO_ROOT_USER: Optional[str] = Field(default=None, env="MINIO_ROOT_USER")
    MINIO_ROOT_PASSWORD: Optional[str] = Field(default=None, env="MINIO_ROOT_PASSWORD")
    MINIO_ACCESS_KEY: Optional[str] = Field(default=None, env="MINIO_ACCESS_KEY")
    MINIO_SECRET_KEY: Optional[str] = Field(default=None, env="MINIO_SECRET_KEY")
    MINIO_USE_SSL: bool = Field(default=False, env="MINIO_USE_SSL")
    MINIO_BUCKET_NAME: str = Field(default="buildguard-files", env="MINIO_BUCKET_NAME")
    MINIO_REGION: str = Field(default="us-east-1", env="MINIO_REGION")
    
    # Ollama (legacy local dev only)
    OLLAMA_BASE_URL: str = Field(default="http://ollama:11434", env="OLLAMA_BASE_URL")

    # Jina AI embeddings (free tier — https://jina.ai)
    JINA_API_KEY: Optional[str] = Field(default=None, env="JINA_API_KEY")
    
    # Autodesk Platform Services (APS) - for DWG conversion
    APS_CLIENT_ID: Optional[str] = Field(default=None, env="APS_CLIENT_ID")
    APS_CLIENT_SECRET: Optional[str] = Field(default=None, env="APS_CLIENT_SECRET")
    
    # Resolved MinIO credentials (accepts either naming convention)
    @property
    def minio_access_key(self) -> str:
        return self.MINIO_ROOT_USER or self.MINIO_ACCESS_KEY or ""
    
    @property
    def minio_secret_key(self) -> str:
        return self.MINIO_ROOT_PASSWORD or self.MINIO_SECRET_KEY or ""
    
    @property
    def MINIO_BUCKET(self) -> str:
        return self.MINIO_BUCKET_NAME
    
    # File processing
    MAX_UPLOAD_SIZE_BYTES: int = Field(default=2147483648, env="MAX_UPLOAD_SIZE_BYTES")  # 2GB
    PRESIGNED_URL_EXPIRY: int = Field(default=900, env="PRESIGNED_URL_EXPIRY")  # 15 minutes
    ALLOWED_MIME_TYPES: str = Field(
        default="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,application/ifc,image/vnd.dxf,application/dxf",
        env="ALLOWED_MIME_TYPES"
    )
    
    # File scanning
    ENABLE_FILE_SCANNING: bool = Field(default=False, env="ENABLE_FILE_SCANNING")
    CLAMAV_HOST: str = Field(default="clamav", env="CLAMAV_HOST")
    CLAMAV_PORT: int = Field(default=3310, env="CLAMAV_PORT")
    
    # AI Service
    AI_SERVICE_BASE_URL: str = Field(default="http://localhost:8001", env="AI_SERVICE_BASE_URL")
    
    # Celery
    CELERY_BROKER_URL: str = Field(default="redis://redis:6379/0", env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: str = Field(default="redis://redis:6379/0", env="CELERY_RESULT_BACKEND")

    @field_validator("CELERY_BROKER_URL", "CELERY_RESULT_BACKEND", "REDIS_URL", mode="before")
    @classmethod
    def strip_redis_query_params(cls, v: str) -> str:
        """Strip query-string params (e.g. ?ssl_cert_reqs=CERT_NONE) from Redis URLs.
        SSL is configured in code via broker_use_ssl; query params confuse Kombu's
        URL parser and can corrupt hostname resolution.
        """
        if isinstance(v, str) and ("redis://" in v or "rediss://" in v):
            from urllib.parse import urlsplit, urlunsplit
            parts = urlsplit(v)
            # Rebuild without query string or fragment; ensure /0 db path
            path = parts.path if parts.path else "/0"
            return urlunsplit((parts.scheme, parts.netloc, path, "", ""))
        return v
    
    # Billing
    BILLING_PROVIDER: str = Field(default="mock", env="BILLING_PROVIDER")
    STRIPE_SECRET_KEY: Optional[str] = Field(default=None, env="STRIPE_SECRET_KEY")
    STRIPE_WEBHOOK_SECRET: Optional[str] = Field(default=None, env="STRIPE_WEBHOOK_SECRET")
    DEFAULT_TRIAL_DAYS: int = Field(default=14, env="DEFAULT_TRIAL_DAYS")
    
    # Email
    ENABLE_EMAIL_VERIFICATION: bool = Field(default=False, env="ENABLE_EMAIL_VERIFICATION")
    SMTP_HOST: Optional[str] = Field(default=None, env="SMTP_HOST")
    SMTP_PORT: int = Field(default=587, env="SMTP_PORT")
    SMTP_USER: Optional[str] = Field(default=None, env="SMTP_USER")
    SMTP_PASSWORD: Optional[str] = Field(default=None, env="SMTP_PASSWORD")
    SMTP_FROM_EMAIL: str = Field(default="noreply@buildguard.example", env="SMTP_FROM_EMAIL")
    
    # Data retention
    SOFT_DELETE_RETENTION_DAYS: int = Field(default=90, env="SOFT_DELETE_RETENTION_DAYS")
    AUDIT_LOG_RETENTION_DAYS: int = Field(default=365, env="AUDIT_LOG_RETENTION_DAYS")
    
    @validator("ALLOWED_MIME_TYPES", pre=True)
    def parse_mime_types(cls, v):
        if isinstance(v, str):
            return v
        return ",".join(v)


# Create settings instance
settings = Settings()
