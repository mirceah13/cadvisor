# BuildGuard Advisor - Implementation Guide

This document provides a comprehensive guide for completing the remaining implementation tasks for BuildGuard Advisor MVP.

## Project Status

### ✅ Completed
1. **Infrastructure**: Docker Compose, Dockerfiles, environment configuration
2. **Database Schema**: Complete PostgreSQL schema with pgvector, all tables, Alembic migrations
3. **API Foundation**: FastAPI app structure, authentication, RBAC, core security
4. **AI Service Foundation**: Service structure, configuration, Ollama integration scaffold
5. **Celery Workers**: Worker configuration, task placeholders
6. **Frontend Foundation**: Next.js app, landing page, dark mode, basic UI structure

### 🚧 Remaining Implementation Tasks

## Phase 1: Core API Completion (Priority: HIGH)

### 1.1 Complete API Endpoints

**Files to Create/Update:**
- `services/api/app/api/v1/endpoints/projects.py` - Full CRUD for projects
- `services/api/app/api/v1/endpoints/submissions.py` - Full CRUD for submissions
- `services/api/app/api/v1/endpoints/files.py` - File upload/download with MinIO
- `services/api/app/api/v1/endpoints/analysis.py` - Analysis run CRUD and review workflow
- `services/api/app/api/v1/endpoints/kb.py` - Knowledge base CRUD
- `services/api/app/api/v1/endpoints/billing.py` - Subscription management

**Key Implementations:**

#### Files Endpoint (MinIO Integration)
```python
from minio import Minio
from app.core.config import settings

minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ROOT_USER,
    secret_key=settings.MINIO_ROOT_PASSWORD,
    secure=settings.MINIO_USE_SSL,
)

@router.post("/presign-upload")
async def presign_upload(filename: str, mime_type: str, ...):
    # Generate presigned URL for direct upload
    # Return storage_key and presigned_url
    pass

@router.post("/complete-upload")
async def complete_upload(file_id: UUID, ...):
    # Verify file was uploaded, create File record
    # Trigger background ingestion task
    pass

@router.get("/{file_id}/download")
async def download_file(file_id: UUID, ...):
    # Generate presigned download URL (15 min TTL)
    # Check RBAC permissions
    pass
```

### 1.2 Pydantic Schemas

**Create:** `services/api/app/schemas/`
- `auth.py` - LoginRequest, SignupRequest, TokenResponse
- `organization.py` - OrgCreate, OrgResponse, OrgInviteRequest
- `project.py` - ProjectCreate, ProjectUpdate, ProjectResponse
- `submission.py` - SubmissionCreate, SubmissionResponse, SubmissionProfile
- `file.py` - FileUploadRequest, FileResponse
- `analysis.py` - AnalysisRunRequest, AnalysisRunResponse, FindingResponse
- `kb.py` - KBSourceCreate, KBSourceResponse
- `billing.py` - SubscriptionResponse, PlanLimits

## Phase 2: AI Service Implementation (Priority: HIGH)

### 2.1 Ollama Integration

**Create:** `services/ai/app/services/ollama_client.py`
```python
import ollama
from app.core.config import settings

class OllamaClient:
    def __init__(self):
        self.client = ollama.Client(host=settings.OLLAMA_BASE_URL)
        
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        # Use nomic-embed-text to generate embeddings
        pass
    
    def generate_completion(self, prompt: str, model: str = None) -> str:
        # Generate LLM completion
        pass
    
    def structured_completion(self, prompt: str, schema: dict) -> dict:
        # Generate structured JSON output
        pass
```

### 2.2 CAD Parsers

**Create:** `services/ai/app/parsers/`

**IFC Parser** (`ifc_parser.py`):
```python
import ifcopenshell
from typing import Dict, List

class IFCParser:
    def parse_file(self, file_path: str) -> Dict:
        ifc_file = ifcopenshell.open(file_path)
        
        profile = {
            "building_info": self._extract_building_info(ifc_file),
            "storeys": self._extract_storeys(ifc_file),
            "spaces": self._extract_spaces(ifc_file),
            "doors": self._count_doors(ifc_file),
            "stairs": self._count_stairs(ifc_file),
            "fire_zones": self._extract_fire_zones(ifc_file),
            "property_sets": self._extract_psets(ifc_file),
        }
        return profile
```

