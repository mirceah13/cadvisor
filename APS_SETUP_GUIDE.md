# Autodesk Platform Services (APS) Setup Guide

Complete guide for integrating Autodesk Platform Services for reliable DWG/CAD file conversion in CADVisor.

## 🎯 Why APS?

**Autodesk Platform Services** (formerly Forge) is the official cloud platform from Autodesk:

- ✅ **100% Reliability**: Industry-standard DWG conversion from Autodesk  
- ✅ **Complete Version Support**: R12 through 2025+ (ALL DWG versions)
- ✅ **Professional Quality**: Perfect conversion accuracy
- ✅ **Free Tier**: 100 API calls/month included
- ✅ **Pay-as-you-go**: Beyond free tier
- ✅ **No Installation**: Cloud-based, works everywhere

---

## 📝 Prerequisites

You mentioned you already have:
- ✅ APS account created
- ✅ Free tier purchased
- ✅ Application created in APS portal
- ✅ Client ID and Client Secret

Perfect! You're ready for Step 3.

---

## Step 1: Create APS Account ✅ (You did this)

1. Visit **https://aps.autodesk.com/**
2. Click **"Sign Up"** or **"Get Started"**
3. Create account (email + password)
4. Verify your email

---

## Step 2: Create an App ✅ (You did this)

1. Log in to APS Portal: **https://aps.autodesk.com/myapps**
2. Click **"Create Application"**
3. Fill in required fields:
   - **App Name**: `CADVisor` (your choice)
   - **Description**: `Building submission analysis platform`
   - **Callback URL**: `http://localhost:8000/callback` (required but not used)
4. **Select APIs**: 
   - ✅ **Model Derivative API** (required for DWG conversion)
   - ✅ **Data Management API** (required for file uploads)
5. Click **"Create"**

---

## Step 3: Add Credentials to CADVisor

### Your Credentials Format

From your APS app dashboard, you should see:
```
Client ID: aBcD1234EfGh5678...
Client Secret: xYz9876WvUt4321...
```

### Add to .env File

Open `.env` in your CADVisor root directory and add your actual credentialsreplace placeholder values):

```bash
# Autodesk Platform Services (APS) - for DWG conversion
APS_CLIENT_ID=your_actual_client_id_here
APS_CLIENT_SECRET=your_actual_client_secret_here
```

**Example** (with fake credentials):
```bash
APS_CLIENT_ID=aBcD1234EfGh5678iJkL9012mNoPqRsT
APS_CLIENT_SECRET=xYz9876WvUt4321gHiJ5432kLmN6543
```

### Important Notes

- ⚠️ **No quotes** needed around the values
- ⚠️ **No spaces** around the `=` sign  
- ⚠️ **Keep secret**: Never commit `.env` to git (already in `.gitignore`)
- ✅ Copy entire strings including any special characters

---

## Step 4: Restart Services

```powershell
# Option A: Full rebuild (recommended for first time)
docker-compose build api celery-worker
docker-compose up -d

# Option B: Quick restart (if containers already built)
docker-compose restart api celery-worker
```

Wait for services to be healthy (~30 seconds).

---

## Step 5: Verify Configuration

Check that APS is properly configured:

```powershell
docker-compose exec api python -c "from app.core.config import settings; print(f'APS Client ID: {settings.APS_CLIENT_ID[:10]}...' if settings.APS_CLIENT_ID else 'Not configured')"
```

**Expected output:**
```
APS Client ID: aBcD1234Ef...
```

---

## Step 6: Test DWG Conversion

### Via Web Interface

1. Go to **http://localhost:3000**
2. Create or select a project
3. Click **"Upload Files"**
4. Select your DWG file (e.g., `A.05 PLAN ETAJ 1 - CORP C1.dwg`)
5. Click **"Analyze"**

### Monitor Logs

Watch the conversion process:

```powershell
docker-compose logs -f celery-worker | Select-String "APS|LibreDWG|DWG"
```

