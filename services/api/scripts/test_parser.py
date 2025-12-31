"""
Test CAD parser directly
"""
import logging
logging.basicConfig(level=logging.INFO)

from app.core.database import SessionLocal
from app.models import File
from app.services.cad_parser import CADParserService
from app.services.storage import StorageService
from uuid import UUID
import tempfile
import requests

file_id = "f990cd8d-1bd8-438f-8219-7157fa705eb2"

db = SessionLocal()

try:
    # Get file
    file = db.query(File).filter(File.id == UUID(file_id)).first()
    print(f"Found file: {file.filename}, storage_key: {file.storage_key}")
    
    # Download file
    storage = StorageService()
    download_url = storage.generate_download_url(file.storage_key, expires_minutes=60)
    print(f"Download URL generated: {download_url[:100]}...")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        file_path = tmp.name
        response = requests.get(download_url, stream=True)
        response.raise_for_status()
        
        for chunk in response.iter_content(chunk_size=8192):
            tmp.write(chunk)
    
    print(f"Downloaded to: {file_path}")
    
    # Parse
    parser = CADParserService()
    parsed_data = parser.parse_file(file_path, file.mime_type)
    
    print(f"Parsed data type: {parsed_data.get('type')}")
    if parsed_data.get('type') == 'dwg':
        print(f"DWG data keys: {list(parsed_data.get('data', {}).keys())}")
    
finally:
    db.close()
