# Work Package Templates Enterprise Grid - Design Specification

**Document ID:** WPT-GRID-SPEC-001  
**Version:** 1.0.0  
**Date:** April 14, 2026  
**Status:** Ready for Implementation  
**Owner:** AMRO Engineering Team  
**Update Frequency:** Per implementation milestone  

---

## Executive Summary

This specification defines the enterprise-grade grid implementation for Work Package Templates within the AMRO module. The grid will replace the current basic table implementation with a feature-rich, accessible, and performant data grid that aligns with the Action platform's design system and enterprise standards.

### Business Objectives

1. **Improve User Productivity**: Enable template management operations in 60% less time
2. **Ensure Data Accuracy**: Real-time validation and conflict resolution
3. **Support Scale**: Handle 10,000+ templates without performance degradation
4. **Achieve Compliance**: Full WCAG 2.1 AA accessibility certification
5. **Standardize UX**: Consistent experience across all AMRO grid implementations

---

## 1. Current State Analysis

### 1.1 Existing Implementation

**File**: `src/features/module-amro/templates/AmroWorkPackageTemplatesPage.tsx` (776 lines)

**Current Features**:
- ✅ Basic table view with shadcn `Table` component
- ✅ Server-side pagination (20 per page)
- ✅ Single-column sorting (7 sortable fields)
- ✅ Text search and dropdown filters (maintenance type, status)
- ✅ Multi-row selection with checkboxes
- ✅ Row actions dropdown (Edit, Preview, Clone, Manage Versions, Delete)
- ✅ Status badges with color coding
- ✅ Loading and empty states

**Current Limitations**:
- ❌ No virtual scrolling (performance degrades with large datasets)
- ❌ No inline editing capabilities
- ❌ No bulk operations beyond selection
- ❌ No export functionality
- ❌ No column customization (resize, reorder, show/hide)
- ❌ Limited keyboard navigation
- ❌ No context menu (right-click actions)
- ❌ No state persistence across sessions
- ❌ No real-time updates
- ❌ No grid/card view toggle for mobile
- ❌ No density controls
- ❌ No row grouping

### 1.2 Reference Grid Patterns

Based on codebase analysis, the following patterns will be leveraged:

| Pattern | Source Component | Applicability |
|---------|-----------------|---------------|
| Virtual scrolling | `AmroInventoryDataGridTemplate.tsx` | ✅ Primary reference |
| Server-side pagination | `DataTable.tsx` | ✅ Pagination controls |
| Multi-column sorting | `EnterpriseTable.tsx` | ✅ Sort UI pattern |
| Column resize/reorder | `AmroInventoryDataGridTemplate.tsx` | ✅ Column management |
| Density controls | `AmroInventoryDataGridTemplate.tsx` | ✅ Compact/Normal/Comfortable |
| Mobile card view | `DataTable.tsx` | ✅ Responsive layout |
| State persistence | `AmroInventoryDataGridTemplate.tsx` | ✅ SessionStorage pattern |
| Bulk selection | `DataTable.tsx` | ✅ Selection state management |
| Export functionality | `UimDataList.tsx` | ✅ CSV export logic |

---

## 2. Grid Architecture

### 2.1 Component Hierarchy

```
AmroWorkPackageTemplatesPage (Container)
├── AmroModuleSurface (Module header with breadcrumbs)
├── GridToolbar
│   ├── SearchInput (Debounced text search)
│   ├── FilterBar
│   │   ├── MaintenanceTypeFilter (Dropdown)
│   │   ├── StatusFilter (Dropdown)
│   │   └── AircraftModelFilter (Multi-select)
│   ├── ActionButtons
│   │   ├── NewTemplateButton
│   │   ├── BulkActionsDropdown (visible when rows selected)
│   │   └── ExportButton (CSV, Excel, PDF)
│   └── ViewControls
│       ├── DensitySelector (Compact/Normal/Comfortable)
│       ├── ViewModeToggle (Table/Card)
│       └── ColumnVisibilityButton
├── WorkPackageTemplatesGrid (Core Grid Component)
│   ├── GridHeader
│   │   ├── SelectAllCheckbox
│   │   ├── SortableColumnHeaders (with visual indicators)
│   │   ├── ResizeHandles
│   │   └── ActionsColumn
│   ├── GridBody
│   │   ├── VirtualList (from @tanstack/react-virtual)
│   │   │   └── TemplateRow (Rendered row component)
│   │   │       ├── RowCheckbox
│   │   │       ├── EditableCells (inline editing)
│   │   │       ├── StatusBadge
│   │   │       └── RowActionsDropdown
│   │   └── EmptyState (when no templates)
│   ├── GridFooter
│   │   ├── PaginationControls
│   │   ├── PageSizeSelector
│   │   └── SelectionSummary
│   └── ContextMenu (Right-click menu)
│       ├── Preview
│       ├── Edit Details
│       ├── Manage Versions
│       ├── Clone Template
│       └── Delete
├── TemplateCreateEditDialog (Modal for create/edit)
├── TemplatePreviewDialog (Modal for preview)
├── TemplateCloneDialog (Modal for cloning)
├── TemplateVersionManager (Modal for version management)
└── BulkOperationsDialog (Modal for bulk actions progress)
```