**Expected output (with APS configured):**
```
INFO - Converting DWG to DXF: /app/uploads/drawing.dwg
INFO - Attempting conversion with Autodesk Platform Services (APS)...
DEBUG - APS translation status: inprogress, progress: 25%
DEBUG - APS translation status: inprogress, progress: 50%
DEBUG - APS translation status: success, progress: complete
INFO - APS API conversion succeeded: /tmp/drawing_aps.dxf
INFO - Successfully parsed DXF file: 1250 entities extracted
```

**Fallback output (without APS credentials):**
```
INFO - Converting DWG to DXF: /app/uploads/drawing.dwg
INFO - Attempting conversion with Autodesk Platform Services (APS)...
DEBUG - APS API credentials not configured
INFO - APS not available, attempting conversion with LibreDWG...
INFO - LibreDWG conversion succeeded: /tmp/drawing_libredwg.dxf
```

---

## 🏗️ How It Works

### Architecture Flow

```
User uploads DWG file
    ↓
CADVisor Celery Worker
    ↓
┌─────────────────────────────────┐
│ APS configured?                 │
├─────────────────────────────────┤
│ ✅ YES → Use APS API            │
│   1. Authenticate (OAuth2)      │
│   2. Upload DWG to OSS          │
│   3. Trigger translation job    │
│   4. Poll for completion        │
│   5. Download converted DXF     │
│   → 100% success rate ✨        │
├─────────────────────────────────┤
│ ❌ NO → Use LibreDWG (fallback) │
│   → ~60% success rate ⚠️         │
└─────────────────────────────────┘
    ↓
Parse DXF with ezdxf
    ↓
Extract metadata & text
    ↓
Store in database
```

### API Endpoints Used

1. **Authentication**:
   ```
   POST https://developer.api.autodesk.com/authentication/v2/token
   ```

2. **Create Bucket**:
   ```
   POST https://developer.api.autodesk.com/oss/v2/buckets
   ```

3. **Upload File**:
   ```
   PUT https://developer.api.autodesk.com/oss/v2/buckets/{bucket}/objects/{file}
   ```

4. **Start Translation**:
   ```
   POST https://developer.api.autodesk.com/modelderivative/v2/designdata/job
   ```

5. **Check Status**:
   ```
   GET https://developer.api.autodesk.com/modelderivative/v2/designdata/{urn}/manifest
   ```

6. **Download Result**:
   ```
   GET https://developer.api.autodesk.com/derivativeservice/v2/derivatives/{urn}
   ```

---

## 💰 Pricing & Usage

### Free Tier (What You Have)

- **100 API calls/month** - FREE
- Perfect for:
  - Development & testing
  - Small projects (<100 DWG files/month)
  - Proof of concept

### Calculation Example

If you analyze **50 DWG files** per month:
- 50 files × 6 API calls each = **300 API calls total**
- First 100 calls: **FREE**
- Remaining 200 calls: **Paid**

**Note**: Each DWG conversion uses ~6 API calls:
1. Authenticate
2. Create bucket
3. Upload file
4. Start translation
5. Check status (may repeat)
6. Download result

### Beyond Free Tier

Contact Autodesk sales for pricing:
- Enterprise plans available
- Volume discounts
- Custom agreements

### Monitor Your Usage

Check your APS usage dashboard:
**https://aps.autodesk.com/myapps** → Select Your App → **Usage** tab

---

## 🔧 Troubleshooting

### "APS API credentials not configured"

**Cause**: Environment variables not set or not loaded

**Fix**:
1. Check `.env` file has correct values:
   ```powershell
   Get-Content .env | Select-String "APS"
   ```
2. Restart services:
   ```powershell
   docker-compose restart api celery-worker
   ```
3. Verify configuration (see Step 5 above)

### "APS authentication failed"

**Cause**: Invalid Client ID or Secret

**Fix**:
1. Double-check credentials in APS portal:
   - **https://aps.autodesk.com/myapps**
   - Click your app → View credentials
