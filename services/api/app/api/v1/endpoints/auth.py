"""
Authentication endpoints
"""
import re
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field, field_validator
from slugify import slugify
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.email import (
    send_password_changed_email,
    send_password_reset_email,
    send_verification_email,
)
from app.core.security import (
    blacklist_token,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    is_token_blacklisted,
    verify_password,
)
from app.models import (
    OrgMember,
    OrgMemberStatus,
    Organization,
    Subscription,
    SubscriptionStatus,
    User,
    UserRole,
)

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer()
limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# Redis-based account lockout helpers
# ---------------------------------------------------------------------------
_LOCKOUT_PREFIX = "auth:lockout:"
_FAIL_PREFIX = "auth:fails:"
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 15 * 60   # 15 minutes
FAIL_WINDOW_SECONDS = 10 * 60  # sliding 10-minute window


def _redis():
    from app.core.security import get_redis
    return get_redis()


def _check_lockout(email: str) -> None:
    """Raise 429 if the account is currently locked out."""
    try:
        r = _redis()
        if r.exists(f"{_LOCKOUT_PREFIX}{email}"):
            ttl = r.ttl(f"{_LOCKOUT_PREFIX}{email}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked. Try again in {ttl // 60 + 1} minutes.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Redis lockout check failed: {e}")


def _record_failed_attempt(email: str) -> None:
    """Increment failed login counter; lock account after MAX_FAILED_ATTEMPTS."""
    try:
        r = _redis()
        key = f"{_FAIL_PREFIX}{email}"
        count = r.incr(key)
        r.expire(key, FAIL_WINDOW_SECONDS)
        if count >= MAX_FAILED_ATTEMPTS:
            r.setex(f"{_LOCKOUT_PREFIX}{email}", LOCKOUT_SECONDS, "1")
            r.delete(key)
    except Exception as e:
        logger.error(f"Redis failed attempt recording failed: {e}")


def _clear_failed_attempts(email: str) -> None:
    try:
        _redis().delete(f"{_FAIL_PREFIX}{email}")
    except Exception as e:
        logger.error(f"Redis clear attempts failed: {e}")


# ---------------------------------------------------------------------------
# Password policy
# ---------------------------------------------------------------------------
_PASS_RE = re.compile(
    r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]).{8,}$'
)


def _validate_password_strength(password: str) -> str:
    if not _PASS_RE.match(password):
        raise ValueError(
            "Password must be at least 8 characters and contain uppercase, "
            "lowercase, a digit, and a special character."
        )
    return password


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    organization_name: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def strong_new_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class PasswordResetRequestSchema(BaseModel):
    email: EmailStr


