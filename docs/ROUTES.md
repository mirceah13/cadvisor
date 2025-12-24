# CADVisor Routes & Pages

## Current Implementation Status

### ✅ Public Routes (No Authentication Required)

| Route | Purpose | Status |
|-------|---------|--------|
| `/` | Landing page with features & CTA | ✅ Complete |
| `/auth/login` | Login with email/password + OAuth | ✅ Complete |
| `/auth/signup` | User registration + org creation | ✅ Complete |
| `/auth/error` | OAuth error handling | ✅ Complete |

### ✅ Protected Routes (Authentication Required)

| Route | Purpose | Status |
|-------|---------|--------|
| `/dashboard` | Main dashboard with metrics & activity | ✅ Complete |
| `/profile` | User profile information | ✅ Complete |
| `/settings/security` | Password change & security settings | ✅ Complete |

### ⏳ Planned Routes (Backend Complete, Frontend Pending)

| Route | Purpose | Backend API | Frontend |
|-------|---------|-------------|----------|
| `/projects` | List all projects | ✅ Ready | ⏳ Pending |
| `/projects/new` | Create new project | ✅ Ready | ⏳ Pending |
| `/projects/[id]` | Project detail page | ✅ Ready | ⏳ Pending |
| `/submissions` | List all submissions | ✅ Ready | ⏳ Pending |
| `/submissions/upload` | Upload submission files | ✅ Ready | ⏳ Pending |
| `/submissions/[id]` | Submission detail & analysis | ✅ Ready | ⏳ Pending |
| `/findings` | Review queue for findings | ✅ Ready | ⏳ Pending |
| `/findings/[id]` | Finding detail with feedback | ✅ Ready | ⏳ Pending |
| `/knowledge-base` | KB source management | ✅ Ready | ⏳ Pending |
| `/knowledge-base/upload` | Upload KB documents | ✅ Ready | ⏳ Pending |
| `/knowledge-base/search` | Search KB | ✅ Ready | ⏳ Pending |
| `/reports` | Report history | ✅ Ready | ⏳ Pending |
| `/reports/generate` | Generate new report | ✅ Ready | ⏳ Pending |
| `/billing` | Subscription & usage | ✅ Ready | ⏳ Pending |
| `/settings` | General settings | Partial | ⏳ Pending |

## Authentication Flow

### Login Flow
1. User visits `/auth/login`
2. Options:
   - Enter email/password → `POST /api/v1/auth/login`
   - Click Google/Apple/Microsoft → OAuth flow
3. On success: JWT token issued, redirect to `/dashboard`
4. Token stored in HTTP-only cookie (NextAuth session)
5. Protected routes check token via middleware

### Registration Flow
1. User visits `/auth/signup`
2. Fill form: email, password, name, organization name
3. Submit → `POST /api/v1/auth/register`
4. Backend creates:
   - Organization (14-day trial)
   - User (admin role)
5. Redirect to `/auth/login` with success message

### OAuth Flow
1. User clicks OAuth button
2. Redirect to provider (Google/Apple/Microsoft)
3. User grants permissions
4. Provider redirects back to `/api/auth/callback/{provider}`
5. NextAuth exchanges code for token
6. Backend receives OAuth token → `POST /api/v1/auth/oauth/{provider}`
7. If user exists: login; else: create new user + org
8. JWT issued, redirect to `/dashboard`

## API Client Integration

All protected routes automatically inject JWT token:

```typescript
import { api } from '@/lib/api-client'

// Automatically includes Authorization: Bearer <token>
const projects = await api.get('/api/v1/projects')
const submission = await api.post('/api/v1/submissions', data)
```

## Route Protection

Middleware protects these paths (see `apps/web/src/middleware.ts`):
- `/dashboard/*`
- `/projects/*`
- `/submissions/*`
- `/knowledge-base/*`
- `/reports/*`
- `/settings/*`

Unauthenticated requests redirect to `/auth/login`.

## Environment Setup

Required `.env.local` variables:

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# API
NEXT_PUBLIC_API_URL=http://localhost:8000

# OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

## Testing Routes Locally

```bash
# Start backend
cd services/api
docker compose up -d

# Start frontend
cd apps/web
npm install
npm run dev

# Access app
http://localhost:3000
```

### Test Flow
1. Visit http://localhost:3000
2. Click "Sign Up" → Register new account
3. Login at http://localhost:3000/auth/login
4. View dashboard at http://localhost:3000/dashboard
5. Edit profile at http://localhost:3000/profile
6. Change password at http://localhost:3000/settings/security

## Next Steps

### Priority 1: Essential Pages
- [ ] `/projects` - Project list & create
- [ ] `/submissions` - Submission list & upload
- [ ] `/submissions/[id]` - View analysis results

### Priority 2: Review Workflow
- [ ] `/findings` - Review queue
- [ ] `/findings/[id]` - Finding detail with feedback

### Priority 3: Knowledge Base
- [ ] `/knowledge-base` - Manage KB sources
- [ ] `/knowledge-base/upload` - Upload documents

### Priority 4: Reports & Billing
- [ ] `/reports` - Report history
- [ ] `/billing` - Subscription management

## Backend API Endpoints Ready

All these endpoints are implemented and ready for frontend integration:

### Projects
- `GET /api/v1/projects`
- `POST /api/v1/projects`
- `GET /api/v1/projects/{id}`
- `PATCH /api/v1/projects/{id}`
- `DELETE /api/v1/projects/{id}`

### Submissions
- `GET /api/v1/submissions`
- `POST /api/v1/submissions`
- `GET /api/v1/submissions/{id}`

### Files
- `POST /api/v1/files/presign-upload`
- `POST /api/v1/files/complete-upload`
- `GET /api/v1/files/{id}/download`

### Analysis
- `POST /api/v1/analysis/start`
- `GET /api/v1/analysis/submissions/{id}/runs`
- `GET /api/v1/analysis/submissions/{id}/findings`

### Feedback & Review
- `POST /api/v1/feedback`
- `PUT /api/v1/findings/{id}/status`
- `POST /api/v1/findings/{id}/assign`

### Knowledge Base
- `POST /api/v1/kb/sources`
- `GET /api/v1/kb/sources`
- `POST /api/v1/kb/search`

### Reports
- `POST /api/v1/reports/generate`
- `GET /api/v1/reports/download/{id}`

### Billing
- `GET /api/v1/billing/subscription`
- `GET /api/v1/billing/usage`
- `POST /api/v1/billing/upgrade`

See full API documentation in backend code or `docs/API.md` (if available).
