# AMRO Design System Template: UI/UX Consistency Blueprint

**Document ID:** AMRO-DESIGN-SYSTEM-001
**Version:** 1.0.0
**Date:** April 14, 2026
**Status:** Ready for Review & Enhancement Proposal
**Owner:** AMRO Engineering & UX Team
**Scope:** Standardizes UI/UX patterns across all AMRO modules based on `AMRO → Parts → Parts Inventory Records` and `Record Detail` implementations.

---

## Executive Summary

This template defines the **canonical design patterns** for AMRO modules, derived from the battle-tested **Parts Inventory Workbench** and **Record Detail** components. It ensures visual consistency, accessibility compliance, and a unified user experience across Work Packages, Templates, Inventory, Scheduling, and future modules.

**Core Philosophy:**
- **Modular Architecture**: Composable components (`AmroModuleSurface`, `AmroKpiGrid`, `AmroStandardToolbar`)
- **Data-Driven UI**: Configuration over code (`partsDetailSchema.ts`, column definitions)
- **Progressive Disclosure**: Core columns first, extended columns on demand
- **Role-Based Access**: Navigation and features adapt to user permissions
- **Mobile-First**: Touch-optimized (44px targets), responsive grids, adaptive navigation

---

## 1. Layout Architecture

### 1.1 Module Shell Structure

Every AMRO module should follow this hierarchical structure:

```
┌─────────────────────────────────────────────────────────────────┐
│ AMRO Navigation Shell (AmroPartsNavigationShell)               │
│ ├─ Breadcrumbs (AMRO → Module → Sub-Module)                    │
│ ├─ Quick Access Bar (Horizontal scrollable module tabs)        │
│ └─ Role Badge / Performance Metrics                            │
├─────────────────────────────────────────────────────────────────┤
│ Module Content Area                                            │
│ ├─ AmroModuleSurface (Card container)                          │
│ │  ├─ Header: Title, Subtitle, Module ID Badge, Status Badge   │
│ │  └─ Content                                                  │
│ │     ├─ AmroKpiGrid (Metrics row)                             │
│ │     ├─ AmroStandardToolbar (Search, Filters, Actions)        │
│ │     └─ Data Grid / List View                                 │
│ │        ├─ Columns (Configurable visibility)                  │
│ │        ├─ Grouping / Sorting / Filtering                     │
│ │        └─ Pagination / Virtualization                        │
│ └─ Record Detail Panel (AmroModuleGridDetailPanel)             │
│    ├─ Master-Detail Split (Desktop)                            │
│    └─ Stacked View (Mobile)                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Responsive Behavior

| Breakpoint | Layout Strategy |
|------------|-----------------|
| **Desktop (≥1024px)** | Side-by-side grid + detail panel; horizontal quick access bar |
| **Tablet (768px–1023px)** | Stacked grid above detail; scrollable quick access; collapsible panels |
| **Mobile (<768px)** | Full-width cards; bottom sheet navigation; single-column detail view |

---

## 2. Core Component Specifications

### 2.1 AmroModuleSurface

**Purpose**: Unified card container for module content with semantic heading hierarchy.

```tsx
<AmroModuleSurface
  title="Parts Inventory Operations"
  subtitle="Monitor stock levels, reservations, serviceability, and reorder pressure."
  moduleId="operations.inventory"
  status="ready" // 'ready' | 'loading' | 'warning'
>
  {children}
</AmroModuleSurface>
```

**Styling Standards**:
- Border: `border-slate-300`
- Shadow: `shadow-sm`
- Header Padding: `pb-3`
- Title: `text-base font-semibold`
- Subtitle: `text-xs text-muted-foreground`

### 2.2 AmroKpiGrid

**Purpose**: Standardized metric display with semantic urgency tones.

```tsx
<AmroKpiGrid
  items={[
    { label: 'Total Items', value: '1,234' },
    { label: 'Low Stock', value: '42', tone: 'warning' },
    { label: 'Inventory Value', value: '$1.2M' },
  ]}
