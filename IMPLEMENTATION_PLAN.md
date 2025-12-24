# CADVisor Implementation Plan

## Current Status: Infrastructure Complete ✅
All foundational infrastructure is in place and working:
- Docker services running (PostgreSQL, Redis, MinIO, Ollama, API, Web)
- Database schema with 14 tables
- Authentication & RBAC models
- Demo data seeded
- Basic UI scaffolding

## Implementation Phases

### 🎯 Phase 1: File Management & Upload System (Week 1)
**Priority: HIGH - Core functionality needed for everything else**

#### 1.1 MinIO Integration & File Operations
- [x] Implement pre-signed URL generation for uploads
- [x] Create file upload completion handler
- [x] Add file download with signed URLs
- [ ] Implement file scanning hook (placeholder + ClamAV stub)
- [x] Add checksum validation (SHA-256)
- [x] Create MinIO bucket initialization script

**API Endpoints:**
```
POST   /api/v1/files/presign-upload ✓
POST   /api/v1/files/complete-upload ✓
GET    /api/v1/files/{id}/download ✓
GET    /api/v1/files ✓
DELETE /api/v1/files/{id} ✓
```

**Services Implemented:**
```
StorageService: MinIO/S3 integration, pre-signed URLs, bucket management
FileService: File validation, CRUD, access control, soft delete
```

**Frontend Components:**
- [ ] File upload component with progress
- [ ] File list with download/delete actions
- [ ] Drag-and-drop zone
- [ ] Upload status indicators

**Acceptance Criteria:**
- ✅ Upload 2GB+ files directly to MinIO
- ✅ Files isolated by organization
- ✅ Secure signed URLs with 15min expiry
- ✅ SHA-256 verification
- ✅ Multi-tenant access control
- ✅ Soft delete with metadata preservation

---

### 🎯 Phase 2: CAD File Parsing & Extraction (Week 2)
**Priority: HIGH - Core differentiation**

#### 2.1 IFC Parser Implementation
- [x] Install & configure IfcOpenShell
- [x] Extract building structure (storeys, spaces, zones)
- [x] Extract elements (walls, doors, windows, stairs)
- [x] Extract properties & quantities
- [x] Calculate basic metrics (area, volume, counts)
- [x] Generate SubmissionProfile JSON schema

#### 2.2 DXF Parser Implementation
- [x] Install & configure ezdxf
- [x] Extract layers & blocks
- [x] Parse dimensions & annotations
- [x] Extract text entities
- [x] Detect keywords in labels
- [x] Generate DXF metadata summary

#### 2.3 Document Parsers
- [x] PDF text extraction (PyPDF2/pdfplumber)
- [x] DOCX parsing (python-docx)
- [ ] OCR integration stub (Tesseract)
- [ ] Markdown parser

**Celery Tasks:**
```
process_cad_file(file_id) ✓
extract_submission_profile(submission_id) ✓
```

**Data Structure:**
```json
{
  "submission_profile": {
    "building": {
      "type": "residential",
      "floors": 3,
      "total_area_sqm": 450.5,
      "fire_compartments": 2,
      "exits": 4,
      "staircases": 1
    },
    "elements": {
      "walls": 45,
      "doors": 12,
      "windows": 18,
      "stairs": 1
    },
    "systems": {
      "electrical": true,
      "plumbing": true,
      "hvac": true
    },
    "documents": ["permit.pdf", "structural_notes.pdf"]
  }
}
```

**Acceptance Criteria:**
- ✅ Parse IFC files and extract 15+ key metrics
- ✅ Parse DXF files and extract layers/annotations
- ✅ Generate normalized JSON profile
- ✅ Handle parsing errors gracefully

---

### 🎯 Phase 3: Knowledge Base & RAG System (Week 3)
**Priority: HIGH - AI foundation**