**DXF Parser** (`dxf_parser.py`):
```python
import ezdxf
from typing import Dict, List

class DXFParser:
    def parse_file(self, file_path: str) -> Dict:
        doc = ezdxf.readfile(file_path)
        
        profile = {
            "layers": self._extract_layers(doc),
            "dimensions": self._extract_dimensions(doc),
            "text_annotations": self._extract_text(doc),
            "blocks": self._extract_blocks(doc),
        }
        return profile
```

### 2.3 Document Processing

**Create:** `services/ai/app/processors/document_processor.py`
```python
from pypdf import PdfReader
from docx import Document
from PIL import Image
import pytesseract

class DocumentProcessor:
    def extract_text_from_pdf(self, file_path: str) -> str:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        return text
    
    def extract_text_from_docx(self, file_path: str) -> str:
        doc = Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    
    def extract_text_from_image(self, file_path: str) -> str:
        image = Image.open(file_path)
        text = pytesseract.image_to_string(image)
        return text
```

### 2.4 RAG Implementation

**Create:** `services/ai/app/services/rag_service.py`
```python
from sqlalchemy import text
from app.core.config import settings

class RAGService:
    def retrieve_relevant_chunks(
        self,
        query_embedding: List[float],
        jurisdiction: str,
        top_k: int = 10
    ) -> List[Dict]:
        # Use pgvector cosine similarity search
        # Filter by jurisdiction and org_id
        query = text("""
            SELECT 
                kc.chunk_text,
                ks.title,
                ks.standard_code,
                1 - (kc.embedding <=> :query_embedding) as similarity
            FROM kb_chunks kc
            JOIN knowledge_sources ks ON kc.knowledge_source_id = ks.id
            WHERE ks.jurisdiction = :jurisdiction
                AND ks.status = 'indexed'
                AND (1 - (kc.embedding <=> :query_embedding)) > :threshold
            ORDER BY similarity DESC
            LIMIT :top_k
        """)
        # Execute and return results
        pass
    
    def build_context(self, chunks: List[Dict], max_length: int = 8000) -> str:
        # Combine chunks into context string
        # Truncate if needed
        pass
```

### 2.5 Analysis Pipeline

**Create:** `services/ai/app/services/analysis_service.py`
```python
class AnalysisService:
    def analyze_submission(self, submission_id: UUID) -> Dict:
        # 1. Extract submission profile from CAD files
        profile = self._extract_submission_profile(submission_id)
        
        # 2. Run deterministic rules checks
        rule_findings = self._run_rules_engine(profile)
        
        # 3. Run RAG-based checks for each category
        rag_findings = []
        categories = ["fire_safety", "accessibility", "egress", "mep"]
        for category in categories:
            findings = self._analyze_category(profile, category)
            rag_findings.extend(findings)
        
        # 4. Combine and store findings
        all_findings = rule_findings + rag_findings
        
        return {"findings": all_findings, "profile": profile}
    
    def _analyze_category(self, profile: Dict, category: str) -> List[Dict]:
        # Build prompt with profile and category
        # Retrieve relevant KB chunks
        # Call LLM with structured output
        # Parse and validate findings
        pass
```

## Phase 3: Celery Tasks Implementation

### 3.1 File Ingestion Task
**Update:** `services/api/app/tasks/file_tasks.py`
- Verify file checksum
- Optional: ClamAV scanning
- Extract metadata
- Trigger document processing if needed

### 3.2 KB Ingestion Task
**Update:** `services/api/app/tasks/kb_tasks.py`
- Extract text from file
- Chunk text (CHUNK_SIZE, CHUNK_OVERLAP)
- Generate embeddings via AI service
- Store kb_chunks with vectors in pgvector

### 3.3 Analysis Task
**Update:** `services/api/app/tasks/analysis_tasks.py`
- Call AI service analysis endpoint
- Update AnalysisRun status
- Create Finding records
- Handle errors gracefully

### 3.4 Report Generation Task
**Update:** `services/api/app/tasks/report_tasks.py`
- Use ReportLab or WeasyPrint
- Generate PDF with:
  - Executive summary
  - Findings table
  - Evidence and citations
  - Disclaimer page
- Upload to MinIO
- Return download URL

## Phase 4: Frontend Implementation

### 4.1 Authentication Pages
**Create:** `apps/web/src/app/(auth)/`
- `login/page.tsx`
- `signup/page.tsx`
- `logout/page.tsx`

