"""
Script to manually trigger CAD file processing
"""
import sys
from uuid import UUID

# Trigger processing for the DWG file
file_id = "f990cd8d-1bd8-438f-8219-7157fa705eb2"

# Import Celery task
from app.tasks.cad import process_cad_file

# Queue the task
task = process_cad_file.delay(file_id)

print(f"Queued CAD processing task for file {file_id}")
print(f"Task ID: {task.id}")
print(f"Check task status with: docker exec cadvisor-celery-worker celery -A app.worker inspect active")
