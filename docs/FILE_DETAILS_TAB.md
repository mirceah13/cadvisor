# File Details Tab Documentation

## Overview

The **File Details** tab provides a comprehensive, structured view of all information extracted from uploaded CAD/BIM files (DWG, DXF, IFC, etc.). It displays building metadata, geometry information, layers, elements, systems, and annotations in an organized, searchable interface.

## Location

The File Details tab is available on the submission detail page:
- Navigate to: **Dashboard → Submissions → [Select Submission] → File Details Tab**
- Located between "Files" and "Analysis" tabs

## Features

### 1. **Global Search**
- **Real-time search** across all extracted fields and values
- Search by field name or value content
- Instant filtering with match count display
- Keyboard-accessible search interface

### 2. **Four Main View Tabs**

#### **Overview Tab**
Provides a high-level summary of the submission:
- **Quick Stats Cards**: Files count, floors, total area, element count
- **File List**: All uploaded files with metadata:
  - Filename
  - File size (in MB)
  - MIME type
  - Scan status (if applicable)
- **Visual Cards**: At-a-glance information display

#### **Building Tab**
Detailed building-specific information extracted from CAD files:

**Building Information Section**
- Type (commercial, residential, etc.)
- Number of floors
- Total area (in sqm)
- Building name/description
- Elevation data
- Address information (if available)

**Building Elements Section** (Collapsible)
- Count of structural elements:
  - Walls
  - Doors
  - Windows
  - Slabs
  - Roofs
  - Stairs
  - Railings
  - Columns
  - Beams
  - Coverings
  - Furnishing elements
- Visual grid display with counts

**Building Systems Section** (Collapsible)
- Detected building systems:
  - Electrical
  - Plumbing
  - HVAC
  - Fire protection
- Present/Absent status badges
- System availability indicators

**Spaces & Rooms Section** (Collapsible)
- Total space count
- Room/space names
- Descriptions
- Long names (if available)
- Organized list view

#### **Geometry Tab**
Detailed CAD geometry and drawing information:

**Layers Section** (Collapsible)
- Layer count
- Layer names
- Layer properties:
  - Color codes
  - Line types
  - Layer states
- Shows first 50 layers (with overflow indicator)

**Blocks & Components Section** (Collapsible)
- Block count
- Block names
- Entity counts per block
- Grid display (up to 30 blocks)

**Entities Section** (Collapsible)
- Entity type counts:
  - LINE
  - LWPOLYLINE
  - CIRCLE
  - ARC
  - INSERT
  - TEXT
  - MTEXT
  - DIMENSION
  - And more...
- Grid card layout

**Text Annotations Section** (Collapsible)
- Total annotation count
- Sample text content
- Monospace display for technical text
- Shows first 20 annotations
- Overflow indicator for remaining texts

**Dimensions Section** (Collapsible)
- Total dimension entity count
- Presence indicator
- Visual summary card

#### **Raw Data Tab**
- Complete JSON representation of extracted profile
- Syntax-highlighted JSON viewer
- Scrollable view (max height 384px)
- Useful for:
  - Debugging
  - API integration
  - Data export
  - Technical inspection

### 3. **Interactive Collapsible Sections**
- Each section can be expanded/collapsed
- Badge indicators showing item counts
- Icons for quick visual identification
- Default states (some sections open, some closed)
- Smooth animations

### 4. **Data Display Components**

**DataRow Component**
- Clean label-value pairs
- Border separators
- Responsive layout
- Handles different data types:
  - Strings
  - Numbers (with optional units)
  - Booleans (as badges)
  - Objects (JSON serialized)

**DataGrid Component**
- Structured data display
- Auto-formatting of keys (snake_case → Title Case)
- Null/undefined value handling
- Responsive spacing

**Badge Indicators**
- Color-coded status indicators
- Present/Absent states
- Scan results
- System availability

## Supported File Types

### CAD Files
- **DWG** (AutoCAD Drawing) - via ezdxf
- **DXF** (Drawing Exchange Format) - via ezdxf
- **IFC** (Industry Foundation Classes) - via ifcopenshell

### Documents
- **PDF** - Text extraction via PyPDF2
- **DOCX** - Text extraction via python-docx
- **TXT** - Plain text files

## Data Extraction

### IFC Files (BIM)
Extracts:
- Project information
- Building storeys/floors
- Spaces and rooms
- Element types and counts
- Building systems (MEP)
- Properties and quantities
- Geometric data

### DWG/DXF Files (CAD)
Extracts:
- DXF version
- Layer information
- Block definitions
- Entity counts by type
- Text annotations
- Dimension entities
- Viewport/layout information

### Profile Data Structure
Stored in `submissions.profile` (JSONB column):
```json
{
  "building": {
    "type": "commercial",
    "floors": 3,
    "total_area_sqm": 500
  },
  "elements": {
    "wall": 45,
    "door": 12,
    "window": 18
  },
  "systems": {
    "electrical": true,
    "plumbing": true,
    "hvac": false
  },
  "layers": {
    "count": 23,
    "layers": [...]
  },
  "entities": {
    "LINE": 1234,
    "LWPOLYLINE": 567
  }
}
```