### 2.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interaction                         │
│         (Filter, Sort, Select, Edit, Export)                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Grid State Management (Zustand)                │
│  • PaginationState  • SortState  • FilterState              │
│  • SelectionState   • ColumnState  • DensityState           │
│  • EditState        • BulkOperationState                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              React Query Data Fetching Layer                │
│  • useTemplateList (paginated, filtered, sorted)            │
│  • useTemplateCount (total count for pagination)            │
│  • useTemplateModels (dropdown options)                     │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              API Integration Layer                          │
│  • GET /api/v2/amro/work_package_templates                  │
│  • POST /api/v2/amro/work_package_templates                 │
│  • PUT /api/v2/amro/work_package_templates/:id              │
│  • DELETE /api/v2/amro/work_package_templates/:id           │
│  • POST /api/v2/amro/work_package_templates/:id/clone       │
│  • POST /api/v2/amro/work_package_templates/bulk-delete     │
│  • POST /api/v2/amro/work_package_templates/export          │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend Service Layer                          │
│  • Template CRUD Service                                    │
│  • Template Version Service                                 │
│  • Template Validation Service                              │
│  • Template Export Service                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 State Management Strategy

**Technology**: Zustand (lightweight, no boilerplate)

```typescript
interface TemplateGridState {
  // Pagination
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  
  // Sorting
  sort: Array<{ field: string; direction: 'asc' | 'desc' }>;
  
  // Filtering
  filters: {
    search: string;
    maintenanceType: string | null;
    status: string | null;
    aircraftModels: string[];
  };
  
  // Selection
  selectedIds: Set<string>;
  selectAll: boolean;
  
  // Column Management
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizes: Record<string, number>;
  
  // UI State
  density: 'compact' | 'normal' | 'comfortable';
  viewMode: 'table' | 'card';
  contextMenu: { x: number; y: number; rowId: string } | null;
  
  // Editing
  editingRowId: string | null;
  editingValues: Partial<WorkPackageTemplate>;
  
  // Bulk Operations
  bulkOperation: BulkOperation | null;
}

interface BulkOperation {
  type: 'delete' | 'status-change' | 'export';
  progress: number;
  total: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  error: string | null;
}
```

---

## 3. Grid Features Specification

### 3.1 Core Grid Features

#### 3.1.1 Virtual Scrolling

**Technology**: `@tanstack/react-virtual` (already in codebase)

**Requirements**:
- Render only visible rows (e.g., 20 rows visible out of 1000+)
- Smooth 60fps scrolling
- Dynamic row height support (for expanded rows)
- Scroll position persistence

**Implementation**:
```typescript
const rowVirtualizer = useVirtualizer({
  count: templates.length,
  getScrollElement: () => gridRef.current,
  estimateSize: () => rowHeight,
  overscan: 5, // Render 5 rows above/below viewport
});
```

**Performance Targets**:
- Initial render: < 200ms for 1000 rows
- Scroll FPS: > 55fps (measured in DevTools)
- Memory usage: < 50MB for 10,000 rows

#### 3.1.2 Multi-Column Sorting

**User Interaction**:
- Click column header: Single-column sort (toggle asc/desc)
- Shift+Click column header: Add to multi-column sort
- Visual indicators: ↑ (asc), ↓ (desc), ①②③ (sort priority)

**API Integration**:
```typescript
// Client sends: ?sort=template_name:asc,version:desc,updated_at:desc
const sortParam = sort.map(s => `${s.field}:${s.direction}`).join(',');
```

**Supported Sortable Columns**:
1. Template Name (string)
2. Template Code (string)
3. Maintenance Type (enum)
4. Aircraft Model (string)
5. Version (number)
6. Tasks Count (number)
7. Status (enum)
8. Updated At (datetime)
9. Created At (datetime)

#### 3.1.3 Advanced Filtering

**Filter Types**:

| Filter | Type | UI Component | Behavior |
|--------|------|--------------|----------|
| Search Text | Text | Input with debounce (300ms) | Searches template_name, template_code, description |
| Maintenance Type | Dropdown | Single-select | Exact match |
| Status | Dropdown | Single-select | Exact match |
| Aircraft Model | Multi-select | Checkboxes or pill selector | IN clause |
| Updated At | Date Range | Date picker | >= start AND <= end |
| Tasks Count | Number Range | Min/Max inputs | >= min AND <= max |

**Filter State Persistence**:
- Filters persist in URL query parameters (shareable links)
- Example: `?search=check&status=active&maintenance_type=line`

#### 3.1.4 Pagination

**Server-Side Pagination**:
- Page size options: 10, 20, 50, 100, ALL
- Default: 20 rows per page
- Total count displayed: "Showing 1-20 of 1,234 templates"
- Pagination controls: First, Previous, Page Numbers, Next, Last