/>
```

**Tone Variants**:
- `healthy` (default): Neutral metrics
- `success`: Positive indicators (e.g., "All systems operational")
- `warning`: Attention needed (e.g., "Low stock items")
- `critical`: Immediate action required (e.g., "AOG alerts")

**Layout**:
- Desktop: 3-column grid (`md:grid-cols-3`)
- Mobile: Single column stack

### 2.3 AmroStandardToolbar

**Purpose**: Consistent action bar for search, filters, and view controls.

```tsx
<AmroStandardToolbar
  searchValue={searchText}
  onSearchChange={setSearchText}
  placeholder="Search parts inventory..."
  leftActions={
    <Button variant="outline" size="sm">
      <Plus className="mr-1 h-3.5 w-3.5" /> Add Part
    </Button>
  }
  rightActions={
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Export</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  }
/>
```

**Standards**:
- Background: `bg-muted/20`
- Border: `rounded-md border`
- Touch Targets: `min-h-[44px]` on mobile, `h-8` on desktop
- Search Icon: Absolute positioned left-2.5, `text-muted-foreground`

### 2.4 Data Grid Template

**Purpose**: High-performance data display with virtualization and column management.

**Reference**: `AmroInventoryDataGridTemplate`

**Key Features**:
- **Virtualization**: Handles 10,000+ records with `@tanstack/react-virtual`
- **Column Management**:
  - `PARTS_CORE_VISIBLE_KEYS`: 10 essential columns (visible by default)
  - `PARTS_EXTENDED_KEYS`: Advanced columns (hidden by default, toggleable)
  - `PARTS_ALL_VISIBLE_KEYS`: Union of core + extended
- **Density Modes**: `compact` (38px), `normal` (46px), `comfortable` (56px)
- **View Modes**: `horizontal-split`, `vertical-split`, `stacked-auto`
- **Scroll Behavior**: `virtualization`, `pagination`, `infinite-scroll`

**Column Definition Schema**:

```typescript
type GridColumnDefinition<T> = {
  key: keyof T;
  header: string;
  sortable: boolean;
  filterable: boolean;
  groupable: boolean;
  resizable: boolean;
  dataType: 'text' | 'numeric' | 'date' | 'boolean' | 'object';
  width: number;
  render?: (row: T) => React.ReactNode;
};
```

### 2.5 Record Detail Panel

**Purpose**: Master-detail interaction pattern for inspecting and editing records.

**Reference**: `AmroModuleGridDetailPanel`, `AmroUnifiedGridRecordDetailShell`

**Desktop Layout**:
- Left: Grid/List (60% width)
- Right: Detail Panel (40% width)
- Splitter: Resizable divider

**Mobile Layout**:
- Stacked: Grid above, Detail below (or modal overlay)
- Full-width cards with expandable sections

**Detail Content Structure**:
1. **Header**: Record title, status badge, action buttons
2. **Tabs**: Overview, Details, Related Records, Audit Trail
3. **Sections**: Grouped fields with labels and values
4. **Footer**: Timestamps, user attribution

---

## 3. Design Tokens & Standards

### 3.1 Typography

| Element | Class | Size | Weight | Usage |
|---------|-------|------|--------|-------|
| Module Title | `text-base font-semibold` | 16px | 600 | `AmroModuleSurface` title |
| Subtitle | `text-xs text-muted-foreground` | 12px | 400 | Module description |
| KPI Label | `text-xs` | 12px | 400 | Metric labels |
| KPI Value | `font-semibold` | 14px | 600 | Metric values |
| Table Header | `text-xs font-semibold uppercase` | 12px | 600 | Column headers |
| Table Cell | `text-sm` | 14px | 400 | Data content |
| Badge | `text-xs uppercase` | 12px | 500 | Status indicators |

**Minimum Font Size**: `12px` (`text-xs`) for all user-facing text (Issue TY-01 compliance).

### 3.2 Color Palette

**Semantic Status Colors**:

| Status | Background | Text | Border | Usage |
|--------|------------|------|--------|-------|
| **Healthy** | `bg-green-50` | `text-green-700` | `border-green-200` | Normal operations |
| **Warning** | `bg-amber-50` | `text-amber-700` | `border-amber-200` | Attention needed |
| **Critical** | `bg-red-50` | `text-red-700` | `border-red-200` | Immediate action |
| **Info** | `bg-blue-50` | `text-blue-700` | `border-blue-200` | Informational |

**Component Colors**:
- Card Border: `border-slate-300`
- Input Border: `border-input` (default), `border-destructive` (error)
- Focus Ring: `ring-primary`
- Hover Background: `hover:bg-muted/50`

### 3.3 Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `p-1` | 4px | Tight grouping |
| `p-2` | 8px | Card content padding |
| `p-3` | 12px | Module surface padding |
| `p-4` | 16px | Page-level padding |
| `gap-2` | 8px | Component spacing |
| `gap-3` | 12px | Section spacing |
| `gap-4` | 16px | Major element separation |

### 3.4 Shadows & Elevation

| Level | Class | Usage |
|-------|-------|-------|
| **Base** | `shadow-sm` | Cards, module surfaces |
| **Hover** | `shadow-md` | Interactive elements on hover |
| **Overlay** | `shadow-lg` | Modals, dropdowns, sheets |
| **Focus** | `ring-2 ring-primary` | Keyboard focus indicators |

---

## 4. Interaction Patterns

### 4.1 Filtering Strategy

**Progressive Disclosure**:
1. **Level 1**: Quick filters (status, criticality, type)
2. **Level 2**: Advanced filters (supplier, location, date ranges)
3. **Level 3**: Custom queries (saved presets)

**Filter Component Standards**:
- Dropdowns: `Select` from shadcn/ui
- Multi-select: Badge-style toggles
- Date ranges: Calendar popover with from/to
- Number ranges: Min/Max inputs
- Clear All: Button to reset all filters

### 4.2 Column Management

**Visibility Tiers**:

| Tier | Columns | Visibility | Toggle |
|------|---------|------------|--------|
| **P0 (Core)** | Part Number, Description, Available, Status, Type, Location, Criticality, On Hand, Reserved, Forecast | Always visible | N/A |
| **P2-P3 (Extended)** | Serial, ABC Class, Expiry, ATA Chapter | Hidden by default | "Show Extended Columns" toggle |
| **All** | Union of Core + Extended | Available via toggle | Persisted in localStorage |

**Persistence**:
- Column visibility: `localStorage` key `amro-{module}-column-visibility:{persistKey}`
- Panel state: `localStorage` key `amro-{module}-panel-state:{persistKey}`

### 4.3 Bulk Operations

**Pattern**:
1. User selects rows via checkboxes
2. Bulk action bar appears at bottom or in toolbar
3. User selects action (Delete, Update Status, Export)
4. Confirmation dialog (if destructive)
5. Progress indicator with success/failure counts
6. Toast notification on completion

**Accessibility**:
- `aria-selected` on selected rows
- Live region announcements for selection count
- Keyboard shortcuts: `Ctrl+A` (select all), `Ctrl+Shift+A` (deselect all)

### 4.4 Inline Editing

**Trigger**:
- Double-click row OR click "Edit" button
- Row enters edit mode
- Fields transform to inputs/selects

**Validation**:
- Client-side validation on blur/change
- Inline error messages below fields
- Save/Cancel buttons appear in row footer
- Conflict detection: `If-Match` header with `updated_at` timestamp

**Keyboard Shortcuts**:
- `Enter`: Save changes
- `Escape`: Cancel editing
- `Tab`: Move to next field

### 4.5 Record Detail Interaction

**Master-Detail Split**:
- Click row → Detail panel updates
- Right arrow key → Next record
- Left arrow key → Previous record
- Escape → Close detail panel

**Mobile Adaptation**:
- Tap row → Modal or bottom sheet with detail
- Swipe left/right → Navigate records
- Pull down → Refresh data

---

## 5. Accessibility Standards

### 5.1 WCAG 2.1 AA Compliance

| Criterion | Implementation |
|-----------|----------------|
| **1.4.3 Contrast** | All text ≥ 4.5:1; large text ≥ 3:1 |
| **2.1.1 Keyboard** | All functionality operable via keyboard |
| **2.4.3 Focus Order** | Logical tab order matching visual layout |
| **2.4.7 Focus Visible** | 2px primary ring on focus |
| **3.3.1 Error Identification** | Inline error messages linked to inputs |
| **4.1.2 Name/Role/Value** | ARIA attributes on all interactive elements |

### 5.2 Screen Reader Support

**Live Regions**:
```tsx
<div aria-live="polite" aria-atomic="true">
  <AmroKpiGrid items={...} />
  <span className="sr-only">{metrics.totalItems} items loaded</span>
