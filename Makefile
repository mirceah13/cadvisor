.PHONY: help dev up down build clean migrate seed test lint format logs

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "BuildGuard Advisor - Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services in development mode
	docker-compose up

up: ## Start all services in background
	docker-compose up -d

down: ## Stop all services
	docker-compose down

build: ## Build all Docker images
	docker-compose build

rebuild: ## Rebuild all images from scratch
	docker-compose build --no-cache

clean: ## Stop services and remove volumes (WARNING: deletes data)
	docker-compose down -v
	rm -rf data/

restart: ## Restart all services
	docker-compose restart

# Database commands
migrate: ## Run database migrations
	docker-compose exec api alembic upgrade head

migrate-create: ## Create new migration (use NAME=description)
	docker-compose exec api alembic revision --autogenerate -m "$(NAME)"

migrate-down: ## Rollback last migration
	docker-compose exec api alembic downgrade -1

seed: ## Seed database with sample data
	docker-compose exec api python scripts/seed.py

db-reset: ## Reset database (WARNING: deletes all data)
	docker-compose down postgres
	docker volume rm cadvisor_postgres_data || true
	docker-compose up -d postgres
	sleep 5
	$(MAKE) migrate
	$(MAKE) seed

# Ollama commands
ollama-pull: ## Download Ollama models
	docker-compose exec ollama ollama pull mistral:7b-instruct
	docker-compose exec ollama ollama pull nomic-embed-text

ollama-list: ## List installed Ollama models
	docker-compose exec ollama ollama list

ollama-remove: ## Remove a model (use MODEL=name)
	docker-compose exec ollama ollama rm $(MODEL)

# Testing commands
test: ## Run all tests
	docker-compose exec api pytest
	docker-compose exec web npm test

test-api: ## Run API tests
	docker-compose exec api pytest -v

test-api-cov: ## Run API tests with coverage
	docker-compose exec api pytest --cov=app --cov-report=html

test-web: ## Run frontend tests
	docker-compose exec web npm test

test-integration: ## Run integration tests
	docker-compose exec api pytest tests/integration/ -v

test-e2e: ## Run end-to-end tests
	docker-compose exec web npm run test:e2e

# Code quality
lint: ## Run linters
	docker-compose exec api black --check app/ tests/
	docker-compose exec api isort --check app/ tests/
	docker-compose exec api flake8 app/ tests/
	docker-compose exec web npm run lint

format: ## Format code
	docker-compose exec api black app/ tests/
	docker-compose exec api isort app/ tests/
	docker-compose exec web npm run format

typecheck: ## Run type checking
	docker-compose exec api mypy app/
	docker-compose exec web npm run typecheck

# Logs
logs: ## Show logs for all services
	docker-compose logs -f

logs-api: ## Show API logs
	docker-compose logs -f api

logs-ai: ## Show AI service logs
	docker-compose logs -f ai

logs-web: ## Show web logs
	docker-compose logs -f web

logs-celery: ## Show Celery worker logs
	docker-compose logs -f celery-worker

logs-postgres: ## Show PostgreSQL logs
	docker-compose logs -f postgres

# Shell access
shell-api: ## Open shell in API container
	docker-compose exec api bash

shell-ai: ## Open shell in AI container
	docker-compose exec ai bash

shell-web: ## Open shell in web container
	docker-compose exec web sh

shell-db: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U buildguard -d buildguard

# Utilities
ps: ## Show running services
	docker-compose ps

stats: ## Show resource usage
	docker stats

health: ## Check health of all services
	@echo "Checking service health..."
	@curl -f http://localhost:8000/health && echo "✓ API healthy" || echo "✗ API unhealthy"
	@curl -f http://localhost:8001/health && echo "✓ AI service healthy" || echo "✗ AI unhealthy"
	@curl -f http://localhost:3000 && echo "✓ Web healthy" || echo "✗ Web unhealthy"

setup: ## Initial setup (build, migrate, seed, pull models)
	@echo "Setting up BuildGuard Advisor..."
	docker-compose up -d postgres redis minio
	@echo "Waiting for database..."
	sleep 10
	$(MAKE) migrate
	$(MAKE) seed
	docker-compose up -d ollama
	@echo "Waiting for Ollama..."
	sleep 15
	$(MAKE) ollama-pull
	docker-compose up -d
	@echo "Setup complete! Access the app at http://localhost:3000"

backup-db: ## Backup database to file
	docker-compose exec -T postgres pg_dump -U buildguard buildguard > backup_$(shell date +%Y%m%d_%H%M%S).sql

restore-db: ## Restore database from file (use FILE=backup.sql)
	docker-compose exec -T postgres psql -U buildguard buildguard < $(FILE)

# Production commands (use with caution)
prod-build: ## Build production images
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-up: ## Start production stack
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down: ## Stop production stack
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
