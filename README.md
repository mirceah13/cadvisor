# BuildGuard Advisor

**Production-Ready MVP** - SaaS platform for validating building submission packages against standards and regulations.

⚠️ **IMPORTANT DISCLAIMER**: BuildGuard Advisor provides decision-support suggestions and does not replace certified engineering or legal review. This system is not a legal authority or certified compliance body.

## Features

- 🏗️ **Multi-tenant SaaS** - Organizations, Projects, and Submissions
- 📁 **CAD & Document Analysis** - IFC, DXF, PDF, DOCX support
- 🤖 **AI-Powered Validation** - RAG + rules engine with local LLMs (Ollama)
- 👥 **Human-in-the-Loop** - Review workflow with feedback learning
- 📊 **Compliance Reports** - PDF reports with citations and evidence
- 🔐 **Enterprise Security** - RBAC, audit logs, secure file handling
- 💰 **Subscription Management** - Trial and paid plans with usage limits
- 🌙 **Modern UI** - Dark mode, responsive design, accessibility

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui
- **API**: Python FastAPI
- **AI Service**: Python FastAPI + Ollama + IfcOpenShell + ezdxf
- **Database**: PostgreSQL + pgvector
- **Queue**: Celery + Redis
- **Storage**: MinIO (S3-compatible)
- **Inference**: Ollama (local LLMs + embeddings)

## Prerequisites

- Docker Desktop with Docker Compose
- 16GB+ RAM recommended (for running Ollama models)
- 20GB+ free disk space

## Quick Start

### 1. Clone and Setup

```powershell
git clone <repo-url>
cd CADVISOR
cp .env.example .env
```

### 2. Start All Services

```powershell
# Using Docker Compose (recommended)
docker-compose up -d

# Or using Make (requires Make for Windows)
make dev
```

This will start:
- **Web UI**: http://localhost:3000
- **API**: http://localhost:8000
- **AI Service**: http://localhost:8001
- **MinIO Console**: http://localhost:9001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### 3. Initialize Database

```powershell
# Run migrations
docker-compose exec api alembic upgrade head

# Seed initial data (demo org + user)
docker-compose exec api python scripts/seed.py
```

**Demo Credentials**:
- Email: `admin@buildguard.local`
- Password: `BuildGuard2025!`

### 4. Setup Ollama Models

```powershell
# Download LLM (mistral recommended for dev)
docker-compose exec ollama ollama pull mistral:7b-instruct

# Download embedding model
docker-compose exec ollama ollama pull nomic-embed-text
```

### 5. Ingest Sample Knowledge Base

```powershell
# Upload sample building codes/standards
docker-compose exec api python scripts/ingest_sample_kb.py
```

## Usage Workflow

### Step 1: Create Organization & Project

1. Log in at http://localhost:3000
2. Create or select your Organization
3. Create a new Project (specify building type and jurisdiction)

### Step 2: Upload Knowledge Base (Admin)

1. Navigate to **Knowledge Base** (admin only)
2. Upload building codes, standards, regulations (PDF/DOCX)
3. Tag with jurisdiction, standard code, edition date
4. Trigger ingestion (vectorization happens in background)

### Step 3: Create Submission

1. Open your Project
2. Create new Submission
3. Upload files:
   - **CAD files**: IFC (preferred), DXF
   - **Documents**: PDF, DOCX, TXT
   - **Images**: PNG, JPG (OCR support)

### Step 4: Run Analysis

1. Click **Analyze Submission**
2. System will:
   - Extract CAD structure (floors, spaces, exits, etc.)
   - Parse documents
   - Run compliance checks against KB
   - Generate findings with confidence scores

### Step 5: Human Review

1. Navigate to **Review Queue**
2. Review each finding:
   - See AI statement + evidence + KB citations
   - Accept, Reject, Modify, or request more info
   - Add reviewer notes
3. System learns from your feedback

### Step 6: Generate Report

1. From Analysis Run page, click **Generate Report**
2. Download PDF with:
   - Executive summary
   - Findings table
   - Detailed evidence
   - Disclaimer section

## CAD File Support

### IFC Files (Recommended)

**Best practice**: Export IFC4 or IFC2x3 from your BIM tool.

**Supported tools**:
- Revit: File → Export → IFC
- ArchiCAD: File → Save As → IFC
- Vectorworks: File → Export → IFC

**What we extract**:
- Building storeys, spaces, zones
- Doors, windows, stairs, ramps
- Fire compartments (IfcZone)
- Property sets (Pset_*)
- Quantities takeoff

### DXF Files

**Best practice**: Export all layers with annotations.

**What we extract**:
- Layers structure
- Dimensions and measurements
- Text annotations (for compliance notes)
- Blocks and symbols
- Basic geometry analysis

### Unsupported Formats

- **DWG**: Export to DXF from AutoCAD
- **ArchiCAD proprietary**: Export to IFC
- **Revit RVT**: Export to IFC

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Next.js   │─────▶│   FastAPI   │─────▶│ AI Service  │
│     Web     │      │     API     │      │   (Ollama)  │
└─────────────┘      └─────────────┘      └─────────────┘
                            │                      │
                            ▼                      ▼
                     ┌─────────────┐      ┌─────────────┐
                     │  PostgreSQL │      │   Celery    │
                     │  + pgvector │      │   Workers   │
                     └─────────────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │    MinIO    │
                     │  (Storage)  │
                     └─────────────┘
