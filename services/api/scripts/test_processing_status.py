#!/usr/bin/env python3
"""Test the processing-status endpoint"""
import sys
sys.path.insert(0, '/app')

from app.core.database import SessionLocal
from app.models import Submission, File
from sqlalchemy import desc
import json

db = SessionLocal()

# Get the most recent submission with files
submission = db.query(Submission).order_by(desc(Submission.created_at)).first()

if not submission:
    print("No submissions found")
    sys.exit(0)

print(f"Submission ID: {submission.id}")
print(f"Submission Name: {submission.name}")
print("\nFiles in this submission:")

files = db.query(File).filter(
    File.submission_id == submission.id,
    File.deleted_at.is_(None)
).all()

for file in files:
    print(f"\n  File: {file.filename}")
    print(f"  ID: {file.id}")
    print(f"  Created: {file.created_at}")
    
    if file.parsed_metadata:
        status = file.parsed_metadata.get('processing_status', 'unknown')
        print(f"  Processing Status: {status}")
    else:
        print(f"  Processing Status: No metadata (pending)")

print("\n\nWhat the API endpoint would return:")
print("=========================================")

file_statuses = []
for file in files:
    parsed_metadata = file.parsed_metadata or {}
    file_statuses.append({
        "file_id": str(file.id),
        "filename": file.filename,
        "mime_type": file.mime_type,
        "processing_status": parsed_metadata.get("processing_status", "pending"),
        "task_id": parsed_metadata.get("processing_task_id"),
        "error": parsed_metadata.get("processing_error"),
    })

print(json.dumps(file_statuses, indent=2))

db.close()
