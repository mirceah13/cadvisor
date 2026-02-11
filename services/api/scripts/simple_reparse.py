"""Simple script to trigger reparse of latest DWG file"""
import sys
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os

# Create database engine
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cadvisor:cadvisor@postgres:5432/cadvisor")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

db = SessionLocal()

# Get most recent DWG file
query = text("""
SELECT id, filename, storage_key, created_at 
FROM files 
WHERE filename ILIKE '%.dwg' 
ORDER BY created_at DESC 
LIMIT 1
""")

result = db.execute(query)
file = result.fetchone()

if file:
    print(f"Latest DWG file:")
    print(f"  ID: {file[0]}")
    print(f"  Filename: {file[1]}")
    print(f"  Storage Key: {file[2]}")
    print(f"  Created: {file[3]}")
    
    # Trigger Celery task
    from app.tasks.cad import process_cad_file
    
    print(f"\nTriggering reparse task...")
    task = process_cad_file.delay(str(file[0]))
    print(f"Task ID: {task.id}")
    print(f"Task status: {task.status}")
else:
    print("No DWG files found")

db.close()
