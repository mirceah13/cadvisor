"""
Pydantic schemas for authentication.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    organization_name: str


class UserLogin(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema for token response."""
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class OAuthLogin(BaseModel):
    """Schema for OAuth login."""
    access_token: str
    id_token: Optional[str] = None
    provider: str


class UserResponse(BaseModel):
    """Schema for user response."""
    id: int
    email: str
    full_name: Optional[str] = None
    organization_id: int
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    """Schema for password change."""
    current_password: str
    new_password: str = Field(..., min_length=8)