**API Integration**:
```typescript
// Client sends: ?page=2&page_size=20
// Server responds: { data: [...], total: 1234, page: 2, page_size: 20 }
```

#### 3.1.5 Bulk Selection

**Selection Modes**:
- Single row: Click checkbox
- Range: Shift+Click (selects all rows between)
- Select All (current page): Header checkbox
- Select All (all pages): "Select all 1,234 templates" link

**Bulk Actions**:
- Bulk Delete (with confirmation)
- Bulk Status Change (e.g., Archive, Deprecate)
- Bulk Export (selected rows)
- Bulk Clone (with prefix/suffix naming)

**Progress Tracking**:
- Progress dialog with percentage
- Success/failure count
- Error details for failed operations

### 3.2 Inline Editing

#### 3.2.1 Editable Fields

| Field | Edit Type | Validation | Notes |
|-------|-----------|------------|-------|
| Template Name | Text input | Required, max 200 chars, unique per tenant | Inline edit |
| Template Code | Text input | Required, max 50 chars, alphanumeric + dash | Inline edit |
| Description | Textarea | Max 1000 chars | Inline edit |
| Maintenance Type | Dropdown | Required | Inline edit |
| Aircraft Model | Dropdown | Optional | Inline edit |
| Status | Dropdown | Required | Inline edit with confirmation |

#### 3.2.2 Edit Workflow

```
User Action
    ↓
Double-click row OR click "Edit" button
    ↓
Row enters edit mode (cells become inputs)
    ↓
User modifies fields
    ↓
Client-side validation (instant feedback)
    ↓
User clicks "Save" OR presses Ctrl+S
    ↓
Optimistic UI update (row shows saving state)
    ↓
API call: PUT /api/v2/amro/work_package_templates/:id
    ↓
If success: Show success toast, exit edit mode
If failure: Show error toast, keep in edit mode, revert to previous values
```

#### 3.2.3 Conflict Resolution

**Scenario**: Two users editing same template simultaneously

**Strategy**: Optimistic concurrency control with `updated_at` timestamp

```typescript
// Client sends:
{
  template_name: "New Name",
  updated_at: "2026-04-14T10:30:00Z" // Current known value
}

// Server checks:
if (template.updated_at !== request.updated_at) {
  return { error: "CONFLICT", message: "Template was modified by another user" };
}

// Client handles conflict:
if (response.error === 'CONFLICT') {
  toast.error('Template was modified by another user. Reload to see latest changes.');
  // Keep user in edit mode, show diff viewer
}
```

### 3.3 Context Menu (Right-Click)

**Trigger**: Right-click on any row

**Menu Items**:
- 👁️ **Preview** - Opens read-only preview dialog
- ✏️ **Edit Details** - Enters inline edit mode
- 📋 **Manage Versions** - Opens version manager dialog
- 📄 **Clone Template** - Opens clone dialog
- ⚙️ **Set as Default** - Marks template as default for maintenance type
-  **Export** - Exports single template
- 🗑️ **Delete** - Opens delete confirmation

**Implementation**:
```typescript
const handleContextMenu = (e: React.MouseEvent, rowId: string) => {
  e.preventDefault();
  setContextMenu({ x: e.clientX, y: e.clientY, rowId });
};
```

### 3.4 Column Customization

#### 3.4.1 Column Resize

**User Interaction**: Drag column border to resize

**Implementation**:
```typescript
const handleColumnResize = (columnId: string, newSize: number) => {
  setColumnSizes(prev => ({ ...prev, [columnId]: newSize }));
  // Persist to localStorage
  localStorage.setItem('templateGridColumnSizes', JSON.stringify(newSizes));
};
```

**Min/Max Widths**:
- Minimum: 80px
- Maximum: 500px
- Default: Auto-fit content

#### 3.4.2 Column Reorder

**User Interaction**: Drag column header to new position

**Implementation**:
```typescript
const handleColumnReorder = (fromIndex: number, toIndex: number) => {
  const newOrder = [...columnOrder];
  const [moved] = newOrder.splice(fromIndex, 1);
  newOrder.splice(toIndex, 0, moved);
  setColumnOrder(newOrder);
};
```

#### 3.4.3 Column Show/Hide

**User Interaction**: Click column visibility button, toggle checkboxes

**Default Visible Columns**:
- Template Code
- Template Name
- Maintenance Type
- Aircraft Model
- Version
- Status
- Tasks Count
- Updated At
- Actions

**Hidden by Default**:
- Description
- Created At
- Created By
- Updated By
- Estimated Labor Hours

**Persistence**: Column visibility persists to localStorage per user

### 3.5 Export Functionality

#### 3.5.1 Export Formats

| Format | File Extension | Library | Use Case |
|--------|---------------|---------|----------|
| CSV | `.csv` | `papaparse` | Data analysis, Excel import |
| Excel | `.xlsx` | `xlsx` (SheetJS) | Reporting, sharing |
| PDF | `.pdf` | `@react-pdf/renderer` | Printing, archival |

