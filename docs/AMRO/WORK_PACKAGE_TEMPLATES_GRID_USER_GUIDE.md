# Work Package Templates Enterprise Grid - User Guide

**Document ID:** WPT-GRID-USER-001  
**Version:** 1.0.0  
**Date:** April 14, 2026  
**Audience:** End Users (Maintenance Planners, Technicians, Managers)  

---

## Quick Start

The Work Package Templates Enterprise Grid is your central hub for managing maintenance templates. This guide covers all features from basic navigation to advanced operations.

---

## 1. Grid Overview

### 1.1 Main Components

```
┌─────────────────────────────────────────────────────────────┐
│  Search │ Filters │ [Refresh] [Bulk Actions] [Export] [+]  │
├─────────────────────────────────────────────────────────────┤
│  Code │ Name │ Type │ Model │ Version │ Status │ Tasks │...│
├─────────────────────────────────────────────────────────────┤
│  TPL-001 │ A320 Line │ Line │ A320 │ v3 │ Active │ 24 │ ⋮ │
│  TPL-002 │ B737 Base │ Base │ B737 │ v1 │ Draft │ 18 │ ⋮ │
│  TPL-003 │ Engine OH │ Overhaul │ A320 │ v2 │ Active │ 45 │ ⋮ │
─────────────────────────────────────────────────────────────┤
│  Showing 1-20 of 156 templates    [1] [2] [3] ... [8]      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 View Modes

| View | Description | When to Use |
|------|-------------|-------------|
| **Table View** | Traditional grid with columns | Desktop, detailed analysis |
| **Card View** | Mobile-optimized cards | Mobile devices, quick overview |

**Switch View**: Click the Table/Card icons in the toolbar.

---

## 2. Navigation

### 2.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate between rows |
| `←` / `→` | Navigate between columns |
| `Enter` | Edit cell / Activate row |
| `Space` | Select/deselect row |
| `Ctrl+A` | Select all rows |
| `Ctrl+F` | Focus search box |
| `Ctrl+R` | Refresh data |
| `Ctrl+E` | Edit selected row |
| `Ctrl+D` | Clone selected row |
| `Ctrl+Delete` | Delete selected row |
| `Escape` | Cancel / Close dialogs |
| `Page Up/Down` | Navigate 10 rows |
| `Home/End` | First/last column |
| `Ctrl+Home/End` | First/last row |

### 2.2 Mouse Actions

| Action | Result |
|--------|--------|
| Click checkbox | Select row |
| Click row | Preview template |
| Double-click row | Edit template |
| Right-click row | Context menu |
| Click column header | Sort by column |
| Shift+Click header | Multi-column sort |
| Drag column border | Resize column |
| Drag column header | Reorder columns |

---

## 3. Searching and Filtering

### 3.1 Text Search

1. Type in the search box
2. Results filter automatically (300ms delay)
3. Searches: Template Name, Template Code, Description

**Clear Search**: Click the × button or press Escape.

### 3.2 Dropdown Filters

| Filter | Options | Description |
|--------|---------|-------------|
| **Maintenance Type** | All, Line, Base, Component, Inspection, Overhaul, Repair, Upgrade, Modification | Filter by maintenance category |
| **Status** | All, Active, Draft, Pending Review, Approved, Deprecated, Archived | Filter by template status |

### 3.3 Advanced Filters

Click **Advanced Filters** button to access:

#### Date Range Filters
- **Updated At**: From/To date pickers
- **Created At**: From/To date pickers

#### Number Range Filters
- **Tasks Count**: Min/Max values
- **Labor Hours**: Min/Max values

#### Aircraft Models
- Click badges to select/deselect models
- Multiple models can be selected

#### Filter Presets
- **Save Current**: Save current filter combination
- **Load Preset**: Apply saved filter combination
- **Delete Preset**: Remove saved preset

**Apply Filters**: Click "Apply Filters" button.
**Clear All**: Click "Clear All" to reset all filters.

---

## 4. Sorting

### 4.1 Single-Column Sort

1. Click any column header
2. Arrow indicates sort direction (↑ ascending, ↓ descending)
3. Click again to toggle direction

### 4.2 Multi-Column Sort

1. Click first column header
2. Hold **Shift** and click additional columns
3. Numbers indicate sort priority (①②③)
4. Click to cycle: Ascending → Descending → Remove

### 4.3 Sortable Columns

| Column | Sortable | Type |
|--------|----------|------|
| Template Code | ✅ | Text |
| Template Name | ✅ | Text |
| Maintenance Type | ✅ | Enum |
| Aircraft Model | ✅ | Text |
| Version | ✅ | Number |
| Status | ✅ | Enum |
| Tasks Count | ✅ | Number |
| Last Updated | ✅ | Date |

---

## 5. Selection

### 5.1 Selecting Rows

| Method | Action |
|--------|--------|
| **Single** | Click checkbox |
| **Multiple** | Click multiple checkboxes |
| **Range** | Shift+Click (selects all between) |
| **All (Page)** | Click header checkbox |
| **All (Keys)** | Ctrl+A |

### 5.2 Selection Indicator

- Selected rows highlighted in blue
- Selection count shown in toolbar
- "Clear Selection" button appears

---

## 6. Inline Editing

### 6.1 Edit a Cell

1. **Click** on any editable cell
2. Cell transforms to input field
3. Make your changes
4. Press **Enter** to save or **Escape** to cancel

### 6.2 Editable Fields

| Field | Type | Validation |
|-------|------|------------|
| Template Name | Text | Required, max 200 chars |
| Template Code | Text | Required, max 50 chars |
| Description | Textarea | Max 1000 chars |
| Maintenance Type | Dropdown | Required |
| Aircraft Model | Dropdown | Optional |
| Status | Dropdown | Required |

### 6.3 Save/Cancel

| Action | Result |
|--------|--------|
| **Enter** | Save changes |
| **Escape** | Cancel editing |
| **Click Save** | Save changes |
| **Click Cancel** | Cancel editing |

### 6.4 Validation

- Errors shown in red below the field
- Required fields must have values
- Character count shown for text fields
- Invalid format prevented by input type

### 6.5 Conflict Detection

If another user modifies the template while you're editing:
1. Conflict dialog appears
2. Shows side-by-side comparison
3. Choose: **Keep My Changes**, **Use Server Version**, or **Discard & Reload**

---

## 7. Bulk Operations

### 7.1 Bulk Delete

1. Select rows to delete
2. Click **Bulk Actions** dropdown
3. Select **Delete Selected**
4. Confirm deletion
5. Progress dialog shows results

### 7.2 Bulk Status Change

1. Select rows to update
2. Click **Bulk Actions** dropdown
3. Select **Change Status**
4. Choose new status
5. Add reason (optional)
6. Progress dialog shows results

### 7.3 Progress Tracking

The bulk operations dialog shows:
- Progress bar with percentage
- Success/failure counts
- Error details for failed operations
- **Retry Failed** button for partial failures

---

## 8. Context Menu

### 8.1 Access Context Menu

**Right-click** on any row to open context menu.

### 8.2 Menu Actions

| Action | Description | Shortcut |
|--------|-------------|----------|
| **Preview** | Open read-only preview | — |
| **Edit Details** | Enter inline edit mode | Ctrl+E |
| **Manage Versions** | View version history | — |
| **Set as Default** | Mark as default template | — |
| **Clone Template** | Create copy | Ctrl+D |
| **Export** | Export single template | — |
| **Delete** | Delete template | Ctrl+Delete |

---

## 9. Export

### 9.1 Open Export Dialog

Click **Export** button in toolbar.

### 9.2 Choose Format

| Format | Extension | Best For |
|--------|-----------|----------|
| **CSV** | .csv | Data analysis, Excel import |
| **Excel** | .xlsx | Reporting, sharing |
| **PDF** | .pdf | Printing, archival |

### 9.3 Select Columns

1. Check/uncheck columns to export
2. Click **Select All** or **Deselect All**
3. Column count shown

### 9.4 Options

- **Include Headers**: Add column headers (recommended)
- **File Name**: Custom filename (optional)

### 9.5 Export

1. Click **Export** button
2. File downloads automatically
3. Success message appears
4. Dialog closes after 2 seconds

---

## 10. Column Customization

### 10.1 Open Column Manager

Click **Columns** button in toolbar.

### 10.2 Reorder Columns

1. Click and hold drag handle (⠿)
2. Drag to new position
3. Release to drop

### 10.3 Resize Columns

1. Click **−** or **+** buttons
2. Width changes in 20px increments
3. Current width shown in pixels

### 10.4 Toggle Visibility

1. Click **Eye** icon to hide
2. Click **Eye Off** icon to show
3. Hidden columns marked with strikethrough

### 10.5 Reset to Defaults

Click **Reset to Default** to restore original column settings.

### 10.6 Apply Changes

Click **Apply Changes** to save modifications.

---

## 11. Real-Time Updates

### 11.1 Connection Status

Connection indicator in top-right corner:
- 🟢 **Live** - Connected, receiving updates
- 🟡 **Connecting...** - Establishing connection
- 🔴 **Disconnected** - Connection lost

### 11.2 Automatic Updates

When another user modifies templates:
1. Toast notification appears
2. Grid updates automatically
3. No manual refresh needed

### 11.3 Reconnect

If disconnected:
1. Click **Reconnect** button
2. Connection re-established automatically
3. Updates resume

---

## 12. Mobile Card View

### 12.1 Switch to Card View

Click the **Card** icon in toolbar (mobile devices auto-switch).

### 12.2 Card Layout

```
┌─────────────────────────────────────────────┐
│ [☑] A320 Line Maintenance          [⋯]     │
│     TPL-001                                │
│                                            │
│ [● Active] [Line] [v3]                     │
│                                            │
│ Aircraft: A320        Tasks: 24            │
│ Est. Hours: 12h     Description...         │
│                                            │
│ Updated 2h ago      by John Doe            │
└─────────────────────────────────────────────┘
```

### 12.3 Card Actions

- **Tap card**: Preview template
- **Tap checkbox**: Select template
- **Tap ⋮**: Open actions menu

---

## 13. Troubleshooting

### 13.1 Common Issues

| Issue | Solution |
|-------|----------|
| Grid not loading | Click Refresh button |
| Can't edit cell | Check permissions; some fields may be read-only |
| Export fails | Try different format; check file size |
| Real-time disconnected | Click Reconnect; refresh page if needed |
| Filters not working | Clear filters and reapply |
| Sorting not working | Check if column is sortable |

### 13.2 Keyboard Issues

| Issue | Solution |
|-------|----------|
| Shortcuts not working | Click on grid first to focus |
| Tab not moving | Check if dialog is open |
| Selection not working | Use Space key, not Enter |

### 13.2 Getting Help

- **In-App**: Click **Help** icon (question mark)
- **Documentation**: See this user guide
- **Support**: Contact your system administrator
- **Training**: Ask your supervisor for training sessions

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **Template** | Reusable maintenance configuration with tasks, materials, and compliance requirements |
| **Work Package** | Instance of a template applied to specific aircraft |
| **Maintenance Type** | Category of maintenance (Line, Base, Component, etc.) |
| **Version** | Iteration of a template; tracks changes over time |
| **Status** | Current state of template (Active, Draft, Deprecated, etc.) |
| **Inline Edit** | Editing directly in the grid without opening a dialog |
| **Bulk Operation** | Action applied to multiple selected templates |
| **Real-Time Updates** | Automatic grid updates when data changes |
| **Filter Preset** | Saved filter combination for quick reuse |

---

**Document Version:** 1.0.0  
**Last Updated:** April 14, 2026  
**Next Review:** July 14, 2026  

---

**END OF USER GUIDE**
