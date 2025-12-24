"""
AI Service - Main Application Module
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api.router import api_router

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="BuildGuard Advisor AI Service",
    description="AI orchestration service for CAD analysis and RAG",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai",
        "version": "1.0.0",
    }


# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "BuildGuard Advisor AI Service",
        "version": "1.0.0",
    }