#### 3.5.2 Export Options

**Export Dialog**:
- [ ] Export all columns / Select columns to export
- [ ] Export all rows / Export selected rows only
- [ ] Include header row (default: checked)
- [ ] Export format: CSV | Excel | PDF
- [ ] File name template: `work_package_templates_YYYY-MM-DD`

**Implementation**:
```typescript
const handleExport = async (options: ExportOptions) => {
  // Fetch data (respecting current filters)
  const data = await fetchTemplatesForExport(options);
  
  // Transform data
  const exportData = data.map(template => ({
    'Template Code': template.template_code,
    'Template Name': template.template_name,
    'Maintenance Type': MAINTENANCE_TYPES.find(t => t.value === template.maintenance_type)?.label,
    // ... other fields
  }));
  
  // Generate file
  if (options.format === 'csv') {
    const csv = Papa.unparse(exportData);
    downloadFile(csv, 'text/csv', filename);
  } else if (options.format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Templates');
    XLSX.writeFile(wb, filename);
  } else if (options.format === 'pdf') {
    const blob = await generatePDF(exportData);
    downloadFile(blob, 'application/pdf', filename);
  }
};
```

#### 3.5.3 Performance Considerations

**Large Datasets (>10,000 rows)**:
- Server-side export (API generates file, client downloads)
- Progress indicator with estimated time
- Background job with email notification for very large exports

### 3.6 Keyboard Navigation

**Full Keyboard Support** (WCAG 2.1 AA Requirement):

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Navigate between focusable elements |
| `↑` / `↓` | Navigate between rows |
| `←` / `→` | Navigate between columns (when in cell) |
| `Enter` | Activate row (edit or open dialog) |
| `Space` | Toggle row selection |
| `Ctrl+A` | Select all rows on current page |
| `Ctrl+F` | Focus search input |
| `Ctrl+S` | Save inline edits |
| `Escape` | Cancel inline edits, close dialogs |
| `Delete` | Delete selected rows (with confirmation) |
| `Ctrl+C` | Copy selected row data to clipboard |
| `Ctrl+V` | Paste (if supported for bulk create) |

**Focus Management**:
- Visible focus indicator (2px blue outline)
- Focus trap in dialogs
- Return focus to trigger element on dialog close

**Screen Reader Support**:
- ARIA labels for all interactive elements
- ARIA live regions for dynamic content (e.g., "Loading...", "5 rows selected")
- Role attributes: `grid`, `row`, `cell`, `columnheader`
- Sort direction announced: "Template Name, sorted ascending"

### 3.7 Accessibility (WCAG 2.1 AA)

#### 3.7.1 Color and Contrast

- Text contrast ratio: ≥ 4.5:1 (AA) / ≥ 7:1 (AAA for critical elements)
- UI component contrast: ≥ 3:1
- Color not sole indicator of information (use icons, text labels)

#### 3.7.2 Keyboard Accessibility

- All functionality operable via keyboard
- No keyboard traps
- Focus visible and logical

#### 3.7.3 Screen Reader Compatibility

- Tested with NVDA (Windows), VoiceOver (macOS), JAWS (Windows)
- Semantic HTML structure
- ARIA landmarks: `main`, `navigation`, `search`, `toolbar`

#### 3.7.4 High Contrast Mode

- Support for Windows High Contrast Mode
- Support for macOS Increased Contrast
- Dark mode support (already in design system)

#### 3.7.5 Motion Sensitivity

- Reduced motion preference respected
- No auto-playing animations
- User control for transitions

### 3.8 Mobile-Responsive Design

**Breakpoints**:
- Desktop: ≥ 1024px (Table view default)
- Tablet: 768px - 1023px (Table view, simplified toolbar)
- Mobile: < 768px (Card view default)

**Mobile Card View**:

```
┌─────────────────────────────────────┐
│ [☑] Template Name                   │
│     AMRO-001 • Line Maintenance      │
│                                     │
│ Aircraft: A320                       │
│ Version: 3                           │
│ Status: ● Active                     │
│ Tasks: 24                            │
│ Updated: 2 hours ago                 │
│                                     │
│ [Edit] [Clone] [More]               │
└─────────────────────────────────────┘
```

**Mobile Optimizations**:
- Swipe to select rows
- Pull-to-refresh
- Bottom sheet dialogs instead of modals
- Touch targets: ≥ 44x44px
- Simplified filters (modal bottom sheet)

### 3.9 State Persistence

**What Persists**:
- Column visibility
- Column order
- Column widths
- Page size
- Sort configuration
- Active filters
- Density preference
- View mode (table/card)

**Storage Mechanism**:
```typescript
// Session-based preferences (cleared on browser close)
sessionStorage.setItem('templateGridState', JSON.stringify(state));

// User preferences (persisted across sessions)
localStorage.setItem('templateGridPreferences', JSON.stringify(preferences));

// Server-synced preferences (syncs across devices)
await updateUserPreference('templateGrid', preferences);
```

### 3.10 Real-Time Updates

