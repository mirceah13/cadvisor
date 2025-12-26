# Knowledge Base Implementation Guide

## Current State ✅

### What's Working
- ✅ Vector search with pgvector (cosine similarity)
- ✅ LLM analysis with Ollama (llama3.2:3b)
- ✅ Embedding generation (nomic-embed-text)
- ✅ Findings generation from KB content
- ✅ KB seeding via script for testing

### What's Real vs. Dummy
- **REAL**: All findings are LLM-generated based on actual KB content
- **REAL**: Vector similarity search retrieves relevant code sections
- **REAL**: LLM reads building codes and compares against submission
- **DUMMY**: KB content manually seeded via script (not uploaded through UI)

---

## Missing Functionality for Production 🔧

### 1. KB Document Upload API

**Location**: `services/api/app/api/v1/knowledge_base.py`

**What to Implement**:

```python
@router.post("/sources")
async def upload_kb_document(
    file: UploadFile,
    title: str = Form(...),
    category: str = Form(...),  # building_code, accessibility, fire_safety, etc.
    org_id: UUID = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a building code/regulation document
    
    Flow:
    1. Save file to storage
    2. Extract text from PDF/DOCX/TXT
    3. Create KnowledgeSource record
    4. Chunk the content (smart splitting)
    5. Generate embeddings for each chunk
    6. Save chunks to kb_chunks table
    7. Update source status to "indexed"
    """
    pass
```

**Required Services**:
- `services/file.py` - Already exists for file storage
- `services/document_parser.py` - NEW: Extract text from PDF/DOCX
- `services/chunking.py` - Already exists for text chunking
- `services/embeddings.py` - Already exists for embedding generation

### 2. Document Parser Service

**Location**: `services/api/app/services/document_parser.py`

```python
class DocumentParserService:
    """Extract text from various document formats"""
    
    async def extract_text(self, file_path: str, mime_type: str) -> str:
        """
        Extract text from PDF, DOCX, TXT files
        
        Libraries needed:
        - PyPDF2 or pdfplumber for PDF
        - python-docx for DOCX
        - Plain read for TXT
        """
        pass
    
    async def extract_with_structure(self, file_path: str) -> List[Dict]:
        """
        Extract text with structure (sections, headings)
        Better for building codes which have hierarchical structure
        """
        pass
```

### 3. Smart Chunking Strategy

**Current**: Basic chunking in `services/chunking.py`

**Improvement Needed**:
```python
class SmartChunker:
    """
    Smart chunking for building codes
    
    Current chunking might split mid-sentence or mid-requirement.
    For building codes, preserve:
    - Section headers with content
    - Complete requirements (don't split)
    - Context (keep related rules together)
    """
    
    def chunk_with_overlap(
        self,
        text: str,
        chunk_size: int = 500,
        overlap: int = 50
    ) -> List[str]:
        """Chunk with overlap to preserve context"""
        pass
    
    def chunk_by_section(self, text: str) -> List[Dict]:
        """
        Chunk by detecting sections (e.g., "1. INTRODUCTION")
        Better for structured documents like building codes
        """
        pass
```

### 4. KB Management UI

**Location**: `apps/web/src/app/knowledge-base/`

**Pages Needed**:

1. **KB Document List** (`apps/web/src/app/knowledge-base/page.tsx`)
   - Show all uploaded documents for organization
   - Filter by category
   - Show status (pending, indexed, failed)
   - Delete/edit documents

2. **Upload Document Form** (`apps/web/src/app/knowledge-base/upload/page.tsx`)
   - File upload (PDF/DOCX/TXT)
   - Title and description
   - Category selection
   - Jurisdiction (optional)
   - Preview extracted text before indexing

3. **Document Detail View** (`apps/web/src/app/knowledge-base/[id]/page.tsx`)
   - View document metadata
   - See all chunks generated
   - View embeddings (optional)
   - See which analyses used this document

### 5. Enhanced KB Search

**Current**: Basic semantic search working

**Enhancements**:
```python
# Hybrid search (semantic + keyword)
# Better for exact code section lookups

# Multi-category search
# Search across building_code + accessibility simultaneously

# Jurisdiction filtering
# Filter KB by location (US, Canada, specific state)

# Time-based filtering
# Use most recent version of codes
```

---

## Implementation Priority 📋

