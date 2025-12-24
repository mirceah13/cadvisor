"""
Authentication endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timedelta
from typing import Optional
import logging
from slugify import slugify

from app.core.database import get_db
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
)
from app.models import User, Organization, Subscription, SubscriptionStatus, OrgMember, OrgMemberStatus, UserRole

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer()


# Schemas
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    organization_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OAuthRequest(BaseModel):
    access_token: str
    id_token: Optional[str] = None
    provider: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict



@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: SignupRequest, db: Session = Depends(get_db)):
    """
    Create a new user account with organization
    """
    # Check if user exists
    existing_user = db.query(User).filter(User.email == request.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create organization with slug
    organization = Organization(
        name=request.organization_name,
        slug=slugify(request.organization_name),
    )
    db.add(organization)
    db.flush()
    
    # Create trial subscription
    subscription = Subscription(
        org_id=organization.id,
        provider="trial",
        plan="trial",
        status=SubscriptionStatus.TRIAL,
        trial_ends_at=datetime.utcnow() + timedelta(days=14),
        limits={
            "max_projects": 3,
            "max_submissions_per_month": 10,
            "max_users": 3,
            "max_storage_gb": 5
        }
    )
    db.add(subscription)
    db.flush()
    
    # Create user
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.full_name,
        is_active=True,
        email_verified=False,
    )
    db.add(user)
    db.flush()
    
    # Create org membership
    org_member = OrgMember(
        org_id=organization.id,
        user_id=user.id,
        role=UserRole.ADMIN,
        status=OrgMemberStatus.ACTIVE,
    )
    db.add(org_member)
    
    db.commit()
    db.refresh(user)
    
    logger.info(f"User created: {user.email}, Organization: {organization.name}")
    
    # Generate token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": str(user.id),
            "org_id": str(organization.id)
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "organization_id": str(organization.id),
            "role": org_member.role.value,
        },
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with email and password
    """
    user = db.query(User).filter(User.email == request.email).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )
    
    # Get user's organization membership
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == user.id,
        OrgMember.status == OrgMemberStatus.ACTIVE
    ).first()
    
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active organization membership",
        )
    
    logger.info(f"User logged in: {user.email}")
    
    # Generate token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": str(user.id),
            "org_id": str(org_member.org_id)
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "organization_id": str(org_member.org_id),
            "role": org_member.role.value,
        },
    )


@router.post("/oauth/{provider}", response_model=TokenResponse)
async def oauth_login(provider: str, request: OAuthRequest, db: Session = Depends(get_db)):
    """
    Login with OAuth provider (Google, Apple, Microsoft)
    """
    if provider not in ["google", "apple", "microsoft"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported OAuth provider",
        )
    
    # TODO: Verify OAuth token with provider
    # For now, this is a placeholder
    # In production, verify tokens with the respective provider APIs
    
    # Mock user info from OAuth
    # In production, extract from verified token
    email = f"oauth_{provider}@example.com"
    full_name = f"OAuth User from {provider.title()}"
    
    # Check if user exists
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Create new user from OAuth
        organization = Organization(
            name=f"{full_name}'s Organization",
            subscription_tier="trial",
            subscription_status="active",
            trial_start=datetime.utcnow(),
            trial_end=datetime.utcnow() + timedelta(days=14),
        )
        db.add(organization)
        db.flush()
        
        import secrets
        user = User(
            email=email,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            full_name=full_name,
            organization_id=organization.id,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        logger.info(f"User created via OAuth: {user.email}")
    
    # Generate token
    access_token = create_access_token(
        data={
            "sub": user.email,
            "user_id": user.id,
            "org_id": user.organization_id
        }
    )
    
    return TokenResponse(
        access_token=access_token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "organization_id": user.organization_id,
            "role": user.role,
        },
    )


@router.get("/me")
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user
    """
    from jose import JWTError, jwt
    from app.core.config import settings
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "organization_id": user.organization_id,
        "role": user.role,
        "is_active": user.is_active,
    }


@router.post("/logout")
async def logout():
    """
    Logout (client should discard tokens)
    """
    return {"message": "Logged out successfully"}