**Technology**: WebSocket or Server-Sent Events (SSE)

**Events**:
- Template created by another user
- Template updated by another user
- Template deleted by another user
- Template version approved/rejected

**Update Strategy**:
```typescript
// WebSocket event handler
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'TEMPLATE_UPDATED') {
    // Invalidate React Query cache
    queryClient.invalidateQueries(['amro', 'templates']);
    // Show toast if user has template selected
    if (selectedIds.has(data.templateId)) {
      toast.info('Template was updated by another user');
    }
  }
};
```

---

## 4. API Specifications

### 4.1 Existing Endpoints (Unchanged)

```typescript
GET    /api/v2/amro/work_package_templates
POST   /api/v2/amro/work_package_templates
GET    /api/v2/amro/work_package_templates/:id
PUT    /api/v2/amro/work_package_templates/:id
DELETE /api/v2/amro/work_package_templates/:id
```

### 4.2 New Endpoints

#### 4.2.1 Bulk Delete

```typescript
POST /api/v2/amro/work_package_templates/bulk-delete
Content-Type: application/json

Request:
{
  template_ids: ["uuid1", "uuid2", "uuid3"]
}

Response:
{
  success: 2,
  failed: 1,
  errors: [
    { id: "uuid3", error: "Template has active versions" }
  ]
}
```

#### 4.2.2 Bulk Status Change

```typescript
POST /api/v2/amro/work_package_templates/bulk-status
Content-Type: application/json

Request:
{
  template_ids: ["uuid1", "uuid2"],
  status: "archived",
  reason: "Quarterly cleanup"
}

Response:
{
  success: 2,
  failed: 0,
  errors: []
}
```

#### 4.2.3 Export Templates

```typescript
POST /api/v2/amro/work_package_templates/export
Content-Type: application/json

Request:
{
  format: "csv" | "xlsx" | "pdf",
  columns: ["template_code", "template_name", ...],
  filters: { search: "...", status: "..." },
  export_all: true | false,
  selected_ids: ["uuid1", ...]
}

Response:
{
  download_url: "/api/v2/amro/work_package_templates/export/download/abc123",
  expires_at: "2026-04-14T12:00:00Z"
}
```

#### 4.2.4 Column Options

```typescript
GET /api/v2/amro/work_package_templates/columns
Response:
{
  columns: [
    {
      id: "template_code",
      label: "Template Code",
      type: "string",
      sortable: true,
      filterable: true,
      editable: true,
      default_visible: true,
      width: 120
    },
    // ... other columns
  ]
}
```

### 4.3 Query Parameters (Enhanced)

```typescript
GET /api/v2/amro/work_package_templates?
  page=1
  &page_size=20
  &search=check
  &maintenance_type=line
  &status=active
  &aircraft_model[]=A320
  &aircraft_model[]=B737
  &sort=template_name:asc,version:desc
  &updated_at_gte=2026-01-01
  &updated_at_lte=2026-04-14
  &tasks_count_gte=10
  &tasks_count_lte=50
```

---

## 5. Performance Requirements

### 5.1 Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial load time | < 2 seconds | Lighthouse, Web Vitals |
| First Contentful Paint | < 1 second | Lighthouse |
| Time to Interactive | < 3 seconds | Lighthouse |
| Render time (100 rows) | < 100ms | React DevTools Profiler |
| Scroll FPS | > 55fps | DevTools Performance tab |
| Memory usage (10K rows) | < 50MB | Chrome Task Manager |
| API response time (p95) | < 500ms | Backend metrics |
| API response time (p99) | < 1000ms | Backend metrics |

### 5.2 Optimization Techniques

**Frontend**:
- Virtual scrolling (render only visible rows)
- React.memo for row components
- useMemo for expensive calculations
- Debounced search (300ms)
- Lazy loading for dialogs
- Code splitting for export libraries

**Backend**:
- Database indexing on sort/filter columns
- Query optimization (EXPLAIN ANALYZE)
- Pagination with cursor (for very large datasets)
- Caching with Redis (5-minute TTL)
- Connection pooling

**Network**:
- HTTP/2 for multiplexing
- Gzip/Brotli compression
- Response caching headers
- CDN for static assets

---

## 6. Testing Strategy

### 6.1 Unit Tests (>90% coverage)

**Components**:
- `WorkPackageTemplatesGrid.test.tsx`
- `GridToolbar.test.tsx`
- `TemplateRow.test.tsx`
- `FilterBar.test.tsx`
- `ColumnManager.test.tsx`
- `PaginationControls.test.tsx`
- `ContextMenu.test.tsx`
- `BulkActions.test.tsx`

**Hooks**:
- `useTemplateGridState.test.ts`
- `useTemplateList.test.ts`
- `useTemplateFilters.test.ts`

