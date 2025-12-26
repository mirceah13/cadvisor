# Knowledge Base Upload System - Complete Guide

## ✅ **GOOD NEWS: Everything is Already Implemented!**

Your KB upload system is **fully functional** and ready to use. Here's what's available:

---

## 🎯 System Overview

### **What's Already Working**

#### 1. **Backend API** ✅
- **Location**: `services/api/app/api/v1/endpoints/kb.py`
- **Endpoints**:
  - `POST /api/v1/kb/sources` - Upload KB documents
  - `GET /api/v1/kb/sources` - List all KB sources
  - `GET /api/v1/kb/sources/{id}` - Get specific source
  - `DELETE /api/v1/kb/sources/{id}` - Delete source
  - `POST /api/v1/kb/sources/{id}/reingest` - Re-process document
  - `POST /api/v1/kb/search` - Semantic search
  - `GET /api/v1/kb/stats` - KB statistics

#### 2. **Document Parsers** ✅
- **Location**: `services/api/app/services/cad_parser.py`
- **Supported Formats**:
  - ✅ PDF (via PyPDF2)
  - ✅ DOCX (via python-docx)
  - ✅ TXT (plain text)
- **All dependencies installed** in `requirements.txt`

#### 3. **Celery Tasks** ✅
- **Location**: `services/api/app/tasks/kb.py`
- **Task**: `ingest_knowledge_source`
- **Process**:
  1. Download file from MinIO
  2. Extract text (PDF/DOCX/TXT)
  3. Chunk text intelligently
  4. Generate embeddings (nomic-embed-text)
  5. Store chunks with vectors in PostgreSQL
  6. Update status and progress

#### 4. **Chunking Service** ✅
- **Location**: `services/api/app/services/chunking.py`
- **Strategies**:
  - `general_documents()` - General text
  - `code_standards()` - Building codes (hierarchical)
  - `technical_specs()` - Technical specifications
- **Features**:
  - Smart section detection
  - Context preservation
  - Configurable chunk size
  - Overlap for continuity

#### 5. **Frontend UI** ✅
- **Upload Page**: `apps/web/src/app/knowledge-base/upload/page.tsx`
- **List Page**: `apps/web/src/app/knowledge-base/page.tsx`
- **Detail Page**: `apps/web/src/app/knowledge-base/[id]/page.tsx`
- **Dashboard**: `apps/web/src/app/knowledge-base/dashboard/page.tsx`

#### 6. **Vector Search** ✅
- **pgvector** integration working
- **Cosine similarity** search
- **Category filtering** (building_code, accessibility, fire_safety, etc.)
- **Minimum similarity threshold** configurable

---

## 📋 How to Use the KB Upload System

### **Method 1: Via Frontend UI (Recommended)**

1. **Navigate to Knowledge Base**
   ```
   http://localhost:3000/knowledge-base
   ```

2. **Click "Upload Document"**
   - Takes you to `/knowledge-base/upload`

3. **Fill in the Form**:
   - **File**: Select PDF/DOCX/TXT
   - **Title**: Document title (auto-fills from filename)
   - **Description**: Optional description
   - **Category**: Select category
     - Building Code
     - Accessibility
     - Fire Safety
     - Electrical Code
     - Plumbing Code
     - Mechanical/HVAC
     - Energy Efficiency

4. **Submit**
   - File uploads to MinIO
   - KB source record created
   - Celery task processes document in background
   - Status updates show progress

5. **Monitor Processing**
   - View status on KB list page
   - Status: `uploaded` → `processing` → `indexed`
   - See chunks count when complete

### **Method 2: Via API (Programmatic)**

```bash
# Step 1: Upload file
curl -X POST http://localhost:8000/api/v1/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@IBC_2021.pdf"

# Response: { "id": "file-uuid" }

# Step 2: Create KB source
curl -X POST http://localhost:8000/api/v1/kb/sources \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "International Building Code 2021",
    "source_type": "document",
    "category": "building_code",
    "file_id": "file-uuid"
  }'

# Response: KB source with processing status
```

### **Method 3: Direct Text Upload**