## User Interface

### Design Principles
1. **Clarity**: Information hierarchy with clear headers
2. **Scannability**: Grid layouts and badges for quick scanning
3. **Searchability**: Global search to find any field
4. **Density**: Collapsible sections to manage information density
5. **Accessibility**: Keyboard navigation, ARIA labels, semantic HTML

### Visual Elements
- **Icons**: Lucide icons for visual identification
- **Badges**: shadcn/ui badges for status indicators
- **Cards**: shadcn/ui cards for content grouping
- **Tabs**: shadcn/ui tabs for view switching
- **Collapsibles**: Smooth expand/collapse animations

### Responsive Design
- Mobile-friendly layouts
- Grid columns adjust by screen size:
  - Mobile: 1-2 columns
  - Tablet: 2-3 columns
  - Desktop: 3-4 columns
- Touch-friendly tap targets
- Scrollable containers

## Implementation Details

### Frontend
**Location**: `apps/web/src/components/file-details-tab.tsx`

**Dependencies**:
- React hooks (useState, useMemo)
- shadcn/ui components:
  - Card
  - Badge
  - Input
  - Tabs
  - Collapsible
  - Button
- Lucide React icons

**Props**:
```typescript
interface FileDetailsTabProps {
  profile: any          // Submission profile data
  files: any[]          // Array of uploaded files
}
```

### Backend
**CAD Parser**: `services/api/app/services/cad_parser.py`

**Classes**:
- `IFCParser` - IFC/BIM file parsing
- `DXFParser` - DWG/DXF file parsing
- `DocumentParser` - PDF/DOCX parsing
- `CADParserService` - Main orchestrator

**API Endpoint**: `/api/v1/submissions/{submission_id}`
- Returns `SubmissionResponse` with `profile` field
- Profile stored in PostgreSQL JSONB column

## Usage Examples

### Searching for Specific Data
1. Click on the "File Details" tab
2. Enter search term in the search box:
   - Search by field: "floors", "doors", "area"
   - Search by value: "3", "commercial", "true"
3. View filtered results instantly

### Inspecting Building Elements
1. Go to "Building" tab
2. Expand "Building Elements" section
3. View count of all structural elements
4. Check system availability in "Building Systems"

### Analyzing CAD Layers
1. Go to "Geometry" tab
2. Expand "Layers" section
3. View layer names, colors, and line types
4. Check entity distribution in "Entities" section

### Exporting Data
1. Go to "Raw Data" tab
2. View complete JSON structure
3. Copy JSON for external use
4. Use in API integrations or reports

## Future Enhancements

### Planned Features
- [ ] **Export functionality**: Download profile data as JSON/CSV
- [ ] **Comparison view**: Compare profiles from multiple submissions
- [ ] **Visualization**: 2D/3D preview of geometry (if feasible)
- [ ] **Edit mode**: Allow manual profile adjustments
- [ ] **History**: Track profile changes over time
- [ ] **Validation**: Highlight missing or invalid data
- [ ] **Annotations**: Add user comments to specific fields

### Performance Optimizations
- [ ] Lazy loading for large datasets
- [ ] Virtual scrolling for long lists
- [ ] Pagination for massive entity counts
- [ ] Caching of search results

### UX Improvements
- [ ] Keyboard shortcuts (e.g., `/` to search)
- [ ] Bookmarkable sections (deep linking)
- [ ] Copy-to-clipboard buttons
- [ ] Dark mode optimizations
- [ ] Print-friendly layout

## Technical Notes

### Data Flow
1. **Upload**: User uploads CAD file via Files tab
2. **Processing**: Celery task processes file
3. **Extraction**: CAD parser extracts metadata
4. **Storage**: Profile saved to `submissions.profile` (JSONB)
5. **Display**: Frontend fetches and renders in File Details tab

### Performance
- Profile data is indexed in PostgreSQL
- JSONB allows efficient querying
- Frontend search is client-side (instant)
- Large files may take time to parse (async processing)

### Error Handling
- Graceful fallback for missing data
- Empty state messages
- Null/undefined checks throughout
- Error boundaries to prevent crashes

## Troubleshooting

### No Data Displayed
**Cause**: Profile not yet extracted from uploaded file
**Solution**: 
- Check if file upload completed
- Check Celery logs for processing status
- Verify file type is supported
- Re-upload file if needed

### Incomplete Data
**Cause**: CAD file may not contain all information
**Solution**:
- Check Raw Data tab for available fields
- Verify CAD file completeness
- Ensure proper CAD file structure

### Search Not Working
**Cause**: Profile data not loaded
**Solution**:
- Refresh page
- Check browser console for errors
- Verify API endpoint returns profile data

## Support

For issues or questions:
- Check logs: `docker logs cadvisor-api`
- Review CAD parser logs
- Inspect browser console
- Verify database profile data: `SELECT profile FROM submissions WHERE id = '...'`