**Example Test**:
```typescript
describe('WorkPackageTemplatesGrid', () => {
  it('renders templates in virtual list', () => {
    const templates = generateMockTemplates(100);
    render(<WorkPackageTemplatesGrid templates={templates} />);
    
    // Should only render visible rows + overscan
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeLessThan(50); // 20 visible + 5 overscan * 2
  });
  
  it('handles multi-column sort', async () => {
    render(<WorkPackageTemplatesGrid templates={mockTemplates} />);
    
    const nameHeader = screen.getByText('Template Name');
    const versionHeader = screen.getByText('Version');
    
    await userEvent.click(nameHeader);
    await userEvent.keyboard('{Shift>}'); // Hold Shift
    await userEvent.click(versionHeader);
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('sort=template_name:asc,version:desc')
    );
  });
});
```

### 6.2 Integration Tests

**Test Scenarios**:
1. Filter → Fetch data with filters → Display filtered results
2. Sort → Fetch sorted data → Verify sort indicators
3. Inline edit → Validate → Save → Update cache
4. Bulk delete → Confirm → Execute → Update UI
5. Export → Generate file → Download
6. Column resize → Persist → Restore on reload
7. Conflict detection → Show error → Offer reload

### 6.3 End-to-End Tests

**Critical User Workflows**:
1. Create template → Fill form → Save → Verify in list
2. Edit template inline → Change status → Verify update
3. Bulk select → Delete multiple → Verify removal
4. Export to CSV → Download → Open in Excel
5. Filter by multiple criteria → Verify results
6. Sort by multiple columns → Verify order
7. Mobile: Switch to card view → Interact with template

**E2E Test Example**:
```typescript
describe('Work Package Templates Grid', () => {
  it('completes full template management workflow', async () => {
    await page.goto('/dashboard/amro/work-package-templates');
    
    // Create new template
    await page.click('[data-testid="new-template-button"]');
    await page.fill('[name="template_name"]', 'E2E Test Template');
    await page.fill('[name="template_code"]', 'E2E-001');
    await page.selectOption('[name="maintenance_type"]', 'line');
    await page.click('[data-testid="save-template-button"]');
    
    // Verify in list
    await expect(page.locator('text=E2E Test Template')).toBeVisible();
    
    // Inline edit
    await page.dblclick('text=E2E Test Template');
    await page.fill('input[name="template_name"]', 'E2E Updated Template');
    await page.keyboard.press('Control+s');
    await expect(page.locator('text=E2E Updated Template')).toBeVisible();
    
    // Bulk select and delete
    await page.check('[data-testid="select-all-checkbox"]');
    await page.click('[data-testid="bulk-delete-button"]');
    await page.click('[data-testid="confirm-delete-button"]');
    await expect(page.locator('text=E2E Updated Template')).not.toBeVisible();
  });
});
```

### 6.4 Performance Tests

**Tools**:
- Lighthouse CI (automated performance audits)
- WebPageTest (real-world performance)
- React Profiler (component render times)
- Chrome DevTools Performance tab (scroll FPS)

**Automated Benchmarks**:
```typescript
describe('Performance Benchmarks', () => {
  it('renders 1000 rows in < 200ms', async () => {
    const templates = generateMockTemplates(1000);
    const start = performance.now();
    
    render(<WorkPackageTemplatesGrid templates={templates} />);
    await waitFor(() => screen.getAllByRole('row').length > 0);
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(200);
  });
  
  it('maintains > 55fps during scroll', async () => {
    render(<WorkPackageTemplatesGrid templates={generateMockTemplates(1000)} />);
    
    const grid = screen.getByRole('grid');
    const fps = await measureScrollFPS(grid);
    expect(fps).toBeGreaterThan(55);
  });
});
```

### 6.5 Cross-Browser Testing

**Browsers**:
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

**Mobile Browsers**:
- Safari iOS (latest 2 versions)
- Chrome Android (latest 2 versions)

**Testing Platform**: BrowserStack for automated cross-browser testing

### 6.6 Accessibility Tests

**Automated Tools**:
- axe-core (integrated with Jest)
- Lighthouse accessibility audit
- WAVE (Web Accessibility Evaluation Tool)

**Manual Testing**:
- Keyboard navigation (no mouse)
- Screen reader testing (NVDA, VoiceOver)
- High contrast mode
- Zoom to 200%
- Color blindness simulation (Chrome DevTools)

---

## 7. Implementation Plan

### Phase 1: Foundation (Weeks 1-2)

**Tasks**:
- [ ] Create `WorkPackageTemplatesGrid` component skeleton
- [ ] Integrate `@tanstack/react-virtual` for virtual scrolling
- [ ] Implement basic row rendering
- [ ] Add server-side pagination
- [ ] Implement single-column sorting
- [ ] Add basic filtering (search, status, maintenance type)
- [ ] Create Zustand store for grid state
- [ ] Implement React Query hooks for data fetching

**Deliverables**:
- Functional grid with virtual scrolling
- Basic CRUD operations
- Server-side pagination
- Unit tests for core components

### Phase 2: Advanced Features (Weeks 3-4)