#### 3.1 Knowledge Base Ingestion
- [x] KB source CRUD endpoints
- [x] Document chunking strategy (1000 chars, 200 overlap)
- [x] Text extraction pipeline (PDF, DOCX, URL)
- [x] Embedding generation (nomic-embed-text via Ollama)
- [x] Vector storage in pgvector
- [x] Metadata tagging (category, source_type, title)

#### 3.2 RAG Implementation
- [x] Semantic search over KB chunks
- [x] Filtered retrieval (category filter)
- [x] Cosine similarity with pgvector
- [x] Citation tracking (source metadata)
- [x] Relevance scoring (min_similarity threshold)

**API Endpoints:**
```
POST   /api/v1/kb/sources ✓
GET    /api/v1/kb/sources ✓
GET    /api/v1/kb/sources/{id} ✓
DELETE /api/v1/kb/sources/{id} ✓
POST   /api/v1/kb/sources/{id}/reingest ✓
POST   /api/v1/kb/search ✓
```

**Celery Tasks:**
```
ingest_knowledge_source(source_id) ✓
```

**Frontend:**
- [ ] KB source upload page
- [ ] Ingestion status monitor
- [ ] Source management table
- [ ] Search/test interface

**Acceptance Criteria:**
- ✅ Ingest PDF standards documents
- ✅ Store vectors in pgvector
- ✅ Search returns top-5 relevant chunks
- ✅ Results include citations

---

### 🎯 Phase 4: Analysis Engine & Rules (Week 4)
**Priority: HIGH - Core business logic**

#### 4.1 Deterministic Rules Engine
- [x] Rules JSON schema definition
- [x] Rule evaluation engine
- [ ] Jurisdiction-based rule loading
- [ ] Required documents checker
- [ ] Mandatory metadata validator
- [ ] Critical threshold checks

#### 4.2 AI Analysis Pipeline
- [x] Analysis orchestration service
- [x] Category-based check runner (8 check types)
- [x] LLM prompt templates
- [x] Structured output validation
- [ ] Confidence scoring
- [x] Evidence collection (context chunks)

#### 4.3 Findings Management
- [x] Finding generation & storage
- [x] Severity classification (critical/warning/info)
- [x] Status workflow (open → resolved)
- [x] Evidence linking (metadata with references)

**Check Types Implemented:**
1. Fire Safety ✓
2. Accessibility ✓
3. General Compliance ✓
4. Residential Code ✓
5. Commercial Code ✓
6. Electrical Code ✓
7. Plumbing Code ✓
8. Mechanical Code ✓

**API Endpoints:**
```
POST   /api/v1/analysis/start ✓
GET    /api/v1/analysis/submissions/{id}/runs ✓
GET    /api/v1/analysis/submissions/{id}/findings ✓
GET    /api/v1/analysis/submissions/{id}/findings/summary ✓
PATCH  /api/v1/analysis/findings/{id} ✓
POST   /api/v1/analysis/submissions/{id}/reanalyze ✓
```

**Celery Tasks:**
```
run_compliance_analysis(submission_id, ruleset_ids, check_types) ✓
reanalyze_submission(submission_id) ✓
```

**Services Implemented:**
```
LLMService: Ollama integration, RAG completion, compliance analysis, finding parsing
AnalysisEngine: Orchestrates analysis, determines checks, manages findings
```

**Acceptance Criteria:**
- ✅ Run analysis on submission
- ✅ Generate findings across categories
- ✅ Findings include evidence & citations
- ✅ Confidence scores calibrated

---

### 🎯 Phase 5: Human Review Workflow (Week 5)
**Priority: HIGH - Critical for MVP value**

#### 5.1 Review Queue
- [ ] Findings list with filters (category, severity, status)
- [ ] Sort by confidence, severity, date
- [ ] Batch actions
- [ ] Review assignment

#### 5.2 Finding Review Interface
- [ ] Finding detail page
- [ ] Evidence viewer (file snippets + KB citations)
- [ ] Action buttons (Accept, Reject, Modify, Needs Info)
- [ ] Text editor for modifications
- [ ] Reason code dropdown
- [ ] Internal notes field

