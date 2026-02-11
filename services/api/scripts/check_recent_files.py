#!/usr/bin/env python3
"""Check recent file uploads and their parsing status"""
import sys
sys.path.insert(0, '/app')

from app.core.database import SessionLocal
from app.models import File
from sqlalchemy import desc
import json

db = SessionLocal()
try:
    recent_files = db.query(File).filter(File.is_deleted == False).order_by(desc(File.created_at)).limit(3).all()
    
    if not recent_files:
        print("No files found")
        sys.exit(0)
    
    for i, file in enumerate(recent_files, 1):
        print(f'\n{"="*60}')
        print(f'File {i}')
        print(f'{"="*60}')
        print(f'ID: {file.id}')
        print(f'Filename: {file.filename}')
        print(f'MIME Type: {file.mime_type}')
        print(f'Size: {file.size_bytes:,} bytes')
        print(f'Created: {file.created_at}')
        print(f'Submission: {file.submission_id}')
        
        if file.parsed_metadata:
            parsed = file.parsed_metadata
            
            status = parsed.get('processing_status', 'unknown')
            print(f'\nProcessing Status: {status.upper()}')
            
            # Show basic stats
            if 'pages' in parsed:
                print(f'Pages: {parsed["pages"]}')
            if 'char_count' in parsed:
                print(f'Characters: {parsed["char_count"]:,}')
            if 'text_blocks' in parsed:
                print(f'Text Blocks: {len(parsed["text_blocks"])}')
            if 'images' in parsed:
                print(f'Images Extracted: {len(parsed["images"])}')
            if 'tables' in parsed:
                print(f'Tables Detected: {len(parsed["tables"])}')
            if 'legends' in parsed:
                print(f'Legends Found: {len(parsed["legends"])}')
            
            # Fire safety data
            if 'fire_safety_data' in parsed:
                fs_data = parsed['fire_safety_data']
                print(f'\nFire Safety Data:')
                if 'rei_codes' in fs_data:
                    print(f'  REI Codes: {len(fs_data["rei_codes"])}')
                if 'compartments' in fs_data:
                    print(f'  Compartments: {len(fs_data["compartments"])}')
                if 'egress_routes' in fs_data:
                    print(f'  Egress Routes: {len(fs_data["egress_routes"])}')
            
            # Parsing log
            if 'parsing_log' in parsed:
                print(f'\nParsing Log (last 10 lines):')
                log = parsed['parsing_log']
                for line in log[-10:]:
                    print(f'  {line}')
            
            # Errors
            if 'error' in parsed:
                print(f'\n❌ ERROR: {parsed["error"]}')
            if 'message' in parsed:
                print(f'Message: {parsed["message"]}')
            
            # Show text extraction method
            if 'text_extraction_method' in parsed:
                print(f'\nExtraction Method: {parsed["text_extraction_method"]}')
        else:
            print('\n⏳ Status: Waiting for parsing to start...')
            
finally:
    db.close()