```bash
curl -X POST http://localhost:8000/api/v1/kb/sources \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Custom Building Requirements",
    "source_type": "text",
    "category": "building_code",
    "content": "Your text content here..."
  }'
```

---

## 🔍 Testing the System

### **Test 1: Upload a Real Building Code PDF**

1. Download a sample building code PDF (e.g., IBC 2021 excerpt)
2. Go to `http://localhost:3000/knowledge-base/upload`
3. Upload the PDF
4. Select category "Building Code"
5. Submit
6. Check status on KB list page
7. Wait for "indexed" status
8. Verify chunks created in database:

```bash
docker exec cadvisor-postgres psql -U cadvisor -d cadvisor -c "
  SELECT 
    ks.title, 
    ks.status, 
    ks.category,
    COUNT(kbc.id) as chunk_count
  FROM knowledge_sources ks
  LEFT JOIN kb_chunks kbc ON kbc.knowledge_source_id = ks.id
  GROUP BY ks.id, ks.title, ks.status, ks.category
  ORDER BY ks.created_at DESC;
"
```

### **Test 2: Search Your Uploaded Document**

```bash
curl -X POST http://localhost:8000/api/v1/kb/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "egress requirements",
    "limit": 5,
    "category": "building_code",
    "min_similarity": 0.5
  }'
```

### **Test 3: Run Analysis Using Uploaded KB**

1. Upload a CAD file via UI
2. Trigger analysis
3. LLM will use your uploaded KB documents
4. Findings will reference your uploaded codes

---

## 📊 Current KB Status

```bash
# Check existing KB sources
docker exec cadvisor-postgres psql -U cadvisor -d cadvisor -c "
  SELECT title, source_type, category, status 
  FROM knowledge_sources 
  ORDER BY created_at DESC;
"
```

**Your current KB sources**:
1. Fire Safety Code (indexed)
2. General Building Requirements (indexed)
3. Accessibility Requirements - ADA Compliance (indexed)
4. Romanian Fire Safety Standards (indexed)

---

## 🔧 How the System Works (Technical Flow)

```
┌─────────────────┐
│  User Uploads   │
│  PDF/DOCX/TXT   │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────┐
│  1. File Upload API                     │
│  - Stores file in MinIO                 │
│  - Creates File record                  │
│  - Returns file_id                      │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  2. Create KB Source                    │
│  - POST /api/v1/kb/sources              │
│  - Creates KnowledgeSource record       │
│  - Status: "uploaded"                   │
│  - Triggers Celery task                 │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  3. Celery Task: ingest_knowledge_source│
│                                         │
│  a) Download file from MinIO            │
│  b) Extract text based on type:         │
│     - PDF → PyPDF2                      │
│     - DOCX → python-docx                │
│     - TXT → direct read                 │
│                                         │
│  Status: "processing"                   │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  4. Chunking Service                    │
│  - Select strategy based on category:   │
│    * building_code → code_standards()   │
│    * general → general_documents()      │
│  - Split text into chunks (500-800 char)│
│  - Preserve context and structure       │
│  - Store metadata (section, headings)   │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  5. Embedding Generation                │
│  - For each chunk:                      │
│    * Call Ollama API (nomic-embed-text) │
│    * Generate 768-dim vector            │
│    * Store in PostgreSQL with pgvector  │
│  - Update progress in metadata          │
└────────┬────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  6. Store Chunks in Database            │
│  - Create KBChunk records               │
│  - Store: text, embedding, metadata     │
│  - Link to KnowledgeSource              │
│  - Update chunks_count                  │
│                                         │
│  Status: "indexed" ✅                   │
└─────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│  7. Ready for Analysis!                 │
│  - Chunks are now searchable            │
│  - Vector similarity search enabled     │
│  - LLM can retrieve relevant sections   │
└─────────────────────────────────────────┘
```

---

## 🎯 Categories Supported

When uploading, choose the appropriate category:

