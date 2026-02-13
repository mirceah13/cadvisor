"""Force reparse the most recent DWG file to test new extraction methods."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.services.cad_parser import DXFParser
import json

# Create database connection
engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Get the most recent DWG file
query = text("""
    SELECT id, filename, storage_key 
    FROM files 
    WHERE filename LIKE '%.dwg' 
    ORDER BY created_at DESC 
    LIMIT 1
""")

result = session.execute(query)
file_record = result.fetchone()

if not file_record:
    print("❌ No DWG files found")
    sys.exit(1)

file_id, filename, storage_key = file_record
print(f"🔄 Re-parsing: {filename}")
print(f"📁 File ID: {file_id}")
print(f"🗂️  Storage key: {storage_key}")

# Construct file path - storage_key already has orgs/.../uploads/ prefix
file_path = f"/app/{storage_key}"

if not os.path.exists(file_path):
    print(f"❌ File not found at: {file_path}")
    sys.exit(1)

print(f"✓ Found file at: {file_path}")
print(f"📦 Size: {os.path.getsize(file_path)} bytes")

# Parse with new enhanced code
print("\n🚀 Starting enhanced APS extraction...")
parser = DXFParser()
metadata = parser.parse_dxf_file(file_path)

if not metadata:
    print("❌ Parsing failed!")
    sys.exit(1)

# Show extraction method
extraction_method = metadata.get('extraction_method', 'unknown')
has_hierarchy = 'hierarchy' in metadata
entity_count = metadata.get('entities', {}).get('total', 0)
layer_count = metadata.get('layers', {}).get('count', 0)

print(f"\n✅ Extraction completed!")
print(f"  Method: {extraction_method}")
print(f"  Hierarchy: {'YES ✓' if has_hierarchy else 'NO ✗'}")
print(f"  Entities: {entity_count}")
print(f"  Layers: {layer_count}")

if has_hierarchy:
    hierarchy_info = metadata['hierarchy']
    print(f"\n🌳 Hierarchy Details:")
    print(f"  Total nodes: {hierarchy_info.get('total_nodes', 0)}")
    print(f"  Tree depth: {len(hierarchy_info.get('tree', []))} root nodes")

# Update database
update_query = text("""
    UPDATE files 
    SET file_metadata = :metadata::jsonb,
        updated_at = NOW()
    WHERE id = :file_id
""")

session.execute(update_query, {
    'metadata': json.dumps(metadata),
    'file_id': file_id
})
session.commit()

print(f"\n💾 Database updated successfully!")
print(f"\n📊 Check the file details page to see the new hierarchy data")

session.close()
