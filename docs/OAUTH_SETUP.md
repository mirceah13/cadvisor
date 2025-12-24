# OAuth Provider Setup Guide

This guide explains how to configure OAuth providers (Google, Apple, Microsoft) for CADVisor authentication.

## Current Status

✅ **Email/Password Authentication** - Fully configured and working
⚠️ **OAuth Providers** - Require setup (optional feature)

## Why OAuth Is Optional

OAuth social login is a convenience feature. Users can still:
- Register with email/password at `/auth/signup`
- Login with email/password at `/auth/login`
- Access all platform features

## Setting Up OAuth Providers

### Prerequisites

You need to have the following configured in your `.env` file:
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<your-secret-key>  # Already configured
```

---

## 1. Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**

### Step 2: Configure OAuth Consent Screen

1. Click **OAuth consent screen** in the left sidebar
2. Select **External** user type (for testing) or **Internal** (for organization-only)
3. Fill in required information:
   - **App name**: CADVisor
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Add scopes:
   - `userinfo.email`
   - `userinfo.profile`
5. Add test users (if using External with testing mode)
6. Click **Save and Continue**

### Step 3: Create OAuth Credentials

1. Go to **Credentials** tab
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: Web application
4. Configure:
   - **Name**: CADVisor Web Client
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:3000/api/auth/callback/google
     ```
5. Click **Create**
6. Copy your **Client ID** and **Client Secret**

### Step 4: Update Environment Variables

Add to your `.env` file:
```bash
GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
```

### Step 5: Restart Container

```powershell
docker compose restart web
```

---

## 2. Apple OAuth Setup

### Step 1: Apple Developer Account

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Sign in with your Apple ID
3. Enroll in Apple Developer Program (requires $99/year)

### Step 2: Create App ID

1. Navigate to **Certificates, Identifiers & Profiles**
2. Click **Identifiers** → **+** button
3. Select **App IDs** and click **Continue**
4. Configure:
   - **Description**: CADVisor
   - **Bundle ID**: Explicit (e.g., `com.yourcompany.cadvisor`)
   - Enable **Sign in with Apple** capability
5. Click **Register**

### Step 3: Create Service ID

1. Go to **Identifiers** → **+** button
2. Select **Services IDs** and click **Continue**
3. Configure:
   - **Description**: CADVisor Web Auth
   - **Identifier**: `com.yourcompany.cadvisor.web`
   - Enable **Sign in with Apple**
4. Click **Configure** next to Sign in with Apple
5. Add domain and return URLs:
   - **Domains**: `localhost` (for development)
   - **Return URLs**: `http://localhost:3000/api/auth/callback/apple`
6. Click **Save** and **Continue**

### Step 4: Create Private Key

1. Go to **Keys** → **+** button
2. Configure:
   - **Key Name**: CADVisor Sign in with Apple Key
   - Enable **Sign in with Apple**
   - Click **Configure** and select your App ID
3. Click **Register** and download the `.p8` key file
4. Note the **Key ID** (10 characters)
5. Note your **Team ID** (found in membership details)

### Step 5: Generate Client Secret

Apple requires generating a JWT token as the client secret. You need to:
1. Use the `.p8` key file
2. Sign a JWT with your Team ID, Key ID, and Service ID

**Helper script** (Node.js):
```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('./AuthKey_XXXXXXXXXX.p8', 'utf8');

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d',
  audience: 'https://appleid.apple.com',
  issuer: 'YOUR_TEAM_ID',
  subject: 'com.yourcompany.cadvisor.web',
  keyid: 'YOUR_KEY_ID'
});

console.log('Apple Client Secret:', token);
```

### Step 6: Update Environment Variables

Add to your `.env` file:
```bash
APPLE_CLIENT_ID=com.yourcompany.cadvisor.web
APPLE_CLIENT_SECRET=<generated-jwt-token>
```

### Step 7: Restart Container

```powershell
docker compose restart web
```

---

## 3. Microsoft OAuth Setup

### Step 1: Register Application

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Microsoft Entra ID** (formerly Azure AD)
3. Go to **App registrations** → **New registration**

### Step 2: Configure Application

1. Fill in details:
   - **Name**: CADVisor
   - **Supported account types**: 
     - "Accounts in any organizational directory and personal Microsoft accounts" (most common)
   - **Redirect URI**: 
     - Platform: **Web**
     - URI: `http://localhost:3000/api/auth/callback/microsoft`
2. Click **Register**

### Step 3: Get Application ID

1. On the Overview page, copy the **Application (client) ID**
2. Note your **Directory (tenant) ID**

### Step 4: Create Client Secret

