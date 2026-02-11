# CAD File Data Extraction Summary

## Overview
CAD files (DWG/DXF/IFC) are automatically parsed on upload. The data extraction happens in background Celery tasks and results are stored in `files.parsed_metadata` (PostgreSQL JSONB column).

---

## DWG File Processing Flow

### 1. Upload & Trigger
- **When:** Immediately after file upload completes
- **Trigger:** `process_cad_file.delay(file_id)` called automatically
- **Location:** `services/api/app/api/v1/endpoints/files.py:244`

### 2. Conversion (APS)
- **What:** DWG → DXF conversion using Autodesk Platform Services
- **Why:** LibreDWG has ~60% success rate with corruption issues
- **APS Success Rate:** 100% (supports all DWG versions R2.5 to 2024)
- **Output:** Clean DXF file for parsing

### 3. Extraction (ezdxf)
After APS creates DXF, `ezdxf` library extracts:

#### **Layers** (`_extract_layers`)
```json
{
  "count": 45,
  "layers": [
    {
      "name": "0",
      "color": 7,
      "linetype": "CONTINUOUS",
      "is_locked": false,
      "is_off": false
    },
    {
      "name": "WALLS",
      "color": 1,
      "linetype": "CONTINUOUS",
      "is_locked": false,
      "is_off": false
    }
  ]
}
```

#### **Blocks** (`_extract_blocks`)
Reusable components (doors, windows, furniture, symbols):
```json
{
  "count": 23,
  "blocks": [
    {
      "name": "DOOR_90",
      "entity_count": 12
    },
    {
      "name": "WINDOW_120x150",
      "entity_count": 8
    }
  ]
}
```

#### **Entities** (`_count_entities`)
Geometry primitives by type:
```json
{
  "LINE": 3456,
  "LWPOLYLINE": 892,
  "CIRCLE": 134,
  "ARC": 267,
  "TEXT": 189,
  "MTEXT": 45,
  "INSERT": 234,
  "HATCH": 56,
  "DIMENSION": 78,
  "SPLINE": 23,
  "ELLIPSE": 12
}
```

**Key Entity Types:**
- `LINE` - Straight lines (walls, structure)
- `LWPOLYLINE` - Connected line segments (room boundaries)
- `CIRCLE` / `ARC` - Curved elements
- `HATCH` - Filled areas (materials, zones)
- `INSERT` - Block references (doors, windows placed in drawing)
- `DIMENSION` - Measurement annotations
- `TEXT` / `MTEXT` - Text annotations

#### **Text Annotations** (`_extract_text`)
All text in drawing with layer information:
```json
{
  "count": 189,
  "sample_texts": [
    {
      "content": "ETAJ 1 - CORP C1",
      "layer": "TEXT"
    },
    {
      "content": "Suprafata: 125.5 m²",
      "layer": "ANNOTATIONS"
    },
    {
      "content": "Rezistenta la foc: REI 90",
      "layer": "FIRE_SAFETY"
    }
  ]
}
```

#### **Dimensions** (`_extract_dimensions`)
Measurement annotations:
```json
{
  "count": 78,
  "has_dimensions": true
}
```

#### **Viewports/Layouts** (`_extract_viewport_info`)
Paper space layouts (plot sheets):
```json
{
  "layout_count": 4,
  "layouts": [
    {
      "name": "Model",
      "entity_count": 4523
    },
    {
      "name": "Layout1",
      "entity_count": 89
    }
  ]
}
```

---

## IFC File Extraction

IFC files use `IfcOpenShell` library and extract:

### Building Information
```json
{
  "file_schema": "IFC4",
  "project_name": "Residential Complex",
  "building": {
    "name": "Building A",
    "elevation": 125.5,
    "address": {
      "street": "Strada Principală 123",
      "city": "București",
      "postal_code": "010203"
    }
  }
}
```

### Storeys (Floors)
```json
{
  "storeys": {
    "count": 5,
    "storeys": [
      {"name": "Ground Floor", "elevation": 0.0},
      {"name": "First Floor", "elevation": 3.2},
      {"name": "Second Floor", "elevation": 6.4}
    ]
  }
}
```