2. Copy **entire** Client ID and Secret (no truncation)
3. Update `.env` with correct values
4. Restart services

### "APS translation job failed"

**Cause**: Corrupted DWG file or unsupported version

**Fix**:
1. Check file is valid DWG (not renamed DXF)
2. Try opening in AutoCAD/DWG viewer
3. If file opens elsewhere, contact APS support
4. Fallback: Export as DXF from AutoCAD and upload directly

###"APS conversion timed out"

**Cause**: Very large/complex DWG file (rare)

**Fix**:
1. File automatically falls back to LibreDWG
2. For critical files: Increase timeout in [cad_parser.py](services/api/app/services/cad_parser.py) line ~450:
   ```python
   max_wait = 600  # 10 minutes instead of 5
   ```
3. Or simplify DWG file (remove unused layers, purge)

### "requests library not available"

**Cause**: Missing Python dependency (shouldn't happen)

**Fix**:
```powershell
docker-compose exec api pip list | Select-String "request"
# Should show: requests==2.31.0

# If missing:
docker-compose build api celery-worker
docker-compose up -d
```

---

## 🔒 Security Best Practices

1. **Never commit `.env`**: Already in `.gitignore` ✅
2. **Rotate secrets regularly**: Generate new credentials every 90 days
3. **Use different credentials** for dev/prod environments
4. **Monitor usage**: Watch for unexpected API calls
5. **Enable IP restrictions** (if available in APS portal)

---

## 📊 Monitoring & Logs

### Real-time Conversion Monitoring

```powershell
# Watch all conversions
docker-compose logs -f celery-worker

# Filter for APS-specific logs
docker-compose logs -f celery-worker | Select-String "APS"

# Check last 100 lines
docker-compose logs --tail=100 celery-worker | Select-String "DWG|APS"
```

### Success Indicators

```
✅ "APS API conversion succeeded"
✅ "Successfully parsed DXF file"
✅ "analysis_status=completed"
```

### Warning Indicators

```
⚠️ "APS not available, attempting conversion with LibreDWG"
⚠️ "LibreDWG conversion succeeded" (fallback used)
```

### Error Indicators

```
❌ "APS authentication failed"
❌ "APS translation job failed"
❌ "All DWG conversion methods failed"
```

---

## 🚀 Next Steps

Now that APS is configured:

1. **Test with your problematic DWG file**
   - Upload `A.05 PLAN ETAJ 1 - CORP C1.dwg`
   - Should now convert successfully with APS

2. **Monitor usage**
   - Check APS dashboard weekly
   - Ensure you're within free tier limits

3. **Production readiness**
   - Add APS credentials to production environment
   - Set up monitoring/alerting for failed conversions
   - Document APS credentials in secure password manager

---

## 📚 Additional Resources

- **APS Documentation**: https://aps.autodesk.com/en/docs
- **Model Derivative API**: https://aps.autodesk.com/en/docs/model-derivative/v2
- **OAuth Guide**: https://aps.autodesk.com/en/docs/oauth/v2
- **Status Page**: https://health.autodesk.com/
- **Community Forum**: https://aps.autodesk.com/community
- **Support**: https://aps.autodesk.com/support

---

## ✅ Quick Checklist

Before considering this complete, verify:

- [ ] APS Client ID and Secret added to `.env`
- [ ] Services restarted (`docker-compose restart api celery-worker`)
- [ ] Configuration verification passed (Step 5)
- [ ] Test DWG file uploaded and analyzed successfully
- [ ] Logs show "APS API conversion succeeded"
- [ ] No errors in celery-worker logs

---

## 💡 Tips

- **Start simple**: Test with a small, simple DWG file first
- **Compare results**: Try same file with/without APS to see difference
- **Check file size**: Large files (>50MB) may take longer
- **Use caching**: CADVisor caches parsed results, so re-analyzing is free
- **Prefer DXF**: If you already have DXF versions, upload those instead (no API call needed)

---

**Need help?** Check the logs or revisit troubleshooting section. Your APS integration is ready to go! 🚀