| Category | Description | Use Case |
|----------|-------------|----------|
| `building_code` | General building codes (IBC, IRC, etc.) | Structural, foundation, general compliance |
| `accessibility` | ADA and accessibility standards | Ramps, elevators, parking, entrances |
| `fire_safety` | Fire protection codes (NFPA, etc.) | Sprinklers, fire walls, exits, compartments |
| `electrical` | Electrical codes (NEC, etc.) | Wiring, panels, loads, safety |
| `plumbing` | Plumbing codes (IPC, UPC, etc.) | Pipes, fixtures, drainage, water supply |
| `mechanical` | HVAC and mechanical systems | Ventilation, heating, cooling, ducts |
| `energy` | Energy efficiency standards | Insulation, HVAC efficiency, lighting |

---

## 🐛 Troubleshooting

### **Issue: Document stuck in "processing"**

**Check Celery logs**:
```bash
docker logs cadvisor-celery-worker --tail 50
```

**Check for errors**:
```bash
docker exec cadvisor-postgres psql -U cadvisor -d cadvisor -c "
  SELECT id, title, status, metadata->'error' 
  FROM knowledge_sources 
  WHERE status = 'failed';
"
```

**Fix**: Reingest the document
```bash
curl -X POST http://localhost:8000/api/v1/kb/sources/{source_id}/reingest \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **Issue: No chunks created**

**Verify text extraction worked**:
- Check if PDF is readable (not scanned image)
- Try opening PDF manually to verify text
- Check file size isn't too large

**Reingest with logging**:
```bash
# Check celery logs during processing
docker logs -f cadvisor-celery-worker
```

### **Issue: Search returns no results**

**Check similarity threshold**:
```python
# Lower threshold if needed
results = await kb_service.semantic_search(
    query="your query",
    org_id=org_id,
    min_similarity=0.3  # Lower from 0.5
)
```

**Verify chunks exist**:
```bash
docker exec cadvisor-postgres psql -U cadvisor -d cadvisor -c "
  SELECT COUNT(*) FROM kb_chunks WHERE org_id = 'your-org-id';
"
```

---

## 🚀 Next Steps

### **Production Recommendations**

1. **Add More Building Codes**
   - Upload IBC 2021
   - Upload NFPA codes
   - Upload local jurisdiction codes
   - Upload ADA standards

2. **Enhance Chunking for Building Codes**
   - Current chunking works well
   - Could add section-aware chunking
   - Preserve code section numbers
   - Keep requirement lists together

3. **Add Document Versioning**
   - Track code version/year
   - Allow multiple versions
   - Filter by edition date

4. **Improve Search**
   - Hybrid search (semantic + keyword)
   - Multi-category search
   - Code section lookup by number

5. **Add Document Preview**
   - Show extracted text in UI
   - Preview chunks before indexing
   - Edit/cleanup text if needed

---

## 📝 Example: Upload IBC 2021

### **Step-by-Step**

1. **Obtain IBC 2021 PDF** (excerpt or full)

2. **Upload via UI**:
   - Go to `http://localhost:3000/knowledge-base/upload`
   - Select IBC PDF file
   - Title: "International Building Code 2021"
   - Description: "IBC 2021 - Chapters 1-10"
   - Category: "Building Code"
   - Submit

3. **Monitor Processing**:
   ```bash
   # Watch celery logs
   docker logs -f cadvisor-celery-worker
   
   # Check status
   curl http://localhost:8000/api/v1/kb/sources \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

4. **Test Search**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/kb/search \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "query": "fire rated walls requirements",
       "limit": 5,
       "category": "building_code"
     }'
   ```

5. **Run Analysis**:
   - Upload CAD file
   - Trigger analysis
   - LLM will cite IBC 2021 in findings!

---

## ✅ Summary

**Your KB upload system is COMPLETE and FUNCTIONAL!**

✅ Backend API working  
✅ PDF/DOCX/TXT parsers ready  
✅ Celery tasks processing documents  
✅ Smart chunking implemented  
✅ Embeddings generation working  
✅ Vector search operational  
✅ Frontend UI ready  
✅ Analysis using uploaded KB  

**You can start uploading building codes RIGHT NOW!**

Just navigate to:
```
http://localhost:3000/knowledge-base/upload
```

Upload your building code PDFs and they'll be automatically:
1. Parsed and extracted
2. Intelligently chunked
3. Embedded with vectors
4. Made searchable
5. Used by LLM for analysis

**No additional implementation needed!** 🎉