class PasswordResetConfirmSchema(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def strong_reset_password(cls, v: str) -> str:
        return _validate_password_strength(v)


class EmailVerifySchema(BaseModel):
    token: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _token_data(user: User, org_id) -> dict:
    return {"sub": str(user.id), "email": user.email, "org_id": str(org_id)}


def _user_payload(user: User, org_member: OrgMember) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "organization_id": str(org_member.org_id),
        "role": org_member.role.value,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(f"{settings.RATE_LIMIT_AUTH_PER_MINUTE}/minute")
async def register(http_request: Request, request: SignupRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Create a new user account with organization."""
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    organization = Organization(
        name=request.organization_name,
        slug=slugify(request.organization_name),
    )
    db.add(organization)
    db.flush()

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
            "max_storage_gb": 5,
        },
    )
    db.add(subscription)
    db.flush()

    verify_token = secrets.token_urlsafe(32)
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        name=request.full_name,
        is_active=True,
        email_verified=False,
        email_verify_token=verify_token,
        email_verify_token_expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(user)
    db.flush()

    org_member = OrgMember(
        org_id=organization.id,
        user_id=user.id,
        role=UserRole.ADMIN,
        status=OrgMemberStatus.ACTIVE,
    )
    db.add(org_member)
    db.commit()
    db.refresh(user)

    logger.info(f"User registered: {user.email}, org: {organization.name}")
    if settings.DEBUG:
        logger.info(f"[DEV] Email verification token for {user.email}: {verify_token}")
    background_tasks.add_task(send_verification_email, user.email, verify_token)

    data = _token_data(user, organization.id)
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        user=_user_payload(user, org_member),
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit(f"{settings.RATE_LIMIT_AUTH_PER_MINUTE}/minute")
async def login(http_request: Request, request: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password."""
    _check_lockout(request.email)

    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        _record_failed_attempt(request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == user.id,
        OrgMember.status == OrgMemberStatus.ACTIVE,
    ).first()
    if not org_member:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    _clear_failed_attempts(request.email)
    user.last_login_at = datetime.utcnow()
    db.commit()

    logger.info(f"User logged in: {user.email}")
    data = _token_data(user, org_member.org_id)
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        user=_user_payload(user, org_member),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh token pair."""
    try:
        payload = decode_token(request.refresh_token)
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    jti = payload.get("jti")
    if jti:
        if is_token_blacklisted(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has already been used",
            )
        exp = payload.get("exp", 0)
        remaining = int(exp - datetime.utcnow().timestamp())
        if remaining > 0:
            blacklist_token(jti, remaining)

    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == user.id, OrgMember.status == OrgMemberStatus.ACTIVE
    ).first()
    if not org_member:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No active org membership")

    data = _token_data(user, org_member.org_id)
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        user=_user_payload(user, org_member),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Revoke the current access token."""
    try:
        payload = decode_token(credentials.credentials)
        jti = payload.get("jti")
        exp = payload.get("exp", 0)
        if jti:
            remaining = int(exp - datetime.utcnow().timestamp())
            if remaining > 0:
                blacklist_token(jti, remaining)
    except HTTPException:
        pass  # Already invalid — fine


@router.post("/verify-email")
async def verify_email(request: EmailVerifySchema, db: Session = Depends(get_db)):
    """Mark email as verified using the one-time token sent at registration."""
    user = db.query(User).filter(User.email_verify_token == request.token).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    if user.email_verify_token_expires_at and user.email_verify_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    user.email_verified = True
    user.email_verify_token = None
    user.email_verify_token_expires_at = None
    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(request: PasswordResetRequestSchema, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Request a password-reset link. Always 204 to avoid user enumeration."""
    user = db.query(User).filter(User.email == request.email).first()
    if user and user.is_active:
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = reset_token
        user.password_reset_token_expires_at = datetime.utcnow() + timedelta(hours=1)
        db.commit()
        if settings.DEBUG:
            logger.info(f"[DEV] Password reset token for {user.email}: {reset_token}")
        background_tasks.add_task(send_password_reset_email, user.email, reset_token)


@router.post("/reset-password")
async def reset_password(request: PasswordResetConfirmSchema, db: Session = Depends(get_db)):
    """Reset the password using the token from the forgot-password email."""
    user = db.query(User).filter(User.password_reset_token == request.token).first()
    if not user or (
        user.password_reset_token_expires_at and user.password_reset_token_expires_at < datetime.utcnow()
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    user.password_hash = get_password_hash(request.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires_at = None
    db.commit()
    logger.info(f"Password reset for user: {user.email}")
    return {"message": "Password reset successfully"}


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: PasswordChangeRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the authenticated user''s password."""
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.password_hash = get_password_hash(request.new_password)
    db.commit()
    logger.info(f"Password changed for: {current_user.email}")
    background_tasks.add_task(send_password_changed_email, current_user.email)


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current authenticated user."""
    org_member = db.query(OrgMember).filter(
        OrgMember.user_id == current_user.id, OrgMember.status == OrgMemberStatus.ACTIVE
    ).first()
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "email_verified": current_user.email_verified,
        "is_active": current_user.is_active,
        "organization_id": str(org_member.org_id) if org_member else None,
        "role": org_member.role.value if org_member else None,
    }