```

## Development

### Project Structure

```
CADVISOR/
├── apps/
│   └── web/                 # Next.js frontend
├── services/
│   ├── api/                 # FastAPI main API
│   └── ai/                  # AI orchestration service
├── packages/
│   └── shared/              # Shared types + OpenAPI client
├── infra/
│   ├── docker/              # Dockerfiles
│   └── migrations/          # Database migrations
├── scripts/                 # Utility scripts
└── docker-compose.yml       # Local development stack
```

### Running Services Individually

```powershell
# Frontend (development mode)
cd apps/web
npm install
npm run dev

# API
cd services/api
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# AI Service
cd services/ai
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# Celery Worker
cd services/api
celery -A app.worker worker --loglevel=info
```

### Database Migrations

```powershell
# Create new migration
docker-compose exec api alembic revision --autogenerate -m "description"

# Apply migrations
docker-compose exec api alembic upgrade head

# Rollback
docker-compose exec api alembic downgrade -1
```

### Running Tests

```powershell
# API tests
docker-compose exec api pytest

# Frontend tests
docker-compose exec web npm test

# Integration tests
docker-compose exec api pytest tests/integration/

# E2E tests (optional)
cd apps/web
npm run test:e2e
```

## Configuration

### Environment Variables

Key variables in `.env`:

```env
# Database
DATABASE_URL=postgresql://buildguard:password@postgres:5432/buildguard

# Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# AI
OLLAMA_BASE_URL=http://ollama:11434
DEFAULT_LLM_MODEL=mistral:7b-instruct
DEFAULT_EMBEDDING_MODEL=nomic-embed-text

# Auth
JWT_SECRET=<generate-strong-secret>
SESSION_SECRET=<generate-strong-secret>

# Feature Flags
ENABLE_EMAIL_VERIFICATION=false
ENABLE_FILE_SCANNING=false  # ClamAV integration
```

### Customization

- **LLM Model**: Change `DEFAULT_LLM_MODEL` in `.env`
- **Chunking Strategy**: Edit `services/ai/app/config.py`
- **Rules Engine**: Admin UI → Rules → Edit JSON
- **Jurisdiction Profiles**: Database seeding script

## Security

### Authentication
- Argon2 password hashing
- JWT tokens with refresh rotation
- CSRF protection
- Rate limiting on auth endpoints

### File Security
- Pre-signed URLs with short TTL (15 minutes)
- SHA-256 checksum verification
- MIME type validation
- Size limits per plan tier
- Optional virus scanning (ClamAV hook)

### Multi-Tenancy
- Organization-level data isolation
- Row-level security checks in queries
- RBAC enforcement at API layer

### Audit Logging
All sensitive actions logged:
- Authentication events
- File uploads/downloads
- Analysis runs
- Reviewer actions
- Admin rule changes

## Billing & Subscriptions

### Plans

- **Trial**: 14 days, 3 projects, 10 submissions
- **Pro**: $99/month, 20 projects, 100 submissions
- **Team**: $299/month, unlimited projects, 500 submissions
- **Enterprise**: Custom pricing

### Usage Limits

Enforced per plan:
- Max projects per org
- Max submissions per month
- Max file size (50MB → 2GB)
- Max analysis runs per day

### Mock Billing (Local Dev)

For development, a `MockBillingProvider` is used. To simulate upgrades:

```powershell
# Upgrade org to Pro plan
curl -X POST http://localhost:8000/api/billing/mock/upgrade-plan \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan": "pro"}'
```

## Production Deployment

See [docs/PRODUCTION.md](docs/PRODUCTION.md) for:
- Kubernetes manifests
- Secrets management (Vault, AWS Secrets Manager)
- S3 storage configuration
- Horizontal scaling (API, AI, Celery workers)
- SSL/TLS setup
- Monitoring and observability
- Backup strategies
- Disaster recovery

### Recommended Hosting

- **Cloud**: AWS (ECS/EKS), Google Cloud (GKE), Azure (AKS)
- **Platform**: Railway, Render, Fly.io
- **Self-hosted**: Any Docker/K8s cluster

## Troubleshooting

### Ollama Out of Memory

Reduce model size:
```powershell
docker-compose exec ollama ollama pull mistral:7b-instruct-q4_0
```

### Slow Analysis

- Check Celery worker logs: `docker-compose logs -f celery`
- Increase worker concurrency: `CELERY_WORKERS=4` in `.env`
- Use GPU acceleration (requires CUDA-enabled Ollama)

### Upload Fails

- Check MinIO is running: `docker-compose ps minio`
- Verify bucket exists: MinIO console at http://localhost:9001
- Check file size limits in `.env`

### Database Connection Issues

```powershell
# Check PostgreSQL logs
docker-compose logs postgres

# Recreate database
docker-compose down -v
docker-compose up -d postgres
docker-compose exec api alembic upgrade head
```

## Roadmap

- [ ] ArchiCAD IFC auto-export integration
- [ ] Real-time collaboration (WebSocket)
- [ ] LoRA fine-tuning from feedback dataset
- [ ] Mobile app (React Native)
- [ ] Advanced BIM clash detection
- [ ] 3D visualization of findings
- [ ] Stripe billing integration
- [ ] Email notifications
- [ ] Webhooks API
- [ ] Multi-language support

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Standards

- **Python**: Black formatter, isort, flake8, mypy
- **TypeScript**: ESLint, Prettier
- **Commits**: Conventional Commits format

## License

Proprietary - All rights reserved

## Support

- Documentation: [docs/](docs/)
- Issues: GitHub Issues
- Email: support@buildguard.example

---

Built with ❤️ for the construction industry