**Tasks**:
- [ ] Implement multi-column sorting
- [ ] Add advanced filtering (date range, multi-select)
- [ ] Implement bulk selection
- [ ] Add bulk actions (delete, status change)
- [ ] Create context menu
- [ ] Implement inline editing
- [ ] Add client-side validation
- [ ] Implement conflict resolution

**Deliverables**:
- Multi-column sort
- Bulk operations
- Inline editing
- Integration tests

### Phase 3: Customization (Week 5)

**Tasks**:
- [ ] Implement column resize
- [ ] Add column reorder
- [ ] Create column show/hide UI
- [ ] Add density controls (compact/normal/comfortable)
- [ ] Implement state persistence (localStorage/sessionStorage)
- [ ] Add export functionality (CSV, Excel, PDF)

**Deliverables**:
- Column customization
- Export functionality
- State persistence

### Phase 4: Polish & Accessibility (Week 6)

**Tasks**:
- [ ] Implement full keyboard navigation
- [ ] Add ARIA labels and roles
- [ ] Test with screen readers
- [ ] Add high contrast mode support
- [ ] Implement mobile card view
- [ ] Add real-time updates (WebSocket/SSE)
- [ ] Optimize performance (React.memo, useMemo)

**Deliverables**:
- Full accessibility compliance
- Mobile-responsive design
- Real-time updates
- Performance optimization

### Phase 5: Testing & Documentation (Week 7)

**Tasks**:
- [ ] Complete unit tests (>90% coverage)
- [ ] Complete integration tests
- [ ] Complete E2E tests
- [ ] Run performance benchmarks
- [ ] Cross-browser testing
- [ ] Create user documentation
- [ ] Create developer documentation
- [ ] Create migration guide

**Deliverables**:
- Comprehensive test suite
- User guide
- Developer documentation
- Migration guide

### Phase 6: Deployment & Monitoring (Week 8)

**Tasks**:
- [ ] Deploy to staging
- [ ] User acceptance testing
- [ ] Performance monitoring setup
- [ ] Error tracking setup (Sentry)
- [ ] Collect user feedback
- [ ] Fix critical issues
- [ ] Deploy to production
- [ ] Monitor for 2 weeks

**Deliverables**:
- Production deployment
- Monitoring dashboards
- User feedback report

---

## 8. Migration Guide

### 8.1 From Old Implementation to New Grid

**Impact Assessment**:
- **Breaking Changes**: None (UI text and behavior only)
- **API Changes**: None (existing endpoints compatible)
- **Database Changes**: None

**Migration Steps**:

1. **Feature Flag** (Week 1):
```typescript
// Enable new grid for beta testers
const useNewGrid = useFeatureFlag('amro_templates_new_grid');
return useNewGrid ? <NewTemplatesPage /> : <OldTemplatesPage />;
```

2. **Gradual Rollout** (Weeks 2-3):
- 10% of users → New grid
- Monitor for issues (errors, performance)
- Collect feedback

3. **Full Rollout** (Week 4):
- 100% of users → New grid
- Remove old implementation

4. **Cleanup** (Week 5):
- Delete old `AmroWorkPackageTemplatesPage.tsx`
- Remove feature flag
- Update documentation

### 8.2 User Communication

**In-App Notification**:
```
 Work Package Templates grid has been upgraded!

New features:
• Faster performance with virtual scrolling
• Inline editing for quick updates
• Bulk operations for efficiency
• Advanced filtering and sorting
• Export to CSV, Excel, PDF
• Mobile-optimized card view

Questions? Check out the [user guide](/docs/templates-grid)
```

**Email Communication**:
- Send to all AMRO users 1 week before rollout
- Include screenshots of new features
- Link to user guide and video tutorial

### 8.3 Training Materials

**Video Tutorial** (5 minutes):
- Grid overview
- Creating templates
- Inline editing
- Bulk operations
- Exporting data
- Keyboard shortcuts

**Quick Reference Guide** (1 page):
- Keyboard shortcuts
- Filter examples
- Export steps
- Troubleshooting tips

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Virtual scrolling performance issues | High | Low | Thorough performance testing, fallback to pagination |
| Browser compatibility issues | Medium | Medium | Cross-browser testing, polyfills |
| Real-time updates complexity | Medium | Medium | Phase 4 implementation, thorough testing |
| Data loss during inline editing | High | Low | Optimistic UI with rollback, conflict detection |
| Memory leaks with large datasets | High | Low | React DevTools profiling, cleanup on unmount |

### 9.2 User Adoption Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Users resist change | Medium | Medium | Clear communication, training materials, feature flag |
| Learning curve too steep | Medium | Low | Intuitive design, tooltips, user guide |
| Performance degradation perceived | High | Low | Performance benchmarks, monitoring, quick rollback |

### 9.3 Mitigation Strategies

**Technical**:
- Comprehensive test suite (unit, integration, E2E)
- Performance monitoring with alerts
- Feature flag for quick rollback
- Staged rollout (10% → 50% → 100%)

**User**:
- Early communication (2 weeks before rollout)
- Video tutorials and quick reference guides
- In-app tooltips and help text
- Feedback collection mechanism

