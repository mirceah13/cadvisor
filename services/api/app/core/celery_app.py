"""
Celery Application — single canonical instance used by all tasks and the worker.
"""

import re
import ssl
from celery import Celery
from app.core.config import settings

_is_rediss = settings.CELERY_BROKER_URL.startswith("rediss://")
_ssl_config = {"ssl_cert_reqs": ssl.CERT_NONE} if _is_rediss else {}


def _db_result_backend(db_url: str) -> str:
    """Convert DATABASE_URL to a Celery SQLAlchemy result backend URL.

    Uses PostgreSQL instead of Redis for the result backend to avoid
    redis-py 5.x SSL compatibility issues on the backend connection.
    psycopg2-binary is already installed and the DB connection is proven.
    """
    # Strip params unsupported by psycopg2 (channel_binding) but keep sslmode
    url = re.sub(r"[?&]channel_binding=[^&]*", "", db_url)
    url = re.sub(r"\?&", "?", url)  # fix ?& artefact
    url = re.sub(r"\?$", "", url)   # trim trailing ?
    return "db+" + url


_result_backend = _db_result_backend(settings.DATABASE_URL)

celery_app = Celery(
    "cadvisor",
    broker=settings.CELERY_BROKER_URL,
    backend=_result_backend,
    include=[
        "app.tasks.cad",
        "app.tasks.kb",
        "app.tasks.analysis",
        "app.tasks.file_tasks",
        "app.tasks.kb_tasks",
        "app.tasks.analysis_tasks",
        "app.tasks.report_tasks",
    ]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,
    task_soft_time_limit=3300,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    broker_use_ssl=_ssl_config if _is_rediss else None,
    broker_connection_retry_on_startup=True,
)