### 4.2 Dashboard
**Create:** `apps/web/src/app/(dashboard)/`
- `layout.tsx` - Sidebar navigation, org switcher
- `page.tsx` - Overview with usage stats
- `organizations/page.tsx` - Org management
- `projects/page.tsx` - Project list
- `projects/[id]/page.tsx` - Project detail
- `submissions/[id]/page.tsx` - Submission detail with file upload
- `analysis/[id]/page.tsx` - Analysis run results

### 4.3 Review Workflow
**Create:** `apps/web/src/app/(dashboard)/review/`
- `page.tsx` - Review queue (filterable findings list)
- `[finding_id]/page.tsx` - Finding detail editor

### 4.4 Knowledge Base Admin
**Create:** `apps/web/src/app/(dashboard)/kb/`
- `page.tsx` - KB source list
- `upload/page.tsx` - Upload KB document with metadata

### 4.5 Shared Components
**Create:** `apps/web/src/components/`
- UI components from shadcn/ui (Button, Dialog, Table, etc.)
- `file-upload.tsx` - Drag-drop file uploader
- `finding-card.tsx` - Finding display component
- `disclaimer-banner.tsx` - Persistent disclaimer
- `org-switcher.tsx` - Organization selector

### 4.6 API Client
**Create:** `apps/web/src/lib/api-client.ts`
```typescript
import axios from 'axios'

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

// Add auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default apiClient
```

### 4.7 State Management
**Create:** `apps/web/src/store/`
- `auth-store.ts` - Zustand store for auth state
- `org-store.ts` - Current org context
- `theme-store.ts` - Dark mode preference

## Phase 5: Testing

### 5.1 API Tests
**Create:** `services/api/tests/`
- `test_auth.py` - Authentication flows
- `test_rbac.py` - Permission checks
- `test_projects.py` - CRUD operations
- `test_analysis.py` - Analysis pipeline

### 5.2 Integration Tests
**Create:** `services/api/tests/integration/`
- `test_e2e_submission.py` - Full submission workflow

### 5.3 Frontend Tests
**Create:** `apps/web/src/__tests__/`
- Unit tests for components
- Integration tests for pages

## Phase 6: Production Readiness

### 6.1 CI/CD
**Create:** `.github/workflows/`
- `ci.yml` - Lint, test, build
- `deploy.yml` - Docker image build and push

### 6.2 Documentation
**Create:** `docs/`
- `PRODUCTION.md` - Production deployment guide
- `API.md` - API documentation
- `ARCHITECTURE.md` - System architecture
- `SECURITY.md` - Security best practices

### 6.3 Monitoring
- Add structured logging throughout
- Implement health check endpoints
- Add metrics endpoints (Prometheus format)
- Set up error tracking (Sentry integration)

## Quick Start Commands

```powershell
# Initial setup
cp .env.example .env
docker-compose build
docker-compose up -d postgres redis minio
docker-compose run --rm api alembic upgrade head
docker-compose run --rm api python scripts/seed.py

# Pull Ollama models
docker-compose up -d ollama
Start-Sleep -Seconds 15
docker-compose exec ollama ollama pull mistral:7b-instruct
docker-compose exec ollama ollama pull nomic-embed-text

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
docker-compose logs -f ai
docker-compose logs -f web

# Run tests
docker-compose exec api pytest
docker-compose exec web npm test
```

## Implementation Priority

1. **Week 1**: Complete API endpoints (files, projects, submissions)
2. **Week 2**: Implement AI service (parsers, RAG, analysis)
3. **Week 3**: Complete Celery tasks and background processing
4. **Week 4**: Build frontend dashboard and review workflow
5. **Week 5**: Testing, bug fixes, polish
6. **Week 6**: Documentation, deployment preparation

## Notes

- All placeholders marked with `# TODO:` or `pass` need implementation
- Use provided schemas and types consistently
- Follow FastAPI and Next.js best practices
- Maintain security (RBAC) in all endpoints
- Add proper error handling and logging
- Write tests as you implement features

## Resources

- FastAPI: https://fastapi.tiangolo.com/
- Ollama: https://ollama.ai/
- IfcOpenShell: https://ifcopenshell.org/
- pgvector: https://github.com/pgvector/pgvector
- Next.js: https://nextjs.org/
- shadcn/ui: https://ui.shadcn.com/
