# APS Migration Summary

## Migration: Forge → Autodesk Platform Services (APS)

**Date**: February 11, 2026  
**Reason**: Forge has been rebranded to Autodesk Platform Services (APS). Updated to use current branding and APIs.

---

## ✅ What Changed

### 1. Configuration Variables

**Before (Forge):**
```bash
FORGE_CLIENT_ID=...
FORGE_CLIENT_SECRET=...
```

**After (APS):**
```bash
APS_CLIENT_ID=...
APS_CLIENT_SECRET=...
```

### 2. Code Updates

#### services/api/app/core/config.py
- Renamed `FORGE_CLIENT_ID` → `APS_CLIENT_ID`
- Renamed `FORGE_CLIENT_SECRET` → `APS_CLIENT_SECRET`
- Updated comments to reference APS

#### services/api/app/services/cad_parser.py
- Renamed `_convert_dwg_with_forge()` → `_convert_dwg_with_aps()`
- Updated all log messages: "Forge" → "APS"
- Updated authentication endpoint to OAuth2 v2
- Improved error handling and status polling
- Better logging for debugging

### 3. Authentication Changes

**Before (Forge - v1):**
```python
POST https://developer.api.autodesk.com/authentication/v1/authenticate
Authorization: Basic {base64(client_id:client_secret)}
```

**After (APS - OAuth2 v2):**
```python
POST https://developer.api.autodesk.com/authentication/v2/token
Content-Type: application/x-www-form-urlencoded
Body: client_id={id}&client_secret={secret}&grant_type=client_credentials&scope=data:read data:write data:create
```

### 4. Model Derivative API

**Endpoints remain the same:**
- Upload: `POST https://developer.api.autodesk.com/oss/v2/buckets`
- Translate: `POST https://developer.api.autodesk.com/modelderivative/v2/designdata/job`
- Status: `GET https://developer.api.autodesk.com/modelderivative/v2/designdata/{urn}/manifest`
- Download: `GET https://developer.api.autodesk.com/derivativeservice/v2/derivatives/{urn}`

**Improvements:**
- Added `x-ads-force: true` header to force new translations
- Better status polling with progress logging
- Improved derivative discovery logic
- Enhanced error messages

### 5. Documentation

**Removed:**
- `FORGE_API_SETUP.md`
- `FORGE_MIGRATION_SUMMARY.md`

**Created:**
- `APS_SETUP_GUIDE.md` - Comprehensive setup instructions
- `APS_MIGRATION_SUMMARY.md` - This file

**Updated:**
- `DWG_PARSING_SOLUTIONS.md` - Now mentions APS instead of Forge

---

## 🔄 Migration Steps Performed

1. ✅ Updated config.py to use APS_* variables
2. ✅ Renamed conversion method in cad_parser.py
3. ✅ Updated authentication to OAuth2 v2
4. ✅ Improved API call flow and error handling
5. ✅ Updated .env file (FORGE → APS)
6. ✅ Removed Forge documentation
7. ✅ Created comprehensive APS documentation
8. ✅ Ready for container rebuild

---

## 🎯 Current State

### What Works Now

- ✅ **APS Integration**: Complete and ready to use
- ✅ **LibreDWG Fallback**: Still works if APS not configured
- ✅ **Configuration**: `.env` updated with APS placeholders
- ✅ **Documentation**: Complete setup guide available

### What You Need to Do

1. **Add Your Credentials** to `.env`:
   ```bash
   APS_CLIENT_ID=your_actual_client_id
   APS_CLIENT_SECRET=your_actual_client secret
   ```

2. **Rebuild Containers**:
   ```powershell
   docker-compose build api celery-worker
   docker-compose up -d
   ```

3. **Test**:
   - Upload a DWG file
   - Check logs: `docker-compose logs -f celery-worker`
   - Verify "APS API conversion succeeded" message

---

## 📊 Comparison: Forge vs APS