</div>
```

**Announcements**:
- Module navigation: "Now viewing {module} module"
- Selection changes: "{count} rows selected"
- Filter updates: "Filters applied: {filter summary}"
- Loading states: "Loading data..."
- Error states: "Failed to load data: {error message}"

### 5.3 Keyboard Navigation

**Global Shortcuts**:
| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+F` / `/` | Focus search | Anywhere |
| `Ctrl+N` | New record | Grid view |
| `Ctrl+R` | Refresh data | Anywhere |
| `Ctrl+E` | Export data | Anywhere |
| `Escape` | Close modals/dialogs | Overlay active |

**Grid Navigation**:
| Key | Action |
|-----|--------|
| `↑/↓` | Move between rows |
| `←/→` | Move between columns |
| `Enter` | Open detail / Edit cell |
| `Space` | Toggle row selection |
| `Home/End` | First/last row |
| `Page Up/Down` | Jump 10 rows |

---

## 6. Responsive Guidelines

### 6.1 Breakpoints

```css
/* Mobile First Approach */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
```

### 6.2 Component Adaptations

**KPI Grid**:
- Mobile: 1 column
- Tablet: 2 columns
- Desktop: 3 columns

**Toolbar**:
- Mobile: Stacked (search full-width, buttons below)
- Desktop: Inline (search left, buttons right)

