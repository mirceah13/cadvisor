"""
Authentication service for user registration, login, and OAuth.
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.user import User
from app.models.organization import Organization
from app.schemas.auth import UserCreate, UserLogin, TokenResponse
from app.core.config import settings

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Service for handling authentication operations."""

    def __init__(self, db: Session):
        self.db = db

    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)

    def get_password_hash(self, password: str) -> str:
        """Generate password hash."""
        return pwd_context.hash(password)

    def create_access_token(
        self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
            )
        
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
        )
        return encoded_jwt

    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            return payload
        except JWTError:
            return None

    def register_user(
        self,
        email: str,
        password: str,
        full_name: str,
        organization_name: str,
    ) -> User:
        """
        Register a new user and create their organization.
        
        Args:
            email: User email address
            password: Plain text password
            full_name: User's full name
            organization_name: Name of the organization to create
            
        Returns:
            Created User object
            
        Raises:
            ValueError: If email already exists
        """
        # Check if user already exists
        existing_user = self.db.query(User).filter(User.email == email).first()
        if existing_user:
            raise ValueError("Email already registered")

        # Create organization
        organization = Organization(
            name=organization_name,
            subscription_tier="trial",
            subscription_status="active",
            trial_start=datetime.utcnow(),
            trial_end=datetime.utcnow() + timedelta(days=14),
        )
        self.db.add(organization)
        self.db.flush()

        # Create user
        hashed_password = self.get_password_hash(password)
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            organization_id=organization.id,
            role="admin",  # First user is admin
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        return user

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """
        Authenticate a user with email and password.
        
        Args:
            email: User email address
            password: Plain text password
            
        Returns:
            User object if authentication successful, None otherwise
        """
        user = self.db.query(User).filter(
            and_(User.email == email, User.is_active == True)
        ).first()

        if not user:
            return None

        if not self.verify_password(password, user.hashed_password):
            return None

        return user

    def login(self, email: str, password: str) -> TokenResponse:
        """
        Login user and return access token.
        
        Args:
            email: User email address
            password: Plain text password
            
        Returns:
            TokenResponse with access token and user info
            
        Raises:
            ValueError: If authentication fails
        """
        user = self.authenticate_user(email, password)
        if not user:
            raise ValueError("Invalid email or password")

        # Create access token
        access_token = self.create_access_token(
            data={"sub": user.email, "user_id": user.id, "org_id": user.organization_id}
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "organization_id": user.organization_id,
                "role": user.role,
            },
        )

    def oauth_login(
        self, provider: str, access_token: str, id_token: Optional[str] = None
    ) -> TokenResponse:
        """
        Handle OAuth login from external providers.
        
        Args:
            provider: OAuth provider (google, apple, microsoft)
            access_token: OAuth access token
            id_token: OAuth ID token (optional)
            
        Returns:
            TokenResponse with access token and user info
            
        Raises:
            ValueError: If OAuth verification fails
        """
        # Verify OAuth token and get user info
        user_info = self._verify_oauth_token(provider, access_token, id_token)
        
        if not user_info:
            raise ValueError("Failed to verify OAuth token")

        email = user_info.get("email")
        if not email:
            raise ValueError("Email not provided by OAuth provider")

        # Check if user exists
        user = self.db.query(User).filter(User.email == email).first()

        if not user:
            # Create new user from OAuth
            full_name = user_info.get("name", email.split("@")[0])
            organization_name = f"{full_name}'s Organization"
            
            user = self.register_user(
                email=email,
                password=self._generate_random_password(),  # Random password for OAuth users
                full_name=full_name,
                organization_name=organization_name,
            )

        # Create access token
        access_token = self.create_access_token(
            data={"sub": user.email, "user_id": user.id, "org_id": user.organization_id}
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user={
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "organization_id": user.organization_id,
                "role": user.role,
            },
        )

    def _verify_oauth_token(
        self, provider: str, access_token: str, id_token: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Verify OAuth token with provider.
        
        This is a placeholder that should be implemented with actual
        OAuth verification logic for each provider.
        """
        # TODO: Implement actual OAuth verification
        # For now, this is a placeholder
        # In production, verify tokens with:
        # - Google: google.oauth2.id_token.verify_oauth2_token
        # - Apple: Verify JWT with Apple's public keys
        # - Microsoft: Verify with Microsoft Graph API
        
        return {
            "email": f"oauth_user_{provider}@example.com",
            "name": f"OAuth User from {provider}",
        }

    def _generate_random_password(self) -> str:
        """Generate random password for OAuth users."""
        import secrets
        return secrets.token_urlsafe(32)

    def get_current_user(self, token: str) -> Optional[User]:
        """
        Get current user from JWT token.
        
        Args:
            token: JWT access token
            
        Returns:
            User object if token valid, None otherwise
        """
        payload = self.verify_token(token)
        if not payload:
            return None

        email: str = payload.get("sub")
        if not email:
            return None

        user = self.db.query(User).filter(
            and_(User.email == email, User.is_active == True)
        ).first()
        
        return user