### Spaces (Rooms)
```json
{
  "spaces": {
    "count": 34,
    "spaces": [
      {"name": "Living Room", "long_name": "Apartament 1 - Sufragerie"},
      {"name": "Kitchen", "long_name": "Apartament 1 - Bucătărie"}
    ]
  }
}
```

### Elements (Building Components)
```json
{
  "elements": {
    "wall": 245,
    "door": 67,
    "window": 89,
    "slab": 12,
    "stair": 3,
    "column": 34,
    "beam": 56
  }
}
```

### Systems Detection
```json
{
  "systems": {
    "electrical": true,
    "plumbing": true,
    "hvac": true,
    "fire_protection": false
  }
}
```

### Quantities (if available)
```json
{
  "quantities": {
    "wall_count": 245,
    "slab_count": 12,
    "estimated_wall_area_sqm": "requires_shape_processing",
    "estimated_floor_area_sqm": "requires_shape_processing"
  }
}
```

---

## Viewing Extracted Data

### 1. Via API
```bash
GET /api/v1/files/{file_id}
```

Response includes `file_metadata` field with all parsed data:
```json
{
  "id": "f990cd8d-1bd8-438f-8219-7157fa705eb2",
  "filename": "A.05 PLAN ETAJ 1 - CORP C1.dwg",
  "mime_type": "application/acad",
  "file_metadata": {
    "type": "dwg",
    "data": {
      "processing_status": "completed",
      "source_format": "dwg",
      "dxf_version": "AC1027",
      "layers": { ... },
      "blocks": { ... },
      "entities": { ... },
      "text_annotations": { ... },
      "dimensions": { ... }
    }
  }
}
```

### 2. Via Database Query
```sql
SELECT 
  filename,
  parsed_metadata->'data'->'layers'->'count' as layer_count,
  parsed_metadata->'data'->'entities' as entities,
  parsed_metadata->'data'->'text_annotations'->'count' as text_count
FROM files 
WHERE id = 'f990cd8d-1bd8-438f-8219-7157fa705eb2';
```

### 3. Monitor Processing in Real-Time
```powershell
# Watch Celery worker logs
docker-compose logs -f celery-worker | Select-String "process_cad_file|APS|metadata"
```

Expected output:
```
[INFO] Starting CAD file processing for file_id=...
[INFO] Converting DWG to DXF: /tmp/...
[INFO] Attempting conversion with Autodesk Platform Services (APS)...
[INFO] APS authentication successful
[INFO] File uploaded to bucket: ...
[INFO] APS translation status: inprogress (35%)
[INFO] APS translation status: inprogress (70%)
[INFO] APS translation status: success (100%)
[INFO] APS API conversion succeeded
[INFO] Extracting metadata from parsed document...
[INFO] Metadata extraction complete: 45 layers, 4523 entities
[INFO] Successfully parsed CAD file
[INFO] Updating file metadata with 8 keys
[INFO] Successfully committed metadata to database
```

---

## Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Upload trigger | `services/api/app/api/v1/endpoints/files.py` | 244-251 |
| Celery task | `services/api/app/tasks/cad.py` | 39-152 |
| APS conversion | `services/api/app/services/cad_parser.py` | 384-597 |
| DXF extraction | `services/api/app/services/cad_parser.py` | 630-900 |
| Layer extraction | `services/api/app/services/cad_parser.py` | 809-824 |
| Block extraction | `services/api/app/services/cad_parser.py` | 826-841 |
| Entity counting | `services/api/app/services/cad_parser.py` | 843-854 |
| Text extraction | `services/api/app/services/cad_parser.py` | 856-871 |
| IFC parsing | `services/api/app/services/cad_parser.py` | 18-199 |

---

## Summary

✅ **Parsing happens:** Automatically on upload  
✅ **APS usage:** Converts DWG → DXF (100% reliable)  
✅ **Geometry extraction:** ezdxf parses DXF and extracts:
- Layers (names, colors, properties)
- Blocks (reusable components)
- Entities (geometry primitives - lines, polylines, circles, etc.)
- Text annotations (with content and layer)
- Dimensions (measurements)
- Viewport/layout information

✅ **Storage:** All data saved to `files.parsed_metadata` JSONB column  
✅ **Access:** Available via API, database queries, submission profiles

**Important:** APS is only for conversion. The actual geometry artifacts, quotas, dimensions, text, and layer data are extracted by **ezdxf** after conversion completes.