**Quick Access Bar**:
- Mobile: Horizontal scroll with snap points
- Desktop: Visible tabs without scroll

**Detail Panel**:
- Mobile: Bottom sheet or full-screen modal
- Desktop: Side panel (40% width)

### 6.3 Touch Optimization

**Touch Targets**:
- Minimum size: `44px × 44px`
- Spacing between targets: `8px` minimum
- Button heights: `h-11` on mobile, `h-9` on desktop

**Gestures**:
- Swipe left/right: Navigate records (detail view)
- Pull down: Refresh data
- Long press: Context menu (mobile alternative to right-click)

---

## 7. Implementation Checklist

### 7.1 Module Setup

- [ ] Create module directory: `src/features/module-amro/components/{module}/`
- [ ] Define data contracts: `{module}Contracts.ts`
- [ ] Create schema/config: `{module}Schema.ts` (columns, fields, filters)
- [ ] Implement navigation config: `{module}NavigationConfig.ts`
- [ ] Set up Storybook stories for visual testing

### 7.2 Component Integration

- [ ] Wrap content in `AmroModuleSurface`
- [ ] Add `AmroKpiGrid` for key metrics
- [ ] Implement `AmroStandardToolbar` with search and filters
- [ ] Configure `AmroInventoryDataGridTemplate` with column definitions
- [ ] Add `AmroModuleGridDetailPanel` for record inspection
- [ ] Integrate `AmroPartsNavigationShell` (or module-specific shell)

### 7.3 Feature Implementation

- [ ] Filtering (status, type, criticality, etc.)
- [ ] Sorting (multi-column support)
- [ ] Column visibility (core vs. extended tiers)
- [ ] Bulk selection and actions
- [ ] Inline editing with validation
- [ ] Export functionality (CSV, Excel, PDF)
- [ ] Real-time updates (WebSocket/SSE)

### 7.4 Quality Assurance