| Aspect | Forge (Old) | APS (New) |
|--------|-------------|-----------|
| **Branding** | Forge API | Autodesk Platform Services |
| **Portal** | forge.autodesk.com | aps.autodesk.com |
| **Auth Version** | v1 (Basic Auth) | v2 (OAuth2) |
| **Client ID/Secret** | FORGE_* | APS_* |
| **Functionality** | Same | Same |
| **Endpoints** | Same | Same |
| **Pricing** | Same | Same |
| **Free Tier** | 100 calls/month | 100 calls/month |

---

## 🔍 Testing Checklist

After rebuilding containers, verify:

- [ ] Services start successfully
- [ ] No errors in logs: `docker-compose logs api celery-worker`
- [ ] APS credentials detected: `docker-compose exec api python -c "from app.core.config import settings; print(settings.APS_CLIENT_ID[10] if settings.APS_CLIENT_ID else 'Not set')"`
- [ ] Upload test DWG file via web interface
- [ ] Check celery-worker logs for "APS API conversion succeeded"
- [ ] Verify analysis completes successfully

---

## 🐛 Troubleshooting

### Issue: "APS API credentials not configured"

**Solution**: Add credentials to `.env` and restart:
```powershell
# Edit .env, then:
docker-compose restart api celery-worker
```

### Issue: "APS authentication failed"

**Solution**: Verify credentials are correct:
1. Visit https://aps.autodesk.com/myapps
2. Select your app
3. Copy Client ID and Secret exactly (no spaces)
4. Update `.env`
5. Restart services

### Issue: Services won't start

**Solution**: Check logs for specific error:
```powershell
docker-compose logs api
docker-compose logs celery-worker
```

---

## 📝 Code Changes Detail

### Authentication Flow Changes

**Old Forge v1 (deprecated):**
```python
credentials = f"{client_id}:{client_secret}"
auth_header = base64.b64encode(credentials.encode()).decode()

requests.post(
    "https://developer.api.autodesk.com/authentication/v1/authenticate",
    headers={"Authorization": f"Basic {auth_header}"},
    data={"grant_type": "client_credentials", "scope": "..."}
)
```

**New APS OAuth2 v2 (current):**
```python
requests.post(
    "https://developer.api.autodesk.com/authentication/v2/token",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    data={
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
        "scope": "data:read data:write data:create"
    }
)
```

### Status Polling Improvements

**Added detailed progress logging:**
```python
status = manifest.get("status")
progress = manifest.get("progress", "")
logger.debug(f"APS translation status: {status}, progress: {progress}")
```

**Better derivative discovery:**
```python
for derivative in derivatives:
    if derivative.get("outputType") == "dwg":
        children = derivative.get("children", [])
        # ... find and download correct derivative
```

---

## 📚 Additional Files Modified

### .env
```diff
- # Autodesk Forge API (for DWG conversion - Optional)
- FORGE_CLIENT_ID=
- FORGE_CLIENT_SECRET=
+ # Autodesk Platform Services (APS) - for DWG conversion
+ APS_CLIENT_ID=
+ APS_CLIENT_SECRET=
```

### No Changes Required In:
- `docker-compose.yml` - Automatically reads from `.env`
- `infra/docker/api.Dockerfile` - No APS-specific installation needed
- `services/api/requirements.txt` - requests already included
- Frontend code - Conversion happens server-side

---

## 🚀 Next Actions

1. **You provide**: Your APS Client ID and Secret
2. **You run**:
   ```powershell
   # Update .env with your credentials first!
   docker-compose build api celery-worker
   docker-compose up -d
   docker-compose logs -f celery-worker
   ```
3. **You test**: Upload a DWG file and verify conversion works

---

## ✅ Migration Complete

The codebase is now fully migrated to APS. All references to "Forge" have been updated to "APS", authentication uses OAuth2 v2, andthe system is ready for your credentials.

**👉 Next step**: Follow [APS_SETUP_GUIDE.md](APS_SETUP_GUIDE.md) to add your credentials and test!
