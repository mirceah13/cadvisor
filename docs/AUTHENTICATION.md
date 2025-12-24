# Authentication System

Complete authentication implementation with email/password and OAuth social login (Google, Apple, Microsoft).

## Architecture

### Frontend (Next.js 14 + NextAuth.js)
- **NextAuth.js v5** with JWT strategy
- **OAuth Providers**: Google, Apple, Microsoft
- **Credentials Provider**: Email/password authentication
- **Session Management**: JWT-based sessions (30-day expiry)
- **Protected Routes**: Middleware-based route protection

### Backend (FastAPI)
- **JWT Authentication**: Jose library for token generation/validation
- **Password Hashing**: Bcrypt via Passlib
- **OAuth Integration**: Token exchange endpoints
- **Multi-tenant**: Organization-based user management

## Files Created

### Frontend

#### Configuration
- `apps/web/src/lib/auth.ts` - NextAuth configuration with all providers
- `apps/web/src/types/next-auth.d.ts` - TypeScript type extensions
- `apps/web/src/middleware.ts` - Protected route middleware

#### API Routes
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` - NextAuth API handler

#### Pages
- `apps/web/src/app/auth/login/page.tsx` - Login page (email + social)
- `apps/web/src/app/auth/signup/page.tsx` - Registration page
- `apps/web/src/app/auth/error/page.tsx` - OAuth error handler

#### Components & Hooks
- `apps/web/src/components/providers/auth-provider.tsx` - Session provider wrapper
- `apps/web/src/hooks/use-auth.ts` - Custom auth hook
- `apps/web/src/lib/api-client.ts` - API client with auto token injection

### Backend

#### Endpoints (Updated)
- `services/api/app/api/v1/endpoints/auth.py` - Auth API endpoints
  - `POST /auth/register` - User registration + org creation
  - `POST /auth/login` - Email/password login
  - `POST /auth/oauth/{provider}` - OAuth login (google/apple/microsoft)
  - `GET /auth/me` - Get current user
  - `POST /auth/logout` - Logout

#### Services (Created)
- `services/api/app/services/auth.py` - Authentication service
- `services/api/app/schemas/auth.py` - Auth schemas

## Setup Instructions

### 1. Environment Variables

Create `apps/web/.env.local`:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-in-production

# API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple OAuth
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-client-secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

### 2. Generate NextAuth Secret

```bash
# Generate a secure secret
openssl rand -base64 32
```

### 3. Configure OAuth Providers

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret

#### Apple OAuth
1. Go to [Apple Developer Console](https://developer.apple.com)
2. Create a Services ID
3. Enable Sign in with Apple
4. Configure domains and redirect URLs
5. Create a private key
6. Copy Client ID and generate Client Secret

#### Microsoft OAuth
1. Go to [Azure Portal](https://portal.azure.com)
2. Register a new application
3. Add redirect URI: `http://localhost:3000/api/auth/callback/microsoft`
4. Create a client secret
5. Copy Application (client) ID and Client Secret

## Usage

### Frontend - Login with Credentials

```typescript
import { signIn } from 'next-auth/react'

const result = await signIn('credentials', {
  email: 'user@example.com',
  password: 'password123',
  redirect: false,
  callbackUrl: '/dashboard'
})

if (result?.ok) {
  router.push('/dashboard')
}
```

### Frontend - Login with OAuth

```typescript
import { signIn } from 'next-auth/react'

// Google
await signIn('google', { callbackUrl: '/dashboard' })

// Apple
await signIn('apple', { callbackUrl: '/dashboard' })

// Microsoft
await signIn('microsoft', { callbackUrl: '/dashboard' })
```

### Frontend - Get Current User

```typescript
import { useAuth } from '@/hooks/use-auth'

function MyComponent() {
  const { user, isLoading, isAuthenticated } = useAuth()
  
  if (isLoading) return <div>Loading...</div>
  if (!isAuthenticated) return <div>Not logged in</div>
  
  return <div>Welcome, {user?.name}</div>
}
```

### Frontend - API Calls with Auth

```typescript
import { api } from '@/lib/api-client'

// Automatically includes auth token
const projects = await api.get('/api/v1/projects')

// Upload file
const formData = new FormData()
formData.append('file', file)
await api.upload('/api/v1/files/upload', formData, (progress) => {
  console.log(`Upload progress: ${progress}%`)
})
```

