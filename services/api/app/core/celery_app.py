"""
Celery Application Configuration
"""

from celery import Celery
from app.core.config import settings

# Initialize Celery app
celery_app = Celery(
    "cadvisor",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.cad",
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3000,  # 50 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
)

# Task routes (all tasks go to default queue for now)
celery_app.conf.task_routes = {
    #"process_cad_file": {"queue": "cad_processing"},  # Disabled - using default queue
    "generate_submission_profile": {"queue": "default"},
    "reprocess_all_files": {"queue": "default"},
}
