"""
Organizations endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from uuid import UUID
import logging

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Organization, OrgMember, UserRole, OrgMemberStatus

router = APIRouter()
logger = logging.getLogger(__name__)


# Schemas
class OrganizationCreate(BaseModel):
    name: str
    description: str = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: str = None
    
    class Config:
        from_attributes = True


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    request: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new organization
    """
    # Generate slug from name
    slug = request.name.lower().replace(" ", "-").replace("_", "-")
    
    # Check if slug exists
    existing = db.query(Organization).filter(Organization.slug == slug).first()
    if existing:
        # Add unique suffix
        import random
        slug = f"{slug}-{random.randint(1000, 9999)}"
    
    # Create organization
    org = Organization(
        name=request.name,
        slug=slug,
        description=request.description,
    )
    db.add(org)
    db.flush()
    
    # Add creator as owner
    membership = OrgMember(
        org_id=org.id,
        user_id=current_user.id,
        role=UserRole.OWNER,
        status=OrgMemberStatus.ACTIVE,
    )
    db.add(membership)
    
    # Create default subscription (trial)
    from app.models import Subscription, SubscriptionStatus
    from datetime import datetime, timedelta
    
    subscription = Subscription(
        org_id=org.id,
        provider="mock",
        plan="trial",
        status=SubscriptionStatus.TRIAL,
        trial_ends_at=datetime.utcnow() + timedelta(days=14),
        limits={
            "max_projects": 3,
            "max_submissions_per_month": 10,
            "max_file_size_mb": 50,
            "max_analysis_per_day": 5,
        },
    )
    db.add(subscription)
    
    db.commit()
    db.refresh(org)
    
    logger.info(f"Organization created: {org.name} by {current_user.email}")
    
    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        slug=org.slug,
        description=org.description,
    )


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List organizations where user is a member
    """
    memberships = (
        db.query(OrgMember)
        .filter(
            OrgMember.user_id == current_user.id,
            OrgMember.status == OrgMemberStatus.ACTIVE,
        )
        .all()
    )
    
    orgs = [m.organization for m in memberships if not m.organization.is_deleted]
    
    return [
        OrganizationResponse(
            id=str(org.id),
            name=org.name,
            slug=org.slug,
            description=org.description,
        )
        for org in orgs
    ]