1. Go to **Certificates & secrets** in the left sidebar
2. Click **New client secret**
3. Add description: "CADVisor Web Client"
4. Set expiration (e.g., 24 months)
5. Click **Add**
6. **⚠️ IMPORTANT**: Copy the secret **Value** immediately (you can't see it again!)

### Step 5: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph** → **Delegated permissions**
4. Add:
   - `User.Read`
   - `email`
   - `profile`
   - `openid`
5. Click **Add permissions**
6. (Optional) Click **Grant admin consent** if you have admin rights

### Step 6: Update Environment Variables

Add to your `.env` file:
```bash
MICROSOFT_CLIENT_ID=your-application-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret-value
```

### Step 7: Restart Container

```powershell
docker compose restart web
```

---

## Testing OAuth Login

### 1. Start Services

```powershell
docker compose up -d
```

### 2. Visit Login Page

Open http://localhost:3000/auth/login

### 3. Test Each Provider

You should see buttons for:
- 📧 **Email/Password** (always works)
- 🔵 **Continue with Google** (if configured)
- 🍎 **Continue with Apple** (if configured)
- 🪟 **Continue with Microsoft** (if configured)

### 4. Expected Flow

1. Click OAuth provider button
2. Redirect to provider login page
3. Authorize the application
4. Redirect back to CADVisor
5. Create user account (first time) or login (returning user)
6. Redirect to dashboard

---

## Troubleshooting

### "Internal Server Error" on OAuth Callback

**Cause**: Missing or invalid OAuth credentials

**Solution**:
1. Check `.env` file has correct credentials
2. Verify credentials are not commented out
3. Restart web container: `docker compose restart web`
4. Check logs: `docker compose logs web --tail=50`

### "Redirect URI Mismatch"

**Cause**: The redirect URI in your OAuth provider config doesn't match

**Solution**:
1. Verify redirect URI in provider console matches exactly:
   - Google: `http://localhost:3000/api/auth/callback/google`
   - Apple: `http://localhost:3000/api/auth/callback/apple`
   - Microsoft: `http://localhost:3000/api/auth/callback/microsoft`
2. URLs are case-sensitive
3. No trailing slashes

### "Configuration Error"

**Cause**: Missing NEXTAUTH_URL or NEXTAUTH_SECRET

**Solution**:
```bash
# Check if these are set in .env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<your-secret-key>
```

### OAuth Button Not Visible

**Cause**: Provider credentials not configured

**Solution**: This is expected! OAuth buttons only appear if credentials are configured. Check `lib/auth.ts` - providers are conditionally enabled based on environment variables.

---

## Production Deployment

### Important Changes for Production

1. **Update NEXTAUTH_URL**:
   ```bash
   NEXTAUTH_URL=https://yourdomain.com
   ```

2. **Update OAuth Redirect URIs** in each provider console:
   - Google: `https://yourdomain.com/api/auth/callback/google`
   - Apple: `https://yourdomain.com/api/auth/callback/apple`
   - Microsoft: `https://yourdomain.com/api/auth/callback/microsoft`

3. **Add Production Domains**:
   - Google: Add domain to authorized origins
   - Apple: Add domain to approved domains
   - Microsoft: Add redirect URI for production

4. **Regenerate NEXTAUTH_SECRET**:
   ```powershell
   # Generate new secure secret for production
   $secret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   Write-Output $secret
   ```

5. **Enable HTTPS**:
   - Configure SSL certificates
   - Update all URLs to use `https://`
   - Enable secure cookies in NextAuth config

---

## Environment Variables Reference

### Required (Already Configured)

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=LtV7xqZiMEC5Foupzgbjk8WwleB91NIs

# API URLs
INTERNAL_API_URL=http://api:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Optional (OAuth Providers)

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Apple OAuth
APPLE_CLIENT_ID=com.yourcompany.cadvisor.web
APPLE_CLIENT_SECRET=generated-jwt-token

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

---

## Security Best Practices

1. ✅ **Never commit OAuth secrets** to git
2. ✅ **Use different credentials** for dev/staging/production
3. ✅ **Rotate secrets regularly** (every 90 days)
4. ✅ **Limit OAuth scopes** to minimum required
5. ✅ **Enable MFA** on provider accounts
6. ✅ **Review OAuth audit logs** periodically
7. ✅ **Use environment-specific secrets** management (e.g., AWS Secrets Manager, Azure Key Vault)

---

## Support

If you encounter issues:

1. Check this guide first
2. Review error logs: `docker compose logs web`
3. Verify environment variables: `docker compose exec web printenv | grep -E "GOOGLE|APPLE|MICROSOFT|NEXTAUTH"`
4. Test email/password login first (always works)
5. Check provider-specific documentation

**Remember**: OAuth is optional! Email/password authentication works out of the box.
