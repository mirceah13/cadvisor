"""
RBAC (Role-Based Access Control) utilities
"""
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Organization, OrgMember, UserRole


# Permission matrix
PERMISSIONS = {
    UserRole.OWNER: {
        "org:delete",
        "org:update",
        "org:invite",
        "org:remove_member",
        "org:manage_billing",
        "project:create",
        "project:update",
        "project:delete",
        "submission:create",
        "submission:update",
        "submission:delete",
        "submission:analyze",
        "finding:review",
        "kb:create",
        "kb:update",
        "kb:delete",
        "ruleset:create",
        "ruleset:update",
        "ruleset:activate",
    },
    UserRole.ADMIN: {
        "org:update",
        "org:invite",
        "project:create",
        "project:update",
        "project:delete",
        "submission:create",
        "submission:update",
        "submission:delete",
        "submission:analyze",
        "finding:review",
        "kb:create",
        "kb:update",
        "kb:delete",
        "ruleset:create",
        "ruleset:update",
    },
    UserRole.REVIEWER: {
        "project:create",
        "project:update",
        "submission:create",
        "submission:update",
        "submission:analyze",
        "finding:review",
    },
    UserRole.CONTRIBUTOR: {
        "project:create",
        "submission:create",
        "submission:update",
        "submission:analyze",
    },
    UserRole.VIEWER: {
        # View-only access
    },
}


def has_permission(role: UserRole, permission: str) -> bool:
    """Check if a role has a specific permission"""
    return permission in PERMISSIONS.get(role, set())


def get_user_org_role(db: Session, user_id: UUID, org_id: UUID) -> Optional[UserRole]:
    """Get user's role in an organization"""
    membership = (
        db.query(OrgMember)
        .filter(
            OrgMember.user_id == user_id,
            OrgMember.org_id == org_id,
            OrgMember.status == "active",
        )
        .first()
    )
    
    if membership:
        return membership.role
    return None


def require_permission(permission: str):
    """
    Dependency to require a specific permission in an organization context
    Usage: require_permission("project:create")
    """
    async def permission_checker(
        org_id: UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        role = get_user_org_role(db, current_user.id, org_id)
        
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization",
            )
        
        if not has_permission(role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: {permission} required",
            )
        
        return current_user
    
    return permission_checker


def require_any_permission(permissions: List[str]):
    """
    Dependency to require any of the specified permissions
    """
    async def permission_checker(
        org_id: UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        role = get_user_org_role(db, current_user.id, org_id)
        
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization",
            )
        
        has_any = any(has_permission(role, perm) for perm in permissions)
        if not has_any:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: one of {permissions} required",
            )
        
        return current_user
    
    return permission_checker


def require_org_membership():
    """
    Dependency to require org membership (any role)
    """
    async def membership_checker(
        org_id: UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        role = get_user_org_role(db, current_user.id, org_id)
        
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization",
            )
        
        return current_user
    
    return membership_checker


class RBACChecker:
    """RBAC checker class for route dependencies"""
    
    def __init__(self, required_permission: str):
        self.required_permission = required_permission
    
    async def __call__(
        self,
        org_id: UUID,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        role = get_user_org_role(db, current_user.id, org_id)
        
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this organization",
            )
        
        if not has_permission(role, self.required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions: {self.required_permission} required",
            )
        
        return current_user
