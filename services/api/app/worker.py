"""
Celery Worker Configuration
"""
import ssl
from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "buildguard",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# SSL config for rediss:// (Upstash requires TLS)
_is_rediss = settings.CELERY_BROKER_URL.startswith("rediss://")
_ssl_config = {"ssl_cert_reqs": ssl.CERT_NONE} if _is_rediss else {}

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour
    task_soft_time_limit=3300,  # 55 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    broker_use_ssl=_ssl_config if _is_rediss else None,
    redis_backend_use_ssl=_ssl_config if _is_rediss else None,
)

# Import all task modules to register them with this celery_app instance
from app.tasks import file_tasks, kb_tasks, analysis_tasks, report_tasks  # noqa: F401
from app.tasks import cad, kb, analysis  # noqa: F401

# Auto-discover tasks
celery_app.autodiscover_tasks([
    "app.tasks.cad",
    "app.tasks.kb",
    "app.tasks.analysis",
    "app.tasks.file_tasks",
    "app.tasks.kb_tasks",
    "app.tasks.analysis_tasks",
    "app.tasks.report_tasks",
])