#### 5.3 Feedback Loop
- [ ] Store reviewer actions
- [ ] Calculate acceptance metrics
- [ ] Generate training dataset entries
- [ ] Rule suggestion workflow

**API Endpoints:**
```
GET    /api/v1/findings
GET    /api/v1/findings/{id}
POST   /api/v1/findings/{id}/feedback
GET    /api/v1/metrics/review-stats
```

**Frontend Pages:**
- Review queue dashboard
- Finding detail/editor
- Metrics & analytics
- Training data export

**Acceptance Criteria:**
- ✅ Reviewer can accept/reject findings
- ✅ Modifications saved with audit trail
- ✅ Metrics show acceptance rate by category
- ✅ Generate training dataset JSON

---

### 🎯 Phase 6: Reporting & Export (Week 6)
**Priority: MEDIUM - Important for deliverables**

#### 6.1 PDF Report Generation
- [ ] Report template design
- [ ] Executive summary section
- [ ] Findings table with evidence
- [ ] KB citations appendix
- [ ] Disclaimer page
- [ ] PDF generation (ReportLab/WeasyPrint)

#### 6.2 Export Formats
- [ ] JSON export
- [ ] CSV findings export
- [ ] Audit log export

**API Endpoints:**
```
POST   /api/v1/analysis-runs/{id}/report
GET    /api/v1/reports/{id}/status
GET    /api/v1/reports/{id}/download
```

**Celery Tasks:**
```
generate_pdf_report(analysis_run_id)
```

**Acceptance Criteria:**
- ✅ Generate professional PDF report
- ✅ Include all findings with evidence
- ✅ Clear disclaimer section
- ✅ Export to JSON

---

### 🎯 Phase 7: Subscription & Usage Limits (Week 7)
**Priority: MEDIUM - Business logic**

#### 7.1 Billing Integration
- [ ] Subscription model implementation
- [ ] Usage tracking events
- [ ] Limit enforcement middleware
- [ ] Trial period management
- [ ] Mock billing provider
- [ ] Stripe stub for future

#### 7.2 Usage Monitoring
- [ ] Usage dashboard
- [ ] Quota warnings
- [ ] Upgrade prompts

**Limits to Enforce:**
```javascript
{
  "trial": {
    "max_projects": 3,
    "max_submissions_per_month": 10,
    "max_file_size_mb": 50,
    "max_analysis_per_day": 5
  },
  "pro": {
    "max_projects": 20,
    "max_submissions_per_month": 100,
    "max_file_size_mb": 500,
    "max_analysis_per_day": 50
  }
}
```

**API Endpoints:**
```
GET    /api/v1/billing/subscription
GET    /api/v1/billing/usage
POST   /api/v1/billing/upgrade
```

**Acceptance Criteria:**
- ✅ Enforce submission limits
- ✅ Show usage on dashboard
- ✅ Trial expiry handling
- ✅ Mock upgrade flow works

---

### 🎯 Phase 8: Frontend Polish & UX (Week 8)
**Priority: MEDIUM - User experience**

#### 8.1 Core Pages
- [ ] Dashboard with metrics
- [ ] Project management
- [ ] Submission detail page
- [ ] Analysis results viewer
- [ ] Review workflow UI
- [ ] KB management
- [ ] Settings & billing

#### 8.2 UI/UX Improvements
- [ ] Loading states & skeletons
- [ ] Empty states
- [ ] Error boundaries
- [ ] Toast notifications
- [ ] Confirmation dialogs
- [ ] Keyboard shortcuts
- [ ] Mobile responsive

#### 8.3 Dark Mode
- [ ] Theme toggle
- [ ] System preference detection
- [ ] Persistent user choice
- [ ] All components themed

