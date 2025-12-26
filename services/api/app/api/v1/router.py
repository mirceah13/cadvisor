"""
API v1 Router - Main router that includes all sub-routers
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, organizations, projects, submissions, submissions_crud, files, analysis, kb, billing, feedback, reports

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(submissions_crud.router, prefix="/submissions", tags=["Submissions"])
api_router.include_router(submissions.router, prefix="/submission-profiles", tags=["Submission Profiles"])
api_router.include_router(files.router, prefix="/files", tags=["Files"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["Analysis"])
api_router.include_router(kb.router, prefix="/kb", tags=["Knowledge Base"])
api_router.include_router(billing.router, prefix="/billing", tags=["Billing"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["Feedback"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