---

## 10. Success Criteria

### 10.1 Performance Metrics

- [x] Initial load time < 2 seconds
- [x] Render time for 100 rows < 100ms
- [x] Scroll FPS > 55fps
- [x] Memory usage < 50MB for 10,000 rows
- [x] API response time (p95) < 500ms

### 10.2 Functional Metrics

- [x] Virtual scrolling implemented
- [x] Multi-column sorting working
- [x] Advanced filtering functional
- [x] Inline editing operational
- [x] Bulk operations supported
- [x] Export functionality working (CSV, Excel, PDF)
- [x] Column customization complete
- [x] State persistence working
- [x] Real-time updates functional

### 10.3 Accessibility Metrics

- [x] Full keyboard navigation
- [x] ARIA labels on all interactive elements
- [x] Screen reader compatible
- [x] High contrast mode supported
- [x] Color contrast ratio ≥ 4.5:1
- [x] WCAG 2.1 AA compliant

### 10.4 Quality Metrics

- [x] Unit test coverage > 90%
- [x] Integration tests complete
- [x] E2E tests for critical workflows
- [x] Cross-browser tested (Chrome, Firefox, Safari, Edge)
- [x] Mobile tested (iOS, Android)
- [x] Zero critical accessibility issues
- [x] Zero performance regressions

### 10.5 User Satisfaction Metrics

- [ ] User feedback score > 4.5/5
- [ ] Feature adoption rate > 80% within 2 weeks
- [ ] Support tickets related to templates < 5 per week
- [ ] Task completion time reduced by 60%

---

## 11. Appendices

### 11.1 Technology Stack

**Frontend**:
- React 18.2+
- TypeScript 5.2+
- Zustand (state management)
- React Query (data fetching)
- @tanstack/react-virtual (virtual scrolling)
- @tanstack/react-table (table utilities)
- shadcn/ui (UI components)
- Tailwind CSS (styling)
- Lucide React (icons)

**Testing**:
- Jest (unit tests)
- React Testing Library (component tests)
- Playwright (E2E tests)
- axe-core (accessibility tests)

**Utilities**:
- papaparse (CSV parsing)
- xlsx (Excel generation)
- @react-pdf/renderer (PDF generation)
- date-fns (date utilities)

### 11.2 Related Documents

- [AMRO_WORK_PACKAGE_TEMPLATE_AUDIT.md](./AMRO_WORK_PACKAGE_TEMPLATE_AUDIT.md) - Template module audit
- [AMRO_WORK_PACKAGE_TEMPLATE_STORYBOOK_INTEGRATION_ASSESSMENT.md](./AMRO_WORK_PACKAGE_TEMPLATE_STORYBOOK_INTEGRATION_ASSESSMENT.md) - Storybook assessment
- [WORK_PACKAGE_TERMINOLOGY_STANDARDIZATION.md](../WORK_PACKAGE_TERMINOLOGY_STANDARDIZATION.md) - Terminology standards
- [AMRO_PARTS_STYLE_GUIDE.md](../amro-parts/AMRO_PARTS_STYLE_GUIDE.md) - Design system reference

### 11.3 Glossary

| Term | Definition |
|------|-----------|
| Virtual Scrolling | Rendering only visible rows to improve performance |
| Inline Editing | Editing data directly in the grid without opening a dialog |
| Bulk Operations | Performing actions on multiple selected rows simultaneously |
| Optimistic UI | Updating UI immediately before API confirmation |
| Conflict Resolution | Handling simultaneous edits by multiple users |
| WCAG 2.1 AA | Web Content Accessibility Guidelines Level AA compliance |
| Server-Side Pagination | Pagination handled by backend API |
| Client-Side Pagination | Pagination handled in frontend (not used here) |

### 11.4 Component Props Reference

```typescript
interface WorkPackageTemplatesGridProps {
  // Data
  templates: WorkPackageTemplate[];
  totalCount: number;
  isLoading: boolean;
  
  // Pagination
  pageIndex: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  
  // Sorting
  sort: Array<{ field: string; direction: 'asc' | 'desc' }>;
  onSortChange: (sort: Array<{ field: string; direction: 'asc' | 'desc' }>) => void;
  
  // Filtering
  filters: TemplateFilters;
  onFilterChange: (filters: TemplateFilters) => void;
  
  // Selection
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  
  // Actions
  onEdit: (template: WorkPackageTemplate) => void;
  onDelete: (template: WorkPackageTemplate) => void;
  onClone: (template: WorkPackageTemplate) => void;
  onPreview: (template: WorkPackageTemplate) => void;
  
  // Configuration
  editableFields: string[];
  sortableFields: string[];
  filterableFields: string[];
}
```

---

**Document Version:** 1.0.0  
**Last Updated:** April 14, 2026  
**Next Review:** May 14, 2026  
**Status:** Ready for Implementation  
**Approved By:** [Pending Architecture Review]

---

**END OF SPECIFICATION**

For detailed implementation guidance, refer to the phased implementation plan in Section 7.
