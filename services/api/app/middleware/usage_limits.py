"""
Usage Limit Middleware - Enforces subscription limits across API
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.database import SessionLocal
from app.services.subscription import SubscriptionService


class UsageLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce subscription usage limits
    
    Checks limits before allowing certain operations:
    - File uploads (file size limits)
    - Project creation (max projects)
    - Submission creation (submissions per month)
    - Analysis runs (analyses per day)
    - KB source uploads (max KB sources)
    """
    
    # Paths that require limit checks
    LIMIT_CHECKS = {
        "/api/v1/projects": {"method": "POST", "limit_type": "projects"},
        "/api/v1/submissions": {"method": "POST", "limit_type": "submissions_per_month"},
        "/api/v1/analysis/start": {"method": "POST", "limit_type": "analysis_per_day"},
        "/api/v1/kb/sources": {"method": "POST", "limit_type": "kb_sources"},
    }
    
    async def dispatch(self, request: Request, call_next):
        # Skip limit checks for certain paths
        if self._should_skip_check(request):
            return await call_next(request)
        
        # Check if path requires limit enforcement
        limit_config = self._get_limit_config(request)
        if not limit_config:
            return await call_next(request)
        
        # Get organization ID from user (requires authentication)
        try:
            # User is attached to request by authentication middleware
            user = getattr(request.state, "user", None)
            if not user:
                # If no user, let the auth middleware handle it
                return await call_next(request)
            
            organization_id = user.organization_id
            
            # Check limit
            db = SessionLocal()
            try:
                service = SubscriptionService(db)
                allowed, error_message = service.check_limit(
                    organization_id=organization_id,
                    limit_type=limit_config["limit_type"],
                    requested_amount=1
                )
                
                if not allowed:
                    return JSONResponse(
                        status_code=429,  # Too Many Requests
                        content={
                            "detail": error_message,
                            "limit_type": limit_config["limit_type"],
                            "upgrade_url": "/billing/upgrade"
                        }
                    )
            finally:
                db.close()
        
        except Exception as e:
            # Log error but don't block request
            print(f"Error checking usage limit: {e}")
        
        return await call_next(request)
    
    def _should_skip_check(self, request: Request) -> bool:
        """Check if request should skip limit checks"""
        # Skip for certain paths
        skip_paths = [
            "/health",
            "/docs",
            "/openapi.json",
            "/api/v1/auth",
            "/api/v1/billing"
        ]
        
        return any(request.url.path.startswith(path) for path in skip_paths)
    
    def _get_limit_config(self, request: Request):
        """Get limit configuration for path and method"""
        for path, config in self.LIMIT_CHECKS.items():
            if request.url.path.startswith(path) and request.method == config["method"]:
                return config
        
        return None
