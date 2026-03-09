"""
Celery Worker entry-point.
Re-exports the canonical celery_app so the worker start command
`celery -A app.worker.celery_app worker` works correctly.
"""

# Single source of truth — all tasks already registered via `include=` in core/celery_app.py
from app.core.celery_app import celery_app  # noqa: F401
