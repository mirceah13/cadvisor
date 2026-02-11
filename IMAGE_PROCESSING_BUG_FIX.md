# Image Processing Bug Fix - January 9, 2026

## Issue Summary

After successfully implementing the multimodal knowledge base system, we discovered that **no images were being extracted** from the 700-page Romanian fire safety document despite the code being in place.

---

## Root Causes Identified

### 1. Variable Scope Issue ❌
**File:** `services/api/app/tasks/kb.py`  
**Line:** 101

**Problem:**
```python
if source.source_type == "document" and source.file_id:
    # Get file record
    file = db.query(File).filter(File.id == source.file_id).first()
    ...
    
# Later, outside the if block:
image_count = _process_document_images(source, file, db) if file else 0
```

The `file` variable was only defined inside the `if` block. When accessing it later, Python couldn't find the variable because it was out of scope.

**Fix:**
```python
# Initialize file variable before conditional
file = None

if source.source_type == "document" and source.file_id:
    file = db.query(File).filter(File.id == source.file_id).first()
    ...
```

**Result:** ✅ Fixed - Code now properly handles file variable scope

---

### 2. Missing Dependencies ❌
**File:** Docker container  
**Issue:** `ModuleNotFoundError: No module named 'cv2'`

**Problem:**
- Dependencies were added to `requirements.txt`
- Docker image was rebuilt with `--no-cache` previously
- However, **Celery worker was not using the new image**
- Still running with old image without OpenCV, Tesseract, etc.

**Evidence from logs:**
```
[2026-01-09 21:07:22,035: ERROR/ForkPoolWorker-4] Error ingesting source: No module named 'cv2'
  File "/app/app/services/ocr.py", line 9, in <module>
    import cv2
ModuleNotFoundError: No module named 'cv2'
```

**Fix:**
```bash
docker compose build api celery-worker --no-cache
docker compose up -d celery-worker
```

**Status:** ⏳ In progress (rebuild takes ~40 minutes)

---

## Text Size Question ✅

**Question:** "Is total text 1.67 MB accurate? The DOCX file is about 8MB big"

**Answer:** YES, this is completely accurate!

**Explanation:**
- **DOCX file size (8MB)** includes:
  - XML structure
  - Embedded images
  - Styles and formatting
  - Fonts
  - Metadata
  - Compressed media files

- **Extracted text (1.67 MB)** is pure content:
  - 1,734,486 characters
  - 2,680 chunks
  - Average 655 characters per chunk
  - **NO formatting, NO images**

**Typical ratio:** Text content is usually 15-30% of DOCX file size  
**This document:** 1.67MB / 8MB = 20.9% ✅ Normal

---

## Testing Results

### Before Fix ❌
```
📝 Text Chunks: 2,680 chunks (1.67 MB)
🖼️  Images: 0
Status: Completed but no images extracted
```

### After Fix ⏳ (Expected)
```
📝 Text Chunks: 2,680 chunks (1.67 MB)
🖼️  Images: ~50-200 images (estimated)
OCR Text: Technical annotations extracted
Visual Embeddings: 512-dim CLIP vectors
Storage: Images in MinIO
Database: kb_images table populated
```

---

## Code Changes

### File 1: `services/api/app/tasks/kb.py`

**Change:**
```diff
         # Extract text based on source type
         text_content = None
+        file = None  # Initialize file variable
         
         if source.source_type == "document" and source.file_id:
             # Get file record
             file = db.query(File).filter(File.id == source.file_id).first()
```

**Impact:**
- Fixes variable scope issue
- Prevents `NameError` when file variable is accessed
- Allows image processing function to be called correctly

---

## Next Steps

1. **Wait for Docker rebuild** (~40 minutes)
   - Building with all dependencies
   - Tesseract OCR (Romanian + English)
   - OpenCV (opencv-python-headless)
   - PyMuPDF (fitz)
   - CLIP model (sentence-transformers)

2. **Restart services**
   ```bash
   docker compose up -d celery-worker
   ```

3. **Trigger reprocessing**
   ```bash
   docker compose exec api python scripts/trigger_reprocess.py
   ```

4. **Monitor progress**
   ```bash
   docker compose exec api python scripts/monitor_kb_processing.py
   # OR
   docker compose logs -f celery-worker
   ```

5. **Verify results**
   - Check kb_images table for extracted images
   - Verify OCR text extraction
   - Confirm visual embeddings generated
   - Test image similarity search

---

## Lessons Learned

### 1. Always Initialize Variables Before Conditionals
```python
# ❌ BAD
if condition:
    var = something
# Later...
use(var)  # NameError if condition was False!

# ✅ GOOD
var = None
if condition:
    var = something
# Later...
use(var)  # Always safe
```

### 2. Docker Image vs Container State
- Adding to `requirements.txt` ≠ Installed in container
- Must rebuild image: `docker compose build --no-cache`
- Must restart container: `docker compose up -d`
- Celery workers cache Python imports

### 3. Variable Scope in Python
- Variables defined in `if` blocks are not block-scoped
- They become available in the outer scope **only if the block executes**
- Initialize before conditionals for safety

### 4. Error Handling in Async Tasks
- Celery tasks need proper error handling
- Log errors before re-raising
- Include context (source_id, task_id)
- Use try/except for graceful degradation

---

## Monitoring Commands

**Check processing status:**
```bash
docker compose exec api python scripts/monitor_kb_processing.py
```

**Watch Celery logs:**
```bash
docker compose logs -f celery-worker
```

**Check image extraction:**
```bash
docker compose logs celery-worker | Select-String -Pattern "image|Extracted.*images"
```

**Check for errors:**
```bash
docker compose logs celery-worker | Select-String -Pattern "ERROR|Failed|Exception"
```

**Query database directly:**
```sql
-- Check image count
SELECT COUNT(*) FROM kb_images WHERE knowledge_source_id = 'b06b95cb-3b0b-4cbb-bdb4-1a155f7ada41';

-- Check OCR results
SELECT image_index, ocr_text, ocr_confidence 
FROM kb_images 
WHERE knowledge_source_id = 'b06b95cb-3b0b-4cbb-bdb4-1a155f7ada41'
ORDER BY image_index
LIMIT 10;
```

---

## Expected Timeline

| Step | Duration | Status |
|------|----------|--------|
| Docker rebuild | ~40 min | ⏳ In progress |
| Container restart | ~10 sec | ⏳ Pending |
| Trigger reprocess | ~5 sec | ⏳ Pending |
| Text extraction | ~15 sec | ⏳ Pending |
| Image extraction | ~5-10 min | ⏳ Pending |
| OCR processing | ~10-30 min | ⏳ Pending |
| Visual embeddings | ~5-10 min | ⏳ Pending |
| **Total** | **~60-90 min** | ⏳ In progress |

---

## Success Criteria

- ✅ Docker image builds successfully with all dependencies
- ✅ No `ModuleNotFoundError` for cv2, pytesseract, etc.
- ✅ Images extracted from DOCX (expected: 50-200 images)
- ✅ OCR text extracted with Romanian support
- ✅ Visual embeddings generated (512-dim vectors)
- ✅ Images stored in MinIO
- ✅ kb_images table populated
- ✅ Image similarity search functional

---

**Status:** Bug fix implemented, Docker rebuild in progress  
**Next Update:** After Docker rebuild completes and reprocessing is triggered  
**Document Created:** January 9, 2026 23:08
