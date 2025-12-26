#!/usr/bin/env pwsh
# Setup AI Services for CADVisor
# This script pulls required LLM models and seeds the knowledge base

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CADVisor AI Services Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if Ollama container is running
Write-Host "🔍 Checking Ollama service..." -ForegroundColor Yellow
$ollamaStatus = docker compose ps ollama --format json | ConvertFrom-Json
if ($ollamaStatus.State -ne "running") {
    Write-Host "❌ Ollama is not running. Please start it with: docker compose up -d ollama" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Ollama is running`n" -ForegroundColor Green

# Pull embedding model
Write-Host "📥 Pulling embedding model (nomic-embed-text)..." -ForegroundColor Yellow
Write-Host "   This model is used for generating vector embeddings" -ForegroundColor Gray
docker exec cadvisor-ollama ollama pull nomic-embed-text
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Embedding model ready`n" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to pull embedding model" -ForegroundColor Red
    exit 1
}

# Pull LLM model
Write-Host "📥 Pulling LLM model (llama3.2:3b)..." -ForegroundColor Yellow
Write-Host "   This model is used for compliance analysis" -ForegroundColor Gray
docker exec cadvisor-ollama ollama pull llama3.2:3b
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ LLM model ready`n" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to pull LLM model" -ForegroundColor Red
    exit 1
}

# List available models
Write-Host "📋 Available models:" -ForegroundColor Yellow
docker exec cadvisor-ollama ollama list
Write-Host ""

# Seed knowledge base
Write-Host "🌱 Seeding knowledge base with building codes..." -ForegroundColor Yellow
Write-Host "   This will populate the KB with sample compliance documents" -ForegroundColor Gray
docker exec cadvisor-api python scripts/seed_knowledge_base.py

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  ✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "`n💡 You can now run compliance analysis from the web interface!" -ForegroundColor Yellow
Write-Host "   Navigate to Analysis tab and click 'Run Analysis'`n" -ForegroundColor Gray
