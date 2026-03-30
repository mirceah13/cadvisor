"""
Celery Application — single canonical instance used by all tasks and the worker.
"""

import ssl
from celery import Celery
from app.core.config import settings

_is_rediss = settings.CELERY_BROKER_URL.startswith("rediss://")
_ssl_config = {"ssl_cert_reqs": ssl.CERT_NONE} if _is_rediss else {}

celery_app = Celery(
    "cadvisor",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
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
    redis_backend_use_ssl=_ssl_config if _is_rediss else None,
    broker_connection_retry_on_startup=True,
    # Reduce Upstash command volume:
    # Heartbeat every 60s instead of default 2s (~30x fewer PUBLISH commands)
    worker_heartbeat=60,
    # Event heartbeat interval (for monitoring) — also 60s
    worker_send_task_events=False,  # disable per-task events unless needed
)