### Backend - Get Current User

```python
from fastapi import Depends
from app.api.v1.endpoints.auth import get_current_user
from app.models import User

@router.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"user_id": current_user.id}
```

## Security Features

### Frontend
- **JWT Sessions**: Secure token storage in HTTP-only cookies
- **CSRF Protection**: Built-in NextAuth CSRF protection
- **Password Validation**: Client-side strength meter
- **Input Sanitization**: Zod schema validation

### Backend
- **Bcrypt Hashing**: Password hashing with salt
- **JWT Tokens**: Signed with HS256 algorithm
- **Token Expiry**: 30-day access token lifetime
- **CORS**: Configured for frontend origin

## Protected Routes

All routes matching these patterns require authentication:
- `/dashboard/*`
- `/projects/*`
- `/submissions/*`
- `/knowledge-base/*`
- `/reports/*`
- `/settings/*`

Unauthenticated users are redirected to `/auth/login`.

## User Registration Flow

1. User fills signup form with email, password, name, organization
2. Frontend validates password strength (min 8 chars, uppercase, lowercase, number, special char)
3. Backend creates Organization with Trial subscription (14 days)
4. Backend creates User with "admin" role
5. User receives access token
6. User redirected to dashboard

## OAuth Flow

1. User clicks OAuth provider button (Google/Apple/Microsoft)
2. Redirected to provider's consent screen
3. User grants permissions
4. Provider redirects back with authorization code
5. NextAuth exchanges code for access token
6. Backend receives OAuth token, verifies with provider
7. If user exists, login; otherwise create new user + org
8. User receives JWT access token
9. User redirected to dashboard

## API Integration

The frontend API client automatically:
- Adds `Authorization: Bearer <token>` to all requests
- Handles 401 responses by redirecting to login
- Supports multipart file uploads with progress
- Types responses with TypeScript generics

## Testing Authentication

### Test Credentials Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Test Register
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"newuser@example.com",
    "password":"SecurePass123!",
    "full_name":"New User",
    "organization_name":"Test Org"
  }'
```

### Test Get Current User
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <your-token>"
```

## Troubleshooting

### "Error: No secret provided"
- Set `NEXTAUTH_SECRET` in `.env.local`
- Generate with: `openssl rand -base64 32`

### OAuth redirect errors
- Verify redirect URIs match in OAuth provider settings
- Check `NEXTAUTH_URL` is correct

### 401 Unauthorized
- Token may be expired (30-day lifetime)
- Check Authorization header format: `Bearer <token>`
- Verify backend can decode JWT with same secret

### CORS errors
- Ensure backend CORS allows frontend origin
- Check `NEXT_PUBLIC_API_URL` matches backend URL

## Next Steps

1. **Implement OAuth Token Verification**: Replace placeholder OAuth verification with actual provider API calls
2. **Add Email Verification**: Send verification emails on signup
3. **Password Reset Flow**: Forgot password functionality
4. **Two-Factor Authentication**: TOTP-based 2FA
5. **Session Management**: View/revoke active sessions
6. **Audit Logging**: Log authentication events

## Dependencies

### Frontend
- `next-auth@latest` - NextAuth.js v5
- `@auth/core` - NextAuth core
- `bcryptjs` - Client-side password hashing (optional)
- `axios` - HTTP client

### Backend
- `python-jose[cryptography]` - JWT handling
- `passlib[argon2]` - Password hashing
- `argon2-cffi` - Argon2 implementation
- `email-validator` - Email validation

## Production Checklist

- [ ] Generate strong `NEXTAUTH_SECRET` (32+ chars)
- [ ] Configure production OAuth redirect URIs
- [ ] Set up HTTPS for production
- [ ] Enable rate limiting on auth endpoints
- [ ] Configure session timeout policies
- [ ] Set up monitoring for failed login attempts
- [ ] Implement account lockout after N failures
- [ ] Add email verification requirement
- [ ] Configure backup/recovery codes for 2FA
- [ ] Set up audit logging
- [ ] Review and update CORS policies
- [ ] Enable security headers (CSP, HSTS, etc.)

## References

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
