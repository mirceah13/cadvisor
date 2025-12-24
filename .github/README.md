# BuildGuard Advisor

![License](https://img.shields.io/badge/license-Proprietary-red)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Node](https://img.shields.io/badge/node-20-green)
![Docker](https://img.shields.io/badge/docker-required-blue)

Production-ready SaaS platform for validating building submission packages against standards and regulations.

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd CADVISOR

# 2. Copy environment file
cp .env.example .env

# 3. Start all services
docker-compose up -d

# 4. Run migrations
docker-compose exec api alembic upgrade head

# 5. Seed demo data
docker-compose exec api python scripts/seed.py

# 6. Pull Ollama models
docker-compose exec ollama ollama pull mistral:7b-instruct
docker-compose exec ollama ollama pull nomic-embed-text
```

**Access the application**:
- Web UI: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Demo Login: `admin@buildguard.local` / `BuildGuard2025!`

## Documentation

- [Quick Start Guide](QUICKSTART.md) - Get up and running in 5 minutes
- [Implementation Guide](IMPLEMENTATION_GUIDE.md) - Complete development roadmap
- [Production Deployment](docs/PRODUCTION.md) - K8s, scaling, monitoring
- [Project Summary](PROJECT_SUMMARY.md) - Architecture and status

## Features

- 🏗️ Multi-tenant SaaS (Organizations, Projects, Submissions)
- 📁 CAD & Document Analysis (IFC, DXF, PDF, DOCX)
- 🤖 AI-Powered Validation (RAG + Rules Engine)
- 👥 Human-in-the-Loop Review Workflow
- 📊 Compliance Reports with Citations
- 🔐 Enterprise Security (RBAC, Audit Logs)
- 💰 Subscription Management
- 🌙 Modern UI with Dark Mode

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, shadcn/ui
- **API**: FastAPI, SQLAlchemy, Alembic
- **AI**: Ollama, IfcOpenShell, ezdxf, pgvector
- **Database**: PostgreSQL 16 + pgvector
- **Queue**: Celery + Redis
- **Storage**: MinIO / S3

## License

Proprietary - All rights reserved

---

⚠️ **Disclaimer**: BuildGuard Advisor provides decision-support suggestions and does not replace certified engineering or legal review.
