"""Check metadata structure"""
import sys
sys.path.insert(0, '/app')
from sqlalchemy import create_engine, text
import os
import json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://cadvisor:cadvisor@postgres:5432/cadvisor")
engine = create_engine(DATABASE_URL)
conn = engine.connect()

result = conn.execute(text("""
SELECT file_metadata->>  'entities' as entities, 
       file_metadata->>'layers' as layers,
       file_metadata->>'views' as views
FROM files 
WHERE filename ILIKE '%.dwg' 
ORDER BY created_at DESC 
LIMIT 1
""")).fetchone()

if result:
    print("=" * 80)
    print("ENTITIES FIELD:")
    print("=" * 80)
    entities = json.loads(result[0]) if result[0] else None
    if entities:
        print(f"Total: {entities.get('total', 'N/A')}")
        print("\nEntity type counts:")
        # Show first 10 entity types
        count = 0
        for key, value in entities.items():
            if key != 'total' and count < 10:
                print(f"  {key}: {value}")
                count += 1
        print(f"\n... and {len(entities) - count - 1} more entity types")
    else:
        print("None")
    
    print("\n" + "=" * 80)
    print("LAYERS FIELD:")
    print("=" * 80)
    layers = json.loads(result[1]) if result[1] else None
    if layers:
        print(f"Count: {layers.get('count', 'N/A')}")
        print("\nLayer names (first 10):")
        layer_list = layers.get('layers', [])
        for layer in layer_list[:10]:
            if isinstance(layer, dict):
                print(f"  - {layer.get('name', 'Unknown')}")
                print(f"    Color: {layer.get('color', 'N/A')}")
                print(f"    Linetype: {layer.get('linetype', 'N/A')}")
            else:
                print(f"  - {layer}")
        if len(layer_list) > 10:
            print(f"\n... and {len(layer_list) - 10} more layers")
    else:
        print("None")
        
    print("\n" + "=" * 80)
    print("VIEWS FIELD:")
    print("=" * 80)
    views = json.loads(result[2]) if result[2] else None
    if views:
        print(f"Count: {views.get('count', 'N/A')}")
        for view in views.get('views', []):
            print(f"  - {view.get('name')} ({view.get('role')})")
    else:
        print("None")
else:
    print("No DWG files found")

conn.close()
