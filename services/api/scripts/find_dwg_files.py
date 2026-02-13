#!/usr/bin/env python3
import sys
sys.path.insert(0, '/app')

from app.core.database import SessionLocal
from app.models import File
from sqlalchemy import desc

db = SessionLocal()
files = db.query(File).filter(
    File.filename.like('%ETAJ%'),
    File.deleted_at.is_(None)
).order_by(desc(File.created_at)).limit(5).all()

print(f"Found {len(files)} files matching 'ETAJ':\n")
for f in files:
    status = f.parsed_metadata.get("processing_status") if f.parsed_metadata else "No metadata"
    print(f'File ID: {f.id}')
    print(f'Submission: {f.submission_id}')
    print(f'Created: {f.created_at}')
    print(f'Status: {status}')
    print()

db.close()