**Acceptance Criteria:**
- ✅ Polished, professional UI
- ✅ Fast page transitions
- ✅ Clear feedback on actions
- ✅ Works on mobile

---

### 🎯 Phase 9: Testing & Quality (Week 9)
**Priority: HIGH - Production readiness**

#### 9.1 Unit Tests
- [ ] RBAC permission tests
- [ ] Rules engine tests
- [ ] File validation tests
- [ ] Parser tests
- [ ] Finding validation tests

#### 9.2 Integration Tests
- [ ] Full workflow test (create → upload → analyze → review)
- [ ] Multi-tenant isolation tests
- [ ] File access control tests
- [ ] API error handling tests

#### 9.3 E2E Tests (Optional)
- [ ] Playwright smoke tests
- [ ] Critical path coverage

**Coverage Targets:**
- Backend: 70%+
- Frontend: 50%+
- Critical paths: 90%+

---

### 🎯 Phase 10: Documentation & Deployment (Week 10)
**Priority: MEDIUM - Operations**

#### 10.1 Documentation
- [ ] API documentation (OpenAPI)
- [ ] User guide
- [ ] Admin guide
- [ ] Deployment guide
- [ ] Development setup guide
- [ ] Architecture documentation

#### 10.2 Deployment Prep
- [ ] Production docker-compose
- [ ] Environment templates
- [ ] Migration scripts
- [ ] Backup procedures
- [ ] Monitoring setup

#### 10.3 Sample Data
- [ ] Sample KB documents
- [ ] Sample IFC/DXF files
- [ ] Demo submission
- [ ] Seed script enhancements

---

## Development Priorities

### This Week (Week 1): File Management
**Start Here:**
1. ✅ Infrastructure running
2. ⏳ Implement MinIO pre-signed uploads
3. ⏳ Build file upload UI component
4. ⏳ Add file download functionality
5. ⏳ Test with large files

### Next Week (Week 2): CAD Parsers
1. Install IfcOpenShell & ezdxf
2. Build IFC extraction pipeline
3. Build DXF extraction pipeline
4. Create SubmissionProfile schema
5. Test with real CAD files

---

## Success Metrics

### MVP Launch Criteria:
- [ ] User can upload submission with 5+ files
- [ ] System extracts CAD metadata
- [ ] Analysis generates 20+ findings
- [ ] Reviewer can accept/modify findings
- [ ] PDF report generated
- [ ] All features work without paid APIs
- [ ] Dark mode functional
- [ ] Mobile responsive

### Performance Targets:
- File upload: <30s for 500MB
- CAD parsing: <2min for typical IFC
- Analysis run: <5min end-to-end
- Report generation: <30s

### Quality Targets:
- Zero security vulnerabilities
- 70%+ test coverage
- <500ms API response (p95)
- <2s page load time

---

## Tech Stack Reference

**Backend:**
- FastAPI + Python 3.11
- PostgreSQL 16 + pgvector
- Redis 7
- Celery workers
- IfcOpenShell (IFC)
- ezdxf (DXF)
- Ollama (LLM)

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand (state)

**Infrastructure:**
- Docker Compose
- MinIO
- Nginx (optional)

---

## Risk Management

### High Risks:
1. **CAD parsing complexity** → Start with basic extraction, iterate
2. **LLM output quality** → Use structured outputs + validation
3. **Large file handling** → Direct-to-MinIO uploads
4. **Multi-tenancy bugs** → Comprehensive tests + middleware

### Mitigation:
- Incremental development
- Frequent testing
- Clear error handling
- Graceful degradation

---

## Next Steps

**Immediate Actions (This Sprint):**
1. ✅ Review infrastructure status
2. 🔄 Implement MinIO file operations (START HERE)
3. 🔄 Build upload UI component
4. 🔄 Add file security layer
5. 🔄 Test upload workflow end-to-end

**Ready to Start Phase 1 - File Management System**

Let me know when you're ready to proceed with implementation!