### Phase 1: Core Upload (MUST HAVE)
1. ✅ Vector search working (DONE)
2. ✅ LLM integration working (DONE)
3. ✅ Chunking service exists (DONE)
4. ❌ Document parser service (PDF/DOCX extraction) - **IMPLEMENT FIRST**
5. ❌ KB upload API endpoint - **IMPLEMENT SECOND**
6. ❌ KB upload UI page - **IMPLEMENT THIRD**

### Phase 2: Management (SHOULD HAVE)
7. KB document list UI
8. Delete/edit KB documents
9. Reindex functionality
10. Chunk preview in UI

### Phase 3: Advanced (NICE TO HAVE)
11. Smart chunking with section detection
12. Hybrid search (semantic + keyword)
13. Multi-version support (code version tracking)
14. Jurisdiction-based filtering
15. Document comparison (diff between code versions)

---

## Quick Start: Test with Real Upload

### Current Test Flow (What You've Been Using)

```bash
# 1. Seed KB manually
python services/api/scripts/seed_bigchip.py

# 2. Upload CAD file via UI
# 3. Trigger analysis
# 4. LLM reads seeded KB and generates findings ✅
```

### Production Flow (What You Need)

```bash
# 1. User uploads building code PDF via UI
POST /api/v1/knowledge-base/sources
- File: IBC_2021.pdf
- Title: "International Building Code 2021"
- Category: building_code

# 2. Backend processes:
- Extract text from PDF
- Chunk into sections
- Generate embeddings
- Store in kb_chunks table

# 3. User uploads CAD file
# 4. Analysis runs
# 5. LLM reads user's uploaded KB documents ✅
```

---

## Technologies Needed

### For Document Parsing
```bash
# PDF parsing
pip install pdfplumber  # Better than PyPDF2
pip install PyPDF2      # Fallback

# DOCX parsing  
pip install python-docx

# Advanced text extraction (optional)
pip install textract  # Universal text extractor
```

### For Smart Chunking
```python
# Already have basic chunking
# Can enhance with:
pip install langchain  # Has good chunking utilities
# OR implement custom based on building code structure
```

---

## Code Examples

### 1. Document Parser Service

```python
# services/api/app/services/document_parser.py

import pdfplumber
from docx import Document
from typing import Optional

class DocumentParserService:
    
    async def extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF"""
        text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() + "\n\n"
        return text
    
    async def extract_text_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX"""
        doc = Document(file_path)
        return "\n\n".join([para.text for para in doc.paragraphs])
    
    async def extract_text(self, file_path: str, mime_type: str) -> Optional[str]:
        """Extract text based on file type"""
        try:
            if mime_type == "application/pdf":
                return await self.extract_text_from_pdf(file_path)
            elif mime_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
                return await self.extract_text_from_docx(file_path)
            elif mime_type.startswith("text/"):
                with open(file_path, 'r', encoding='utf-8') as f:
                    return f.read()
            else:
                raise ValueError(f"Unsupported file type: {mime_type}")
        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            return None
```

### 2. KB Upload Endpoint

```python
# services/api/app/api/v1/knowledge_base.py

@router.post("/sources", response_model=KnowledgeSourceResponse)
async def upload_kb_document(
    file: UploadFile,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    category: str = Form(...),
    source_type: str = Form("regulation"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload and index a knowledge base document"""
    
    # 1. Validate file
    if not file.filename.endswith(('.pdf', '.docx', '.txt')):
        raise HTTPException(400, "Only PDF, DOCX, and TXT files supported")
    
    # 2. Save file to storage
    file_service = FileService(db)
    storage_key = await file_service.save_file(
        file=file,
        org_id=current_user.org_id,
        uploaded_by=current_user.id
    )
    
    # 3. Create knowledge source record
    kb_source = KnowledgeSource(
        org_id=current_user.org_id,
        title=title,
        description=description,
        source_type=source_type,
        category=category,
        content_url=storage_key,
        status="processing",
        created_by=current_user.id
    )
    db.add(kb_source)
    db.commit()
    db.refresh(kb_source)
    
    # 4. Trigger async processing task
    from app.tasks.knowledge_base import process_kb_document
    process_kb_document.delay(kb_source.id)
    
    return kb_source
```

### 3. KB Processing Task (Celery)