- [ ] Keyboard navigation tested
- [ ] Screen reader compatibility verified
- [ ] Mobile responsiveness checked (iOS, Android)
- [ ] Performance profiling (Lighthouse, Web Vitals)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Accessibility audit (axe-core, manual testing)

---

## 8. Enhancement Proposal Template

Use this template to propose enhancements before implementation:

### Enhancement Request

**Module**: {Module Name}
**Component**: {Component to Enhance}
**Priority**: {P0 (Critical) | P1 (High) | P2 (Medium) | P3 (Low)}

**Current Behavior**:
{Describe current implementation and limitations}

**Proposed Enhancement**:
{Describe the proposed change with rationale}

**UI/UX Impact**:
- [ ] Visual design changes (attach mockups)
- [ ] Interaction pattern changes
- [ ] Accessibility impact
- [ ] Mobile responsiveness impact

**Technical Impact**:
- [ ] New dependencies required
- [ ] API changes needed
- [ ] Breaking changes
- [ ] Performance implications

**Success Metrics**:
{How will we measure success? e.g., "Reduce task completion time by 30%"}

**Examples**:
1. **Add ABC Classification to Grid** → P2 → Extended column tier → No API changes
2. **Implement Predictive Reorder Alerts** → P1 → New KPI card + filter → API endpoint needed
3. **Mobile Swipe Gestures for Navigation** → P3 → Touch interaction enhancement → No API changes

---

## 9. Migration Guide for Existing Modules

### 9.1 Audit Current State

1. **Compare with Template**: Identify deviations from this design system
2. **Catalog Inconsistencies**: List non-standard components, patterns, or styles
3. **Assess Impact**: Determine effort to align with template

### 9.2 Incremental Alignment

**Phase 1: Low-Hanging Fruit**
- Update typography to match standards
- Apply semantic color tokens
- Standardize button sizes and spacing

**Phase 2: Component Replacement**
- Replace custom grids with `AmroInventoryDataGridTemplate`
- Implement `AmroModuleSurface` for consistent headers
- Add `AmroKpiGrid` for metrics

**Phase 3: Advanced Features**
- Implement column management (core/extended tiers)
- Add bulk operations and inline editing
- Integrate real-time updates

**Phase 4: Polish & Accessibility**
- Keyboard navigation audit
- Screen reader testing
- Mobile responsiveness optimization

### 9.3 Verification Checklist

- [ ] All modules use `AmroModuleSurface` for headers
- [ ] KPIs use `AmroKpiGrid` with semantic tones
- [ ] Toolbars use `AmroStandardToolbar` pattern
- [ ] Grids follow column visibility tiers
- [ ] Detail panels use master-detail split pattern
- [ ] Navigation shells are consistent across modules
- [ ] Accessibility criteria met (WCAG 2.1 AA)
- [ ] Mobile breakpoints functional

---

## 10. References & Resources

### 10.1 Source Code

- **Parts Inventory Workbench**: `src/features/module-amro/components/parts/AmroPartsInventoryWorkbench.tsx`
- **UI Standards**: `src/features/module-amro/components/parts/AmroPartsUiStandards.tsx`
- **Module Panels**: `src/features/module-amro/components/parts/AmroPartsModulePanels.tsx`
- **Detail Schema**: `src/features/module-amro/components/parts/partsDetailSchema.ts`
- **Navigation Shell**: `src/features/module-amro/components/parts/AmroPartsNavigationShell.tsx`

### 10.2 Design Guidelines

- **Nielsen Norman Group**: Table Design Guidelines (2024)
- **W3C**: WCAG 2.1 Accessibility Standards
- **shadcn/ui**: Component Library Documentation
- **Tailwind CSS**: Utility-First CSS Framework

### 10.3 Contact

- **UX Lead**: {Name/Email}
- **Engineering Lead**: {Name/Email}
- **Accessibility Champion**: {Name/Email}

---

**Document Status**: Ready for Review
**Next Steps**: 
1. Review by UX and Engineering teams
2. Propose enhancements using Section 8 template
3. Approve version 1.0
4. Begin module alignment (Section 9)

---

**END OF DESIGN SYSTEM TEMPLATE**
