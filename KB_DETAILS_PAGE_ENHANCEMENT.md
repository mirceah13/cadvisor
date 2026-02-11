# Knowledge Base Details Page Enhancement

## Overview
Enhanced the knowledge base source details page with comprehensive metrics, visual analytics, and detailed statistics to provide users with complete insights into their processed documents.

## Changes Made

### Backend API Updates (`services/api/app/api/v1/endpoints/kb.py`)

#### 1. Enhanced Response Model
Added new fields to `KnowledgeSourceResponse`:
- `images_count`: Total number of images extracted from document
- `chunks_with_embeddings`: Number of text chunks with embeddings generated
- `images_with_embeddings`: Number of images with visual embeddings generated
- `text_length`: Total character count across all chunks
- `processing_time`: Time taken to process the document (seconds)

#### 2. Enhanced GET Endpoint
Updated `/sources/{source_id}` endpoint to return comprehensive statistics:
- Counts total images using `KBImage` table
- Counts chunks and images with embeddings using vector field checks
- Calculates total text length across all chunks
- Extracts processing time from metadata if available

### Frontend Updates (`apps/web/src/app/knowledge-base/[id]/page.tsx`)

#### 1. New Dependencies
- **Recharts**: Added for data visualization (pie charts, bar charts)
- **New Lucide Icons**: Image, Database, Clock, FileType, CheckCircle2, TrendingUp

#### 2. Enhanced Metrics Dashboard

##### Statistics Cards (4 columns)
1. **Status Card**
   - Shows current processing status with emoji indicators
   - ✅ Ready for queries (indexed)
   - ⏳ In progress (processing)
   - ❌ Processing failed (failed)
   - 📤 Awaiting processing (uploaded)

2. **Text Chunks Card**
   - Total chunk count
   - Number with embeddings
   - Success rate percentage

3. **Images Card**
   - Total image count
   - Number with visual embeddings
   - Success rate percentage

4. **Source Type Card**
   - Document type
   - Category label

##### Additional Metrics (2 columns when available)
1. **Total Text Length**
   - Formatted in thousands (e.g., "1.7K")
   - Full character count

2. **Processing Time**
   - Human-readable format (minutes and seconds)
   - Precise seconds count

#### 3. Visual Analytics Section

##### Content Analytics Card
Displays when document is successfully indexed with chunks.

**Pie Charts:**
1. **Text Chunks Breakdown**
   - Green: With embeddings
   - Red: Without embeddings
   - Shows percentage distribution
   - Displays success rate

2. **Images Breakdown**
   - Blue: With embeddings
   - Orange: Without embeddings
   - Shows percentage distribution
   - Displays success rate

**Comparison Bar Chart:**
- Stacked bars comparing text chunks vs images
- Green bars: With embeddings
- Red bars: Without embeddings
- Clear visual comparison of processing success

**Processing Statistics Summary:**
Four key metrics displayed:
1. Text Success Rate (percentage)
2. Image Success Rate (percentage)
3. Total Items (chunks + images)
4. Total Embeddings (successful chunks + images)

#### 4. Enhanced Details Section

**Document Details Card:**
Comprehensive metadata display including:
- Category with icon
- File ID (monospace font)
- URL (if applicable, clickable)
- Created date (formatted as "Month Day, Year HH:MM")
- Average chunk size (characters)
- Text to image ratio (e.g., "4.73:1")
- Processing speed (chunks per minute and seconds per chunk)

### Key Features

#### 1. Real-time Data
- All metrics pulled from live database queries
- Shows current embedding generation status
- Accurate success rates

#### 2. Visual Feedback
- Color-coded charts (green for success, red/orange for issues)
- Pie charts for quick ratio understanding
- Bar charts for comparative analysis
- Percentage indicators for success rates

#### 3. Calculated Insights
- Average chunk size
- Processing speed (chunks/minute)
- Text-to-image ratio
- Overall success rates

#### 4. Responsive Design
- Grid layouts adapt to screen size
- 1 column on mobile, 2-4 columns on desktop
- Charts scale responsively

## Use Cases

### 1. Quality Assessment
Users can quickly assess:
- How many chunks/images were successfully processed
- Which parts of the multimodal pipeline succeeded
- Overall document processing quality

### 2. Performance Monitoring
- View processing speed
- Compare processing times between documents
- Identify bottlenecks

### 3. Content Analysis
- Understand document structure (text vs images)
- See chunk distribution
- Assess content size

### 4. Troubleshooting
- Identify failed embeddings
- See which stage failed
- Compare success rates

## Technical Details

### Database Queries
The backend now performs these queries for each source:
```sql
-- Count total images
SELECT COUNT(id) FROM kb_images WHERE knowledge_source_id = ?

-- Count chunks with embeddings
SELECT COUNT(id) FROM kb_chunks 
WHERE knowledge_source_id = ? AND embedding IS NOT NULL

-- Count images with embeddings
SELECT COUNT(id) FROM kb_images 
WHERE knowledge_source_id = ? AND visual_embedding IS NOT NULL

-- Calculate total text length
SELECT SUM(LENGTH(chunk_text)) FROM kb_chunks 
WHERE knowledge_source_id = ?
```

### Performance Considerations
- All queries use indexed fields (knowledge_source_id)
- Counts are performed at database level (efficient)
- Results cached in response (no repeated queries on frontend)

### Chart Configuration
- **Pie Charts**: 200px height, responsive width
- **Bar Chart**: 250px height, responsive width
- **Colors**: Consistent across charts (green=#10b981, blue=#3b82f6, red=#ef4444)
- **Tooltips**: Enabled for detailed hover information
- **Legends**: Displayed for clarity

## Example Data Display

For the Romanian fire safety document (P118-2025):
- **Status**: Indexed ✅
- **Text Chunks**: 2,680 (100% with embeddings)
- **Images**: 566 (98.8% with embeddings)
- **Text Length**: 1.7M characters
- **Processing Time**: 22m 46s
- **Average Chunk Size**: 647 characters
- **Text to Image Ratio**: 4.73:1
- **Processing Speed**: 117.5 chunks/min

## Future Enhancements

Potential additions:
1. **OCR Quality Metrics**: Show average OCR confidence scores
2. **Language Detection**: Display detected languages in images
3. **Embedding Visualization**: t-SNE/UMAP plots of embeddings
4. **Search Query Analytics**: Most common queries for this source
5. **Version History**: Track re-processing events
6. **Export Reports**: PDF/CSV export of metrics
7. **Comparison View**: Compare metrics across multiple documents

## Dependencies Added

```json
{
  "recharts": "^2.10.3"
}
```

## Files Modified

1. `services/api/app/api/v1/endpoints/kb.py` - Backend API endpoints
2. `apps/web/src/app/knowledge-base/[id]/page.tsx` - Frontend details page
3. `apps/web/package.json` - Added recharts dependency

## Testing

To test the enhancements:
1. Navigate to Knowledge Base section
2. Click on any indexed document
3. Verify all metrics display correctly
4. Check that charts render properly
5. Hover over charts to see tooltips
6. Test on different screen sizes (responsive design)

## Rollback Instructions

If needed to rollback:
1. Revert `services/api/app/api/v1/endpoints/kb.py` to previous version
2. Revert `apps/web/src/app/knowledge-base/[id]/page.tsx` to previous version
3. Run `docker compose restart api web`

Frontend will gracefully handle missing fields (will not display sections if data unavailable).