```python
# services/api/app/tasks/knowledge_base.py

from app.tasks import celery_app
from app.services.document_parser import DocumentParserService
from app.services.chunking import ChunkingService
from app.services.embeddings import EmbeddingService

@celery_app.task(bind=True)
def process_kb_document(self, kb_source_id: str):
    """Process uploaded KB document: extract, chunk, embed"""
    
    db = SessionLocal()
    try:
        kb_source = db.query(KnowledgeSource).filter_by(id=kb_source_id).first()
        if not kb_source:
            return
        
        # 1. Extract text from document
        parser = DocumentParserService()
        file_path = f"/app/uploads/{kb_source.content_url}"
        text = await parser.extract_text(file_path, kb_source.mime_type)
        
        if not text:
            kb_source.status = "failed"
            kb_source.error_message = "Could not extract text from document"
            db.commit()
            return
        
        # 2. Chunk the text
        chunker = ChunkingService()
        chunks = chunker.chunk_text(
            text=text,
            chunk_size=500,
            overlap=50
        )
        
        # 3. Generate embeddings
        embedding_service = EmbeddingService()
        
        for i, chunk_text in enumerate(chunks):
            # Generate embedding
            embedding = await embedding_service.generate_embedding(chunk_text)
            
            # Create chunk record
            chunk = KBChunk(
                knowledge_source_id=kb_source.id,
                org_id=kb_source.org_id,
                chunk_text=chunk_text,
                chunk_index=i,
                embedding=embedding,
                chunk_metadata={
                    "source": kb_source.title,
                    "category": kb_source.category,
                    "chunk_size": len(chunk_text)
                }
            )
            db.add(chunk)
        
        # 4. Update source status
        kb_source.status = "indexed"
        kb_source.total_chunks = len(chunks)
        db.commit()
        
        logger.info(f"Indexed KB source {kb_source.id} with {len(chunks)} chunks")
        
    except Exception as e:
        logger.error(f"Error processing KB document: {e}")
        kb_source.status = "failed"
        kb_source.error_message = str(e)
        db.commit()
    finally:
        db.close()
```

### 4. Frontend Upload Page

```typescript
// apps/web/src/app/knowledge-base/upload/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';

export default function UploadKBDocument() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    if (file) {
      formData.append('file', file);
    }

    try {
      const response = await fetch('/api/v1/knowledge-base/sources', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        router.push('/knowledge-base');
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-8">Upload Building Code Document</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="file">Document File</Label>
          <Input
            id="file"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
          <p className="text-sm text-muted-foreground mt-1">
            Supported formats: PDF, DOCX, TXT
          </p>
        </div>

        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="e.g., International Building Code 2021"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Brief description of this document..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Select name="category" required>
            <option value="building_code">Building Code</option>
            <option value="accessibility">Accessibility (ADA)</option>
            <option value="fire_safety">Fire Safety</option>
            <option value="electrical">Electrical Code</option>
            <option value="plumbing">Plumbing Code</option>
            <option value="mechanical">Mechanical/HVAC</option>
            <option value="energy">Energy Efficiency</option>
          </Select>
        </div>

        <Button type="submit" disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload and Index'}
        </Button>
      </form>
    </div>
  );
}
```

---

## Testing Your Implementation

### 1. Test with Real Building Code PDF

1. Download a real building code (e.g., IBC 2021 excerpt)
2. Upload via your new UI
3. Wait for indexing to complete
4. Upload a CAD file
5. Trigger analysis
6. Verify findings reference the uploaded document

### 2. Verify Vector Search

```python
# Test that uploaded document chunks are searchable
from app.services.knowledge_base import KnowledgeBaseService

kb_service = KnowledgeBaseService(db)
results = await kb_service.semantic_search(
    query="egress requirements",
    org_id=your_org_id,
    limit=5,
    min_similarity=0.5
)

# Should return chunks from your uploaded document
for result in results:
    print(f"Source: {result['source']['title']}")
    print(f"Similarity: {result['similarity']}")
    print(f"Content: {result['content'][:200]}...")
```

---

## Summary

### ✅ What's Already Working (REAL)
- Vector similarity search with pgvector
- LLM analysis with Ollama
- Findings generation from KB content
- Semantic search retrieving relevant code sections
- **All your current findings are real LLM-generated output!**

### ❌ What's Missing (TO IMPLEMENT)
- Document upload API endpoint
- PDF/DOCX text extraction service
- Celery task for processing uploaded documents
- KB management UI (list, upload, delete)
- Enhanced chunking strategy for building codes

### 🎯 Next Steps
1. Implement DocumentParserService for PDF/DOCX extraction
2. Add KB upload API endpoint
3. Create Celery task for processing documents
4. Build upload UI page
5. Test with real building code PDF

Your system is **production-ready for analysis** - you just need to add the UI layer for document management!
