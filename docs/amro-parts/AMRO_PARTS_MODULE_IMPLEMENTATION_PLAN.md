# AMRO Parts Module - Implementation Plan

**Plan Date:** April 10, 2026  
**Implementation Timeline:** 8 Weeks (April 14 - June 6, 2026)  
**Total Effort:** 117.5 development hours + 40 hours QA = 157.5 hours  
**Team Required:** 1 Senior Frontend Engineer + 1 QA Engineer (part-time)  
**Methodology:** Phased delivery with weekly milestones and demo checkpoints

---

## Implementation Strategy

### Phase-Based Approach

Rather than enhancing all 8 modules simultaneously, we'll follow a **foundation-first, then module-by-module** strategy:

```
Phase 1: Foundation (Week 1-2)
  └── Fix systemic issues affecting ALL modules (typography, accessibility, spacing)

Phase 2: Core Modules (Week 3-4)
  ├── Module 1: Overview (highest traffic, most complex)
  ├── Module 2: Item Master (CRUD reference implementation)
  └── Module 3: Stock Ledger (enterprise complexity)

Phase 3: Operations Modules (Week 5-6)
  ├── Module 4: Reservations
  ├── Module 5: Issue & Consume
  ├── Module 6: Restock
  └── Module 7: Locations

Phase 4: Insights & Polish (Week 7-8)
  ├── Module 8: Analytics
  ├── Cross-module navigation enhancements
  ├── Performance optimization
  └── Final QA & release
```

**Why this order?**
1. Foundation fixes benefit all modules immediately
2. Core modules have highest usage (80% of user traffic)
3. Operations modules share patterns - fix once, apply to all
4. Analytics depends on data from all other modules being correct

---

## Phase 1: Foundation Layer (Week 1-2)

**Goal:** Fix systemic issues that affect every module. These changes cascade upward.

### Sprint 1.1: Typography System Overhaul (6 hours)

**Files to Modify:**

| File | Changes | Lines Affected |
|------|---------|----------------|
| `AmroPartsInventoryWorkbench.tsx` | Replace 8 instances of `text-[10px]` and `text-[11px]` | ~15 lines |
| `AmroPartsNavigationShell.tsx` | Replace 4 instances of undersized text | ~8 lines |
| `AmroPartsUiStandards.tsx` | Update badge and label sizing | ~6 lines |
| `AmroItemMasterCatalogPanel.tsx` | Fix form helper text sizing | ~4 lines |
| `AmroStockLedgerPanel.tsx` | Fix table metadata sizing | ~6 lines |
| `AmroPartsModulePanels.tsx` | Fix panel header sizing | ~4 lines |

**Implementation Steps:**

```
Day 1 (3 hours):
  Step 1: Create typography scale utility
    → New file: src/features/module-amro/components/parts/typography.ts
    → Export typography object with semantic classes
    → Add to design-system/tokens.ts for global reuse
  
  Step 2: Run global search/replace
    → Find all text-[10px] → replace with text-xs
    → Find all text-[11px] → replace with text-xs
    → Verify no hardcoded px font sizes remain
  
  Step 3: Add line-height classes
    → Dense data displays: add leading-snug (1.25)
    → Body text: add leading-normal (1.5)
    → Headings: add leading-tight (1.25)

Day 2 (3 hours):
  Step 4: Create responsive typography scale
    → Add clamp() for heading sizes on mobile
    → Test on 375px, 768px, 1024px, 1280px viewports
    
  Step 5: Update style guide documentation
    → Update docs/amro-parts/AMRO_PARTS_STYLE_GUIDE.md
    → Add typography scale table
    
  Step 6: Visual regression testing
    → Run Storybook for all modified components
    → Screenshot comparison before/after
    → Document any layout shifts
```

**Deliverable:** All text ≥ 12px, consistent line heights, responsive scaling

---

### Sprint 1.2: Touch Target & Accessibility Foundation (8 hours)

**Files to Modify:**

| File | Changes | Lines Affected |
|------|---------|----------------|
| `AmroPartsInventoryWorkbench.tsx` | Add min-h-[44px] to buttons on mobile, aria-describedby to form errors | ~25 lines |
| `AmroPartsNavigationShell.tsx` | Fix focus management on module switch, expand mobile sheet | ~12 lines |
| `AmroItemMasterCatalogPanel.tsx` | Add aria-describedby, aria-invalid to all form fields | ~18 lines |
| `AmroStockLedgerPanel.tsx` | Add aria-describedby, aria-invalid to all form fields | ~22 lines |
| `AmroPartsUiStandards.tsx` | Update AmroKpiGrid with semantic variants | ~15 lines |

**Implementation Steps:**

```
Day 3 (4 hours):
  Step 1: Touch target audit and fix
    → Add responsive touch targets to all buttons:
      className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
    → Apply to: filter buttons, toolbar actions, icon buttons
    
  Step 2: Focus management implementation
    → AmroPartsNavigationShell.handleModuleChange():
      * Add focus() call to new content region after module switch
      * Add tabIndex="-1" and id to content region
      * Add visible focus outline (:focus-visible)
    
  Step 3: Mobile sheet expansion
    → Change SheetContent from h-[calc(100vh-96px)] to h-screen
    → Add proper scroll padding inside drawer

Day 4 (4 hours):
  Step 4: Form accessibility (Item Master)
    → For each form field in AmroItemMasterCatalogPanel:
      * Add id to <Input> element
      * Add htmlFor to <Label> element
      * Add aria-invalid={!!errors[fieldName]}
      * Add aria-describedby={errors[fieldName] ? `${fieldName}-error` : undefined}
      * Add id="${fieldName}-error" and role="alert" to error message
    
  Step 5: Form accessibility (Stock Ledger)
    → Repeat Step 4 pattern for all Stock Ledger forms
    → Period creation form
    → Approval decision form
    → Scan posting form
    
  Step 6: ARIA live regions
    → Add aria-live="polite" to KPI update regions
    → Add aria-live="assertive" to error banners
    → Add role="status" with sr-only text to loading states
    
  Step 7: Keyboard navigation verification
    → Test full keyboard workflow: Tab through filters, activate with Enter
    → Test Escape to close dialogs
    → Test arrow keys in data grid
```

**Deliverable:** WCAG 2.1 AA compliance score from 62 → 85/100

---

### Sprint 1.3: Spacing & Layout Standardization (6 hours)

**Files to Modify:**

| File | Changes | Lines Affected |
|------|---------|----------------|
| `AmroPartsInventoryWorkbench.tsx` | Standardize card spacing, fix filter grid breakpoints | ~20 lines |
| `AmroPartsNavigationShell.tsx` | Standardize navigation item spacing | ~10 lines |
| `AmroPartsUiStandards.tsx` | Add spacing tokens to module surface and toolbar | ~8 lines |
| All panel components | Apply consistent padding scale | ~15 lines total |

**Implementation Steps:**

```
Day 5 (3 hours):
  Step 1: Create spacing scale utility
    → New file: src/features/module-amro/components/parts/spacing.ts
    → Export semantic spacing classes:
      spacing.compact, spacing.standard, spacing.spacious
    
  Step 2: Card spacing standardization
    → Replace ad-hoc p-2, p-3, p-4 with consistent scale:
      * CardHeader: px-6 py-4 (standard)
      * CardContent: px-6 py-4 (standard)
      * Compact cards (KPIs): px-4 py-3
    
  Step 3: Filter grid breakpoint optimization
    → Change: grid-cols-1 md:grid-cols-2 xl:grid-cols-4
    → To: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
    → Test on 640px, 768px, 1024px, 1280px

Day 6 (3 hours):
  Step 4: Mobile table overflow fix
    → Wrap data grid in overflow-x-auto container
    → On mobile (< 768px), switch to card view:
      * Create AmroPartsCardView component
      * Each record renders as a card with key-value pairs
      * Show top 6 fields, "Show More" for rest
    
  Step 5: Column visibility management
    → Define mobileColumns vs desktopColumns in workbench
    → Mobile: 6 columns (Part Number, Description, Available, Status, Criticality, Actions)
    → Desktop: 10 columns (default visible)
    → Power users: "Show All Columns" toggle
    
  Step 6: Visual regression testing
    → Test all layouts on breakpoints: 375px, 640px, 768px, 1024px, 1280px, 1536px
    → Document responsive behavior in style guide
```

**Deliverable:** Responsive layouts with no horizontal overflow, consistent spacing

---

### Phase 1 Acceptance Criteria

- [ ] Zero instances of `text-[10px]` or `text-[11px]` in codebase
- [ ] All interactive elements ≥ 44×44px on mobile
- [ ] All form fields have aria-describedby linked error messages
- [ ] Module switch moves focus to content region
- [ ] No horizontal scroll on 375px viewport
- [ ] Data grid shows card view on mobile, table on desktop
- [ ] axe DevTools automated audit: 0 violations
- [ ] All changes tested on Chrome, Firefox, Safari, Edge

**Demo Checklist:**
- Navigate to Parts module on iPhone SE (375px)
- Complete full keyboard-only workflow (no mouse)
- Run axe DevTools extension - show 0 violations
- Switch between all 8 modules - show focus moves correctly
- Resize browser window through all breakpoints

---

## Phase 2: Core Module Enhancements (Week 3-4)

### Module 1: Overview (AmroPartsInventoryWorkbench) - 12 hours

**Current State:** 1476 lines, most complex component, full implementation with filters, KPIs, grid, detail panel, alerts

**Enhancement Plan:**

```
Day 7-8 (8 hours): Visual Hierarchy & KPI Redesign

  Step 1: Extract KPI cards into semantic component
    → New file: src/features/module-amro/components/parts/AmroKpiCard.tsx
    → Props: { label, value, icon, variant, trend, action }
    → Variants: default, success, warning, critical, destructive
    
    Code structure:
    ```tsx
    interface AmroKpiCardProps {
      label: string;
      value: string | number;
      icon?: React.ReactNode;
      variant?: 'default' | 'success' | 'warning' | 'critical';
      trend?: { value: number; label: string };
      action?: { label: string; onClick: () => void };
    }
    ```
    
    Replace current inline KPI rendering with:
    ```tsx
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <AmroKpiCard
        label="Total Parts"
        value={metrics.totalItems}
        icon={<Boxes className="h-5 w-5" />}
        variant="default"
        trend={{ value: 12, label: 'vs last month' }}
      />
      <AmroKpiCard
        label="Critical Shortage"
        value={metrics.criticalItems}
        icon={<AlertTriangle className="h-5 w-5" />}
        variant="critical"
        action={{ label: 'View All', onClick: showCriticalAlerts }}
      />
      {/* ... more KPIs */}
    </div>
    ```
    
    Effort: 3 hours
  
  Step 2: AOG Alert banner redesign
    → Move from inline badge to prominent banner
    → Create AmroAogAlertBanner component
    → Show: part number, location, days to stockout, severity
    → Add quick actions: Create PO, Transfer Stock, Dismiss
    
    Effort: 2 hours
  
  Step 3: Toolbar button hierarchy
    → Primary: "Add Part" (default variant)
    → Secondary: "Refresh" (ghost variant)
    → Tertiary: "Export" (ghost variant with icon only)
    → Quaternary: Filter toggles (outline, smaller)
    
    Effort: 1 hour
  
  Step 4: Heading hierarchy
    → Add h1 to workbench title
    → Add h2 to section titles (Filters, Inventory, Alerts)
    → Add h3 to panel titles
    
    Effort: 0.5 hour
  
  Step 5: Empty state implementation
    → Create AmroEmptyState component
    → Use for: no search results, no filters match, no records loaded
    → Include: icon, title, description, action button
    
    Effort: 1.5 hours

Day 9 (4 hours): Interaction & Performance

  Step 6: Filter debouncing
    → Create useDebounce hook
    → Apply to search text input (300ms delay)
    → Apply to location filter (200ms delay)
    
    Effort: 1.5 hours
  
  Step 7: Skeleton loading states
    → Create AmroTableSkeleton component
    → Show skeleton rows during data load
    → Show skeleton KPI cards during metric calculation
    
    Effort: 1.5 hours
  
  Step 8: Optimistic UI updates
    → Update handleDelete to remove from list immediately
    → Rollback on error with toast notification
    → Update handleEdit to show changes immediately
    
    Effort: 1 hour
```

**Testing Requirements:**

| Test Type | Coverage | Tool |
|-----------|----------|------|
| Unit tests | KPI card component, empty state, AOG banner | Vitest |
| Interaction tests | Filter application, search debouncing | @testing-library/react |
| Accessibility tests | Keyboard navigation, screen reader labels | axe-core |
| Visual regression | Before/after screenshots | Storybook + Chromatic |
| Performance tests | Filter response time < 200ms | React DevTools Profiler |

**Files Created:**
- `AmroKpiCard.tsx` (80 lines)
- `AmroAogAlertBanner.tsx` (120 lines)
- `AmroEmptyState.tsx` (60 lines)
- `AmroTableSkeleton.tsx` (50 lines)
- `useDebounce.ts` (30 lines)

**Files Modified:**
- `AmroPartsInventoryWorkbench.tsx` (~80 lines changed)
- `AmroPartsUiStandards.tsx` (~20 lines changed)

---

### Module 2: Item Master (AmroItemMasterCatalogPanel) - 8 hours

**Current State:** 537 lines, full CRUD, dialog-based editing, cross-references, UOM conversions

**Enhancement Plan:**

```
Day 10 (4 hours): Form UX & Accessibility

  Step 1: Form validation UX improvement
    → Add inline field-level validation (on blur)
    → Show validation summary at top of dialog
    → Highlight invalid fields with red border
    → Add helper text below each field
    
    Current pattern (no inline validation):
    ```tsx
    <Input value={formValue.partNumber} onChange={...} />
    ```
    
    New pattern:
    ```tsx
    <div className="space-y-1">
      <Label htmlFor="part-number">Part Number</Label>
      <Input 
        id="part-number"
        value={formValue.partNumber} 
        onChange={(e) => setField('partNumber', e.target.value)}
        onBlur={() => validateField('partNumber')}
        aria-invalid={!!errors.partNumber}
        aria-describedby={errors.partNumber ? 'part-number-error' : 'part-number-help'}
        className={errors.partNumber ? 'border-destructive' : ''}
      />
      <p id="part-number-help" className="text-xs text-muted-foreground">
        Unique identifier for this part (e.g., A421, B882)
      </p>
      {errors.partNumber && (
        <p id="part-number-error" className="text-xs text-destructive" role="alert">
          {errors.partNumber}
        </p>
      )}
    </div>
    ```
    
    Effort: 2 hours
  
  Step 2: Dialog layout optimization
    → Current dialog is max-w-4xl, 3 tabs, can be overwhelming
    → Add progress indicator (Step 1 of 3)
    → Add "Save Draft" button
    → Add validation status to tab labels (✓ Core, ⚠ Cross-References)
    
    Effort: 1 hour
  
  Step 3: Cross-reference and UOM form improvements
    → Add inline add/remove for cross-references (no dialog)
    → Add validation for duplicate cross-reference part numbers
    → Add UOM conversion calculator (auto-calculate inverse)
    
    Effort: 1 hour

Day 11 (4 hours): Table & Search Enhancement

  Step 4: Search improvements
    → Add debounced search (300ms)
    → Add search result count
    → Add "clear search" button
    → Highlight matching text in results
    
    Effort: 1.5 hours
  
  Step 5: Table column optimization
    → Default visible columns: Part Number, Description, Type, Lifecycle, Status
    → Hide by default: UOM, Currency, Metadata
    → Add column visibility toggle
    
    Effort: 1.5 hours
  
  Step 6: Storybook stories
    → Create AmroItemMasterCatalogPanel.stories.tsx
    → Scenarios: Empty, Populated (10 records), Loading, Error, Creating, Editing
    
    Effort: 1 hour
```

**Files Created:**
- `AmroItemMasterCatalogPanel.stories.tsx` (120 lines)
- `useFieldValidation.ts` (80 lines)

**Files Modified:**
- `AmroItemMasterCatalogPanel.tsx` (~60 lines changed)

---

### Module 3: Stock Ledger (AmroStockLedgerPanel) - 10 hours

**Current State:** 1037 lines, most feature-rich panel, periods, approvals, reconciliation, batch operations, scan posting, cycle counting

**Enhancement Plan:**

```
Day 12-13 (8 hours): Complexity Management

  Step 1: Operations tab redesign
    → Current: 5 operations crammed into tabs (periods, approvals, automation, cycle_count, compliance)
    → Problem: Too many tabs, each tab is dense
    → Solution: Convert to sidebar + content layout
    
    New layout:
    ```
    ┌─────────────────────────────────────────────────┐
    │ Stock Ledger Operations                         │
    ├──────────────┬──────────────────────────────────┤
    │ Sidebar      │ Content Area                     │
    │              │                                  │
    │ ● Periods    │ Period management form           │
    │ ○ Approvals  │ Approval queue with actions      │
    │ ○ Automation │ Scheduled exports, templates     │
    │ ○ Cycle Count│ Discrepancy posting              │
    │ ○ Compliance │ Audit evidence, dashboard        │
    │              │                                  │
    └──────────────┴──────────────────────────────────┘
    ```
    
    Effort: 3 hours
  
  Step 2: Period management workflow
    → Add period status badges (Open, Closed, Locked)
    → Add visual timeline of periods progression
    → Add confirmation dialog for period close with checklist:
      * "All transactions reconciled?"
      * "All approvals processed?"
      * "Variance reviewed and accepted?"
    
    Effort: 2 hours
  
  Step 3: Batch operation UX
    → Current: JSON textarea for batch entries (developer-focused)
    → Problem: Error-prone, no validation, no preview
    → Solution: Visual batch entry builder
    
    New interface:
    ```
    ┌─────────────────────────────────────────┐
    │ Batch Entry Builder                     │
    ├─────────────────────────────────────────┤
    │ Entry 1: [Part ▼] [Movement ▼] [Qty]   │
    │          B882    receipt    [+15]       │
    │ Entry 2: [Part ▼] [Movement ▼] [Qty]   │
    │          C104    issue      [-5]        │
    │ [+ Add Entry]                           │
    │                                         │
    │ Preview:                                │
    │ • B882: +15 units @ $12.50 = $187.50   │
    │ • C104: -5 units @ $8.25 = -$41.25     │
    │                                         │
    │ [Validate] [Submit Batch]               │
    └─────────────────────────────────────────┘
    ```
    
    Effort: 3 hours

Day 14 (2 hours): Performance & Testing

  Step 4: Reconciliation feedback
    → Show progress bar during reconciliation
    → Display results summary with variance items
    → Add "Export Variance Report" button
    
    Effort: 1 hour
  
  Step 5: Storybook stories
    → Create AmroStockLedgerPanel.stories.tsx
    → Scenarios: Period Management, Approval Queue, Batch Entry, Reconciliation
    
    Effort: 1 hour
```

**Files Created:**
- `AmroStockLedgerPanel.stories.tsx` (150 lines)
- `AmroBatchEntryBuilder.tsx` (200 lines)
- `AmroOperationsSidebar.tsx` (120 lines)

**Files Modified:**
- `AmroStockLedgerPanel.tsx` (~100 lines changed)

---

### Phase 2 Acceptance Criteria

- [ ] Overview module: KPI cards show semantic variants, AOG alerts prominent
- [ ] Item Master: All form fields have inline validation, helper text
- [ ] Stock Ledger: Batch entry has visual builder (no raw JSON)
- [ ] All 3 modules have Storybook stories
- [ ] All empty states use AmroEmptyState component
- [ ] Search debouncing working on all modules
- [ ] Skeleton loading states on all data loads
- [ ] Unit test coverage ≥ 80% for new components

**Demo Checklist:**
- Show Overview KPI cards with color-coded variants
- Create new Item Master record with validation errors visible
- Build batch stock movement with visual builder
- Show skeleton loading during data fetch
- Run all Storybook stories

---

## Phase 3: Operations Module Enhancements (Week 5-6)

### Strategy: Pattern-Based Enhancement

All 5 operations modules (Reservations, Issue & Consume, Restock, Locations, Analytics) share the same architecture:
- Single file: `AmroPartsModulePanels.tsx` (242 lines)
- Props: `{ records: PartInventoryRecord[] }`
- Pattern: AmroModuleSurface → AmroKpiGrid → AmroModuleGridDetailPanel
- No API layers, no tests, no dedicated stories

**Enhancement Approach:**
1. Extract each panel into its own file
2. Add API layer stubs (with mock data fallback)
3. Enhance with module-specific features
4. Add tests and stories

---

### Module 4: Reservations Panel - 6 hours

**Current State:** 40 lines in shared panels file, basic filtered view

**Enhancement Plan:**

```
Day 15 (3 hours): Extraction & API Layer

  Step 1: Extract to dedicated file
    → New file: src/features/module-amro/components/parts/AmroReservationsPanel.tsx
    → Move from AmroPartsModulePanels.tsx
    → Update imports in AmroOwnedWorkspace.tsx
    
    Effort: 0.5 hour
  
  Step 2: Create API layer stub
    → New file: src/features/module-amro/components/parts/reservationsApi.ts
    → Define types: Reservation, ReservationQuery, ReservationMutation
    → Implement mock functions using PartInventoryRecord[].quantity_reserved
    → Add TODO comments for real API implementation
    
    Types:
    ```typescript
    interface Reservation {
      id: string;
      partInventoryId: string;
      partNumber: string;
      quantity: number;
      reservedBy: string;
      reservedAt: string;
      workOrderId?: string;
      workOrderId?: string;
      status: 'active' | 'fulfilled' | 'cancelled' | 'expired';
      expiresAt?: string;
      notes?: string;
    }
    
    interface ReservationQuery {
      page: number;
      pageSize: number;
      status?: 'active' | 'fulfilled' | 'cancelled' | 'expired';
      workOrderId?: string;
    }
    ```
    
    Effort: 1.5 hours
  
  Step 3: Create mock data generator
    → Add to mockPartsInventoryData.ts or new reservationsMockData.ts
    → Generate 30-50 realistic reservation records
    → Link to existing part numbers from inventory
    
    Effort: 1 hour

Day 16 (3 hours): UX Enhancements

  Step 4: Reservation workflow enhancement
    → Add "Create Reservation" dialog
    → Part selector with availability display
    → Quantity input with max validation
    → Work order linkage (optional)
    → Expiration date picker
    
    Effort: 1.5 hours
  
  Step 5: Reservation status management
    → Add Fulfill, Cancel, Extend actions
    → Add status badges with colors
    → Add expiration warning banners
    
    Effort: 1 hour
  
  Step 6: Tests and stories
    → Create AmroReservationsPanel.test.tsx
    → Create AmroReservationsPanel.stories.tsx
    
    Effort: 0.5 hour
```

**Files Created:**
- `AmroReservationsPanel.tsx` (180 lines)
- `reservationsApi.ts` (120 lines)
- `AmroReservationsPanel.test.tsx` (80 lines)
- `AmroReservationsPanel.stories.tsx` (80 lines)

---

### Module 5: Issue & Consume Panel - 6 hours

**Current State:** 40 lines in shared panels file, basic movement log

**Enhancement Plan:**

```
Day 17 (3 hours): Extraction & Transaction Interface

  Step 1: Extract to dedicated file
    → New file: src/features/module-amro/components/parts/AmroIssueConsumePanel.tsx
    
    Effort: 0.5 hour
  
  Step 2: Create API layer stub
    → New file: src/features/module-amro/components/parts/issueConsumeApi.ts
    → Types: IssueTransaction, ConsumeTransaction
    → Mock functions using PartInventoryRecord[]
    
    Effort: 1.5 hours
  
  Step 3: Issue/Consume transaction dialog
    → Two modes: Issue (assign to work order) or Consume (permanent removal)
    → Part selector with current availability
    → Quantity input
    → Work order / task linkage
    → Technician signature capture (text input for now)
    → Notes field
    
    Effort: 1 hour

Day 18 (3 hours): History & Reporting

  Step 4: Transaction history table
    → Show recent issue/consume transactions
    → Filter by date range, part, technician
    → Add export to CSV
    
    Effort: 1.5 hours
  
  Step 5: Tests and stories
    → Create test and story files
    
    Effort: 0.5 hour
  
  Step 6: Bulk issue/consume
    → Add multi-select in grid
    → Bulk action: "Issue Selected" or "Consume Selected"
    → Confirmation dialog with summary
    
    Effort: 1 hour
```

**Files Created:**
- `AmroIssueConsumePanel.tsx` (220 lines)
- `issueConsumeApi.ts` (130 lines)
- `AmroIssueConsumePanel.test.tsx` (90 lines)
- `AmroIssueConsumePanel.stories.tsx` (90 lines)

---

### Module 6: Restock Panel - 6 hours

**Current State:** 40 lines in shared panels file, basic low-stock view

**Enhancement Plan:**

```
Day 19 (3 hours): Extraction & Reorder Intelligence

  Step 1: Extract to dedicated file
    → New file: src/features/module-amro/components/parts/AmroRestockPanel.tsx
    
    Effort: 0.5 hour
  
  Step 2: Create API layer stub
    → New file: src/features/module-amro/components/parts/restockApi.ts
    → Types: RestockRecommendation, PurchaseOrder, SupplierQuote
    → Mock reorder calculations from PartInventoryRecord[]
    
    Types:
    ```typescript
    interface RestockRecommendation {
      partInventoryId: string;
      partNumber: string;
      currentStock: number;
      reorderPoint: number;
      recommendedQty: number;
      estimatedCost: number;
      supplier: string;
      leadTimeDays: number;
      urgency: 'critical' | 'high' | 'medium' | 'low';
      daysUntilStockout: number;
    }
    ```
    
    Effort: 1.5 hours
  
  Step 3: Reorder recommendation engine (client-side)
    → Calculate: days until stockout = available / avg_daily_demand
    → Compare to lead time: if days_until_stockout < lead_time → critical
    → Generate recommended order quantity
    → Estimate cost from unit_cost
    
    Effort: 1 hour

Day 20 (3 hours): Purchase Order Workflow

  Step 4: Purchase order creation
    → "Create PO" dialog
    → Pre-fill from restock recommendation
    → Supplier selection
    → Quantity adjustment
    → Expected delivery date
    → Generate PO number
    
    Effort: 1.5 hours
  
  Step 5: Restock dashboard
    → KPI: Parts needing reorder, Critical restocks, Total restock value
    → Grouped by urgency
    → Quick actions: Create PO for All Critical
    
    Effort: 1 hour
  
  Step 6: Tests and stories
    
    Effort: 0.5 hour
```

**Files Created:**
- `AmroRestockPanel.tsx` (240 lines)
- `restockApi.ts` (160 lines)
- `AmroRestockPanel.test.tsx` (100 lines)
- `AmroRestockPanel.stories.tsx` (100 lines)

---

### Module 7: Locations Panel - 6 hours

**Current State:** 40 lines in shared panels file, basic location listing

**Enhancement Plan:**

```
Day 21 (3 hours): Extraction & Warehouse Visualization

  Step 1: Extract to dedicated file
    → New file: src/features/module-amro/components/parts/AmroLocationsPanel.tsx
    
    Effort: 0.5 hour
  
  Step 2: Create API layer stub
    → New file: src/features/module-amro/components/parts/locationsApi.ts
    → Types: WarehouseLocation, BinLocation, StockDistribution
    → Mock location data
    
    Types:
    ```typescript
    interface WarehouseLocation {
      id: string;
      code: string; // WH-A, WH-B
      name: string;
      capacity: number;
      currentUtilization: number;
      partCount: number;
      riskScore: number;
      criticalPartCount: number;
    }
    
    interface BinLocation {
      id: string;
      warehouseId: string;
      code: string; // A3, B7
      capacity: number;
      currentStock: number;
      parts: Array<{ partNumber: string; quantity: number }>;
    }
    ```
    
    Effort: 1.5 hours
  
  Step 3: Warehouse capacity visualization
    → Horizontal bar chart showing capacity per warehouse
    → Color coding: green (<70%), amber (70-90%), red (>90%)
    → Click to expand and see bin-level detail
    
    Effort: 1 hour

Day 22 (3 hours): Heatmap & Transfer Workflow

  Step 4: Criticality heatmap
    → Grid view: warehouses × criticality levels
    → Show count of parts in each cell
    → Color intensity based on count
    
    Current implementation exists in workbench (locationCriticalityHeatmap)
    → Extract and enhance
    
    Effort: 1.5 hours
  
  Step 5: Stock transfer workflow
    → "Transfer Stock" dialog
    → Source location selector
    → Destination location selector
    → Part and quantity selection
    → Confirmation with current vs projected capacity
    
    Effort: 1 hour
  
  Step 6: Tests and stories
    
    Effort: 0.5 hour
```

**Files Created:**
- `AmroLocationsPanel.tsx` (200 lines)
- `locationsApi.ts` (140 lines)
- `AmroLocationsPanel.test.tsx` (80 lines)
- `AmroLocationsPanel.stories.tsx` (80 lines)

---

### Module 8: Analytics Panel - 6 hours

**Current State:** 40 lines in shared panels file, basic metrics display

**Enhancement Plan:**

```
Day 23 (3 hours): Extraction & Dashboard Creation

  Step 1: Extract to dedicated file
    → New file: src/features/module-amro/components/parts/AmroAnalyticsPanel.tsx
    
    Effort: 0.5 hour
  
  Step 2: Create API layer stub
    → New file: src/features/module-amro/components/parts/analyticsApi.ts
    → Types: AnalyticsDashboard, TrendData, AbcAnalysis
    → Mock analytics from PartInventoryRecord[]
    
    Effort: 1.5 hours
  
  Step 3: Analytics dashboard layout
    → 3-column layout on desktop:
      * Column 1: Inventory value trend (line chart)
      * Column 2: ABC analysis (pie chart)
      * Column 3: Stock status distribution (bar chart)
    → Already using Recharts - add new chart components
    
    Effort: 1 hour

Day 24 (3 hours): Advanced Analytics

  Step 4: ABC analysis implementation
    → Already computed in workbench (computeAbcClassification)
    → Extract to shared utility
    → Create Pareto chart (cumulative percentage)
    → Show A items (80% value), B items (15% value), C items (5% value)
    
    Effort: 1.5 hours
  
  Step 5: Dead stock analysis
    → Already computed in workbench (computeDeadStock)
    → Show dead stock by category
    → Calculate dead stock value
    → Recommend actions: Dispose, Return to Supplier, Transfer
    
    Effort: 1 hour
  
  Step 6: Tests and stories
    
    Effort: 0.5 hour
```

**Files Created:**
- `AmroAnalyticsPanel.tsx` (220 lines)
- `analyticsApi.ts` (140 lines)
- `AmroAnalyticsPanel.test.tsx` (90 lines)
- `AmroAnalyticsPanel.stories.tsx` (100 lines)
- `computePartsAnalytics.ts` (extracted from workbench, 120 lines)

---

### Phase 3 Acceptance Criteria

- [ ] All 5 operations modules extracted to dedicated files
- [ ] All 5 modules have API layer stubs with mock data
- [ ] All 5 modules have dedicated tests (≥ 70% coverage)
- [ ] All 5 modules have Storybook stories (≥ 3 scenarios each)
- [ ] Reservations: Create/Fulfill/Cancel workflow working
- [ ] Issue & Consume: Transaction history with export
- [ ] Restock: Reorder recommendations accurate
- [ ] Locations: Warehouse capacity visualization
- [ ] Analytics: ABC analysis and dead stock report

**Demo Checklist:**
- Create a reservation, fulfill it, verify stock updates
- Issue parts to a work order, see in transaction history
- View restock recommendations sorted by urgency
- See warehouse capacity heatmap with color coding
- View ABC analysis pie chart and dead stock report

---

## Phase 4: Navigation, Performance & Release (Week 7-8)

### Navigation Shell Enhancements - 6 hours

**Current State:** 250 lines, functional but basic

**Enhancement Plan:**

```
Day 25 (3 hours): Navigation Intelligence

  Step 1: Recent modules tracking
    → Store last 3 visited modules in localStorage
    → Show "Recent" section at top of navigation
    → Quick access with one click
    
    Implementation:
    ```typescript
    const [recentModules, setRecentModules] = useState<string[]>([]);
    
    useEffect(() => {
      const stored = localStorage.getItem('amro-parts-recent-modules');
      if (stored) setRecentModules(JSON.parse(stored));
    }, []);
    
    const recordModuleVisit = (moduleId: string) => {
      setRecentModules(prev => {
        const updated = [moduleId, ...prev.filter(id => id !== moduleId)].slice(0, 3);
        localStorage.setItem('amro-parts-recent-modules', JSON.stringify(updated));
        return updated;
      });
    };
    ```
    
    Effort: 1.5 hours
  
  Step 2: Module notification badges
    → Show count of items requiring attention
    → Reservations: expiring reservations count
    → Restock: critical restock items count
    → Issue & Consume: pending issues count
    
    Calculate from PartInventoryRecord[]:
    ```tsx
    <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1.5 text-[10px]">
      {criticalRestockCount}
    </Badge>
    ```
    
    Effort: 1.5 hours

Day 26 (3 hours): Search & Command Palette

  Step 3: Module search
    → Add search input at top of navigation
    → Filter modules by label, description, group
    → Highlight matching text
    
    Effort: 1.5 hours
  
  Step 4: Keyboard shortcut expansion
    → Current: Module shortcuts (1-8)
    → Add: 
      * Cmd+K: Open module search
      * Cmd+/: Show all keyboard shortcuts
      * Cmd+R: Refresh current module
    → Show shortcuts in navigation footer
    
    Effort: 1.5 hours
```

**Files Created:**
- `useRecentModules.ts` (50 lines)
- `AmroModuleSearch.tsx` (80 lines)

**Files Modified:**
- `AmroPartsNavigationShell.tsx` (~40 lines changed)
- `partsNavigationConfig.ts` (~10 lines added)

---

### Performance Optimization - 6 hours

```
Day 27 (3 hours): React Performance

  Step 1: Memoization audit
    → Wrap all computed values in useMemo
    → Wrap all callback functions in useCallback
    → Use React DevTools Profiler to identify re-renders
    
    Key optimizations:
    ```tsx
    const filteredRecords = useMemo(() => {
      // expensive filter logic
    }, [records, allFilterDependencies]);
    
    const handleModuleChange = useCallback((moduleId) => {
      // module change logic
    }, [onModuleChange]);
    ```
    
    Effort: 1.5 hours
  
  Step 2: Virtualization verification
    → Confirm @tanstack/react-virtual is working
    → Test with 1000+ records
    → Verify frame rate > 55fps during scroll
    
    Effort: 1.5 hours

Day 28 (3 hours): Bundle Size & Load Time

  Step 3: Code splitting
    → Lazy load module panels:
      ```tsx
      const ReservationsPanel = lazy(() => import('./AmroReservationsPanel'));
      const IssueConsumePanel = lazy(() => import('./AmroIssueConsumePanel'));
      // ... etc
      ```
    → Load overview and item master eagerly (most used)
    → Load others on first visit
    
    Effort: 1.5 hours
  
  Step 4: Image/icon optimization
    → Verify all icons from lucide-react are tree-shaken
    → Remove any unused icon imports
    → Check bundle with `npm run build -- --stats`
    
    Effort: 1.5 hours
```

---

### Final QA & Release - 8 hours

```
Day 29-30 (8 hours): Comprehensive Testing

  Step 1: Automated accessibility audit
    → Run axe-core on all 8 modules
    → Document and fix all violations
    → Target: 0 critical, 0 serious violations
    
    Effort: 2 hours
  
  Step 2: Cross-browser testing
    → Test on Chrome 120+, Firefox 121+, Safari 17+, Edge 120+
    → Test on Mobile Safari (iOS 17+), Mobile Chrome (Android 12+)
    → Document any visual differences
    
    Browser test matrix:
    | Feature | Chrome | Firefox | Safari | Edge | Mobile Safari | Mobile Chrome |
    |---------|--------|---------|--------|------|---------------|---------------|
    | Grid layout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
    | Touch targets | ✅ | ✅ | N/A | ✅ | ✅ | ✅ |
    | Focus states | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
    | Keyboard nav | ✅ | ✅ | ✅ | ✅ | N/A | N/A |
    | Dialogs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
    
    Effort: 2 hours
  
  Step 3: Responsive testing
    → Test on viewports: 375px, 640px, 768px, 1024px, 1280px, 1536px
    → Test on devices: iPhone SE, iPhone 14, iPad Air, MacBook Air, 27" monitor
    → Document breakpoints and behavior at each size
    
    Effort: 1.5 hours
  
  Step 4: Performance benchmarking
    → Measure:
      * Initial page load: < 2s
      * Module switch: < 100ms
      * Filter application: < 200ms
      * Data grid render (100 rows): < 50ms
      * Export generation: < 3s
    → Use Lighthouse for metrics
    
    Effort: 1.5 hours
  
  Step 5: User acceptance testing
    → Prepare test scenarios document
    → Run with 3-5 users from different roles
    → Collect SUS (System Usability Scale) scores
    → Document feedback for future iterations
    
    Effort: 1 hour
```

---

## Implementation File Map

### New Files to Create (31 files, ~3,200 lines total)

| Phase | File | Lines | Priority |
|-------|------|-------|----------|
| 1 | `typography.ts` | 40 | CRITICAL |
| 1 | `spacing.ts` | 30 | CRITICAL |
| 1 | `useDebounce.ts` | 30 | HIGH |
| 1 | `AmroKpiCard.tsx` | 80 | HIGH |
| 1 | `AmroAogAlertBanner.tsx` | 120 | HIGH |
| 1 | `AmroEmptyState.tsx` | 60 | HIGH |
| 1 | `AmroTableSkeleton.tsx` | 50 | MEDIUM |
| 1 | `AmroErrorBoundary.tsx` | 70 | HIGH |
| 2 | `useFieldValidation.ts` | 80 | HIGH |
| 2 | `AmroBatchEntryBuilder.tsx` | 200 | HIGH |
| 2 | `AmroOperationsSidebar.tsx` | 120 | MEDIUM |
| 2 | `AmroItemMasterCatalogPanel.stories.tsx` | 120 | MEDIUM |
| 2 | `AmroStockLedgerPanel.stories.tsx` | 150 | MEDIUM |
| 3 | `AmroReservationsPanel.tsx` | 180 | HIGH |
| 3 | `reservationsApi.ts` | 120 | HIGH |
| 3 | `AmroReservationsPanel.test.tsx` | 80 | HIGH |
| 3 | `AmroReservationsPanel.stories.tsx` | 80 | MEDIUM |
| 3 | `AmroIssueConsumePanel.tsx` | 220 | HIGH |
| 3 | `issueConsumeApi.ts` | 130 | HIGH |
| 3 | `AmroIssueConsumePanel.test.tsx` | 90 | HIGH |
| 3 | `AmroIssueConsumePanel.stories.tsx` | 90 | MEDIUM |
| 3 | `AmroRestockPanel.tsx` | 240 | HIGH |
| 3 | `restockApi.ts` | 160 | HIGH |
| 3 | `AmroRestockPanel.test.tsx` | 100 | HIGH |
| 3 | `AmroRestockPanel.stories.tsx` | 100 | MEDIUM |
| 3 | `AmroLocationsPanel.tsx` | 200 | HIGH |
| 3 | `locationsApi.ts` | 140 | HIGH |
| 3 | `AmroLocationsPanel.test.tsx` | 80 | HIGH |
| 3 | `AmroLocationsPanel.stories.tsx` | 80 | MEDIUM |
| 3 | `AmroAnalyticsPanel.tsx` | 220 | HIGH |
| 3 | `analyticsApi.ts` | 140 | HIGH |
| 3 | `AmroAnalyticsPanel.test.tsx` | 90 | HIGH |
| 3 | `AmroAnalyticsPanel.stories.tsx` | 100 | MEDIUM |
| 3 | `computePartsAnalytics.ts` | 120 | MEDIUM |
| 4 | `useRecentModules.ts` | 50 | LOW |
| 4 | `AmroModuleSearch.tsx` | 80 | LOW |

### Files to Modify (14 files, ~550 lines changed)

| Phase | File | Current Lines | Changes | Risk |
|-------|------|---------------|---------|------|
| 1 | `AmroPartsInventoryWorkbench.tsx` | 1476 | ~80 lines | MEDIUM |
| 1 | `AmroPartsNavigationShell.tsx` | 250 | ~50 lines | LOW |
| 1 | `AmroPartsUiStandards.tsx` | 108 | ~30 lines | LOW |
| 1 | `AmroItemMasterCatalogPanel.tsx` | 537 | ~60 lines | MEDIUM |
| 1 | `AmroStockLedgerPanel.tsx` | 1037 | ~100 lines | MEDIUM |
| 1 | `AmroPartsModulePanels.tsx` | 242 | **-242 lines (removed)** | LOW |
| 2 | `AmroPartsInventoryWorkbench.tsx` | 1476 | ~80 lines (more) | MEDIUM |
| 2 | `AmroItemMasterCatalogPanel.tsx` | 537 | ~60 lines (more) | MEDIUM |
| 2 | `AmroStockLedgerPanel.tsx` | 1037 | ~100 lines (more) | HIGH |
| 4 | `AmroPartsNavigationShell.tsx` | 250 | ~40 lines | LOW |
| 4 | `partsNavigationConfig.ts` | 93 | ~10 lines | LOW |
| 4 | `AmroOwnedWorkspace.tsx` | ~500 | ~30 lines | MEDIUM |
| 4 | Various (performance) | - | ~20 lines | LOW |
| 4 | `AMRO_PARTS_STYLE_GUIDE.md` | - | Update | NONE |

---

## Risk Assessment & Mitigation

### High-Risk Items

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Stock Ledger batch builder breaks existing functionality | Medium | High | Feature flag: `VITE_AMRO_BATCH_BUILDER`, keep old JSON mode as fallback |
| Touch target changes break desktop layout density | Low | Medium | Use responsive classes: `min-h-[44px] md:min-h-0` |
| Extracting panels from shared file breaks navigation | Low | High | Test each extraction individually before proceeding |
| Code splitting increases complexity of error boundaries | Medium | Medium | Wrap lazy imports in ErrorBoundary with fallback UI |
| Performance optimizations regress bundle size | Low | Medium | Monitor with CI bundle size check, set 5% growth budget |

### Rollback Plan

```
If Phase 1 changes cause issues:
  → Git revert typography and spacing commits
  → Keep accessibility fixes (aria-describedby, focus management)
  → Revert mobile responsive changes if they break desktop

If Phase 2 module enhancements cause issues:
  → Each module enhanced independently - can rollback individually
  → Use feature flags for major new features (batch builder, form validation)

If Phase 3 panel extractions cause issues:
  → Keep original AmroPartsModulePanels.tsx in git history
  → Can restore if extraction breaks navigation wiring

If Phase 4 performance changes cause issues:
  → Remove code splitting first (most likely culprit)
  → Keep navigation enhancements (low risk)
```

---

## Definition of Done

### Per-Module DoD

Each module enhancement is "done" when:

- [ ] Code written and self-reviewed (author review)
- [ ] Peer review completed (≥ 1 approving review)
- [ ] All new components have unit tests (≥ 70% coverage)
- [ ] All new components have Storybook stories (≥ 3 scenarios)
- [ ] Accessibility audit passed (axe-core: 0 critical violations)
- [ ] Tested on Chrome, Firefox, Safari
- [ ] Tested on mobile (≤ 768px viewport)
- [ ] Keyboard navigation verified
- [ ] No TypeScript errors or warnings
- [ ] No ESLint violations
- [ ] Performance benchmarks met (filter < 200ms, render < 50ms)
- [ ] Style guide documentation updated
- [ ] CHANGELOG.md entry added

### Phase DoD

Each phase is "done" when:

- [ ] All modules in phase meet individual DoD
- [ ] Integration testing passed (all modules work together)
- [ ] Demo completed and stakeholder sign-off received
- [ ] No P0 or P1 bugs open
- [ ] Deployment run successful (staging environment)

### Project DoD

The entire enhancement project is "done" when:

- [ ] All 4 phases complete
- [ ] All 8 modules meet individual DoD
- [ ] Comprehensive QA audit completed
- [ ] Performance benchmarks meet targets
- [ ] Accessibility score ≥ 85/100
- [ ] User acceptance testing completed (SUS ≥ 80)
- [ ] Production deployment successful
- [ ] Post-deployment monitoring shows no regressions (7-day observation)

---

## Communication Plan

### Weekly Cadence

| Day | Activity | Audience |
|-----|----------|----------|
| Monday | Sprint planning - review goals for the week | Engineering team |
| Wednesday | Mid-week check-in - blockers, progress | Engineering team |
| Friday | Demo - show completed work, gather feedback | Stakeholders, UX team |

### Status Reporting

**Format:** Weekly status update message

```
## AMRO Parts Enhancement - Week X Status

📊 Progress: X% complete (Y of Z tasks done)
🐛 Bugs: X open (X critical, X high, X medium, X low)
⚠️ Blockers: [none / description]
📅 On track for [date] release: [yes / no - explain]

Completed this week:
- [Task 1]
- [Task 2]

Next week:
- [Task 3]
- [Task 4]

Decisions needed:
- [Decision 1 with options]
```

### Stakeholder Demos

| Phase | Demo Date | Audience | What to Show |
|-------|-----------|----------|--------------|
| 1 | Week 2, Friday | Engineering + UX | Accessibility improvements, mobile layouts |
| 2 | Week 4, Friday | Engineering + Product | Enhanced Overview KPIs, Item Master forms, Stock Ledger batch builder |
| 3 | Week 6, Friday | Engineering + End Users | All 5 operations modules, CRUD workflows |
| 4 | Week 8, Friday | All stakeholders | Full module tour, performance metrics, final release |

---

## Post-Launch Monitoring

### Week 1 Post-Launch (Observation Period)

| Metric | Monitoring Method | Alert Threshold |
|--------|-------------------|-----------------|
| Error rate | Sentry dashboard | > 1% of sessions |
| Performance | Lighthouse CI | LCP > 2.5s |
| Accessibility | axe-core in CI | Any critical violation |
| User feedback | Support ticket volume | > 20% increase |
| Module usage | Analytics event tracking | > 30% drop in any module |

### Rollback Triggers

Automated rollback if:
- Error rate exceeds 5% for 10+ minutes
- Lighthouse performance score drops below 70
- Any P0 bug reported by users

Manual rollback considered if:
- User satisfaction drops below 60 (from baseline 68)
- Critical accessibility regression reported
- Data integrity issue in any module

---

## Success Metrics (Post-Implementation Targets)

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|---------------------|
| Accessibility Score | 62/100 | ≥ 85/100 | axe-core + manual audit |
| Task Completion Rate | 82% | ≥ 90% | User testing sessions |
| Average Task Time | 32s | ≤ 24s | Session recordings |
| Error Rate | 11% | ≤ 6% | Support tickets + user testing |
| SUS Score | 68/100 | ≥ 80/100 | Post-launch survey |
| Mobile Adoption | 23% | ≥ 40% | Analytics |
| Support Tickets/Month | 34 | ≤ 20 | Help desk system |
| Storybook Coverage | 4 modules | 8 modules | Story count |
| Test Coverage | 45% | ≥ 75% | Vitest coverage report |

---

## Appendix A: Detailed Week-by-Week Task Breakdown

### Week 1: April 14-18, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | Apr 14 | Typography scale utility, global search/replace | 3 | Frontend |
| Tue | Apr 15 | Line-height additions, responsive typography | 3 | Frontend |
| Wed | Apr 16 | Touch target fixes, focus management | 4 | Frontend |
| Thu | Apr 17 | Form accessibility (Item Master + Stock Ledger) | 4 | Frontend |
| Fri | Apr 18 | **Demo Phase 1.1**, Spacing standardization start | 3 | Frontend |

**Week 1 Total:** 17 hours  
**Week 1 Deliverable:** Typography ≥ 12px everywhere, focus management working

---

### Week 2: April 21-25, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | Apr 21 | Spacing standardization completion | 3 | Frontend |
| Tue | Apr 22 | Mobile table overflow fix, column visibility | 3 | Frontend |
| Wed | Apr 23 | ARIA live regions, keyboard verification | 3 | Frontend |
| Thu | Apr 24 | Visual regression testing, bug fixes | 4 | Frontend |
| Fri | Apr 25 | **Demo Phase 1**, Accessibility audit verification | 4 | Frontend + QA |

**Week 2 Total:** 17 hours  
**Week 2 Deliverable:** Phase 1 complete, WCAG score ≥ 85/100

---

### Week 3: April 28 - May 2, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | Apr 28 | AmroKpiCard component, semantic variants | 3 | Frontend |
| Tue | Apr 29 | AOG Alert banner, toolbar hierarchy | 3 | Frontend |
| Wed | Apr 30 | Heading hierarchy, empty state component | 2 | Frontend |
| Thu | May 1 | Filter debouncing, skeleton loading | 3 | Frontend |
| Fri | May 2 | Optimistic UI updates, **Demo Week 3** | 3 | Frontend |

**Week 3 Total:** 14 hours  
**Week 3 Deliverable:** Overview module enhancements complete

---

### Week 4: May 5-9, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | May 5 | Item Master form validation, dialog optimization | 4 | Frontend |
| Tue | May 6 | Item Master search, column optimization | 3 | Frontend |
| Wed | May 7 | Stock Ledger operations sidebar, period management | 4 | Frontend |
| Thu | May 8 | Stock Ledger batch entry builder | 3 | Frontend |
| Fri | May 9 | Storybook stories (Item Master + Stock Ledger), **Demo Phase 2** | 3 | Frontend + QA |

**Week 4 Total:** 17 hours  
**Week 4 Deliverable:** Phase 2 complete, all 3 core modules enhanced

---

### Week 5: May 12-16, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | May 12 | Extract Reservations panel, API stub | 3 | Frontend |
| Tue | May 13 | Reservations workflow, status management | 3 | Frontend |
| Wed | May 14 | Extract Issue & Consume panel, API stub | 3 | Frontend |
| Thu | May 15 | Issue & Consume transaction history | 3 | Frontend |
| Fri | May 16 | Tests + stories (Reservations + Issue/Consume), **Demo Week 5** | 3 | Frontend + QA |

**Week 5 Total:** 15 hours  
**Week 5 Deliverable:** Reservations and Issue & Consume modules complete

---

### Week 6: May 19-23, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | May 19 | Extract Restock panel, reorder engine | 3 | Frontend |
| Tue | May 20 | Restock PO workflow, dashboard | 3 | Frontend |
| Wed | May 21 | Extract Locations panel, warehouse visualization | 3 | Frontend |
| Thu | May 22 | Locations heatmap, transfer workflow | 3 | Frontend |
| Fri | May 23 | Extract Analytics panel, ABC analysis, **Demo Phase 3** | 4 | Frontend + QA |

**Week 6 Total:** 16 hours  
**Week 6 Deliverable:** Phase 3 complete, all 8 modules enhanced

---

### Week 7: May 26-30, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | May 26 | Navigation: recent modules, notification badges | 3 | Frontend |
| Tue | May 27 | Navigation: module search, keyboard shortcuts | 3 | Frontend |
| Wed | May 28 | React performance: memoization, virtualization | 3 | Frontend |
| Thu | May 29 | Code splitting, bundle optimization | 3 | Frontend |
| Fri | May 30 | Automated accessibility audit, **Demo Week 7** | 3 | Frontend + QA |

**Week 7 Total:** 15 hours  
**Week 7 Deliverable:** Navigation enhancements, performance optimized

---

### Week 8: June 2-6, 2026

| Day | Date | Tasks | Hours | Owner |
|-----|------|-------|-------|-------|
| Mon | Jun 2 | Cross-browser testing (all modules) | 2 | QA |
| Tue | Jun 3 | Responsive testing (all breakpoints) | 1.5 | QA |
| Wed | Jun 4 | Performance benchmarking | 1.5 | QA |
| Thu | Jun 5 | Bug fixes from QA findings | 4 | Frontend |
| Fri | Jun 6 | **Final Demo**, Release to staging, Post-launch plan | 4 | All |

**Week 8 Total:** 13 hours  
**Week 8 Deliverable:** Phase 4 complete, production release ready

---

## Appendix B: Git Branching Strategy

```
main
  └── feature/amro-parts-ux-enhancement (8-week branch)
        ├── feature/amro-parts-typography-accessibility (Week 1-2)
        ├── feature/amro-parts-overview-enhancement (Week 3)
        ├── feature/amro-parts-item-master-enhancement (Week 4)
        ├── feature/amro-parts-stock-ledger-enhancement (Week 4)
        ├── feature/amro-parts-reservations-panel (Week 5)
        ├── feature/amro-parts-issue-consume-panel (Week 5)
        ├── feature/amro-parts-restock-panel (Week 6)
        ├── feature/amro-parts-locations-panel (Week 6)
        ├── feature/amro-parts-analytics-panel (Week 6)
        └── feature/amro-parts-navigation-performance (Week 7-8)
```

**Merge Strategy:**
- Each sub-feature branch reviewed and merged into `feature/amro-parts-ux-enhancement`
- Weekly merge from `main` to stay current
- Final PR from `feature/amro-parts-ux-enhancement` to `main` at end of Week 8
- Squash merge for clean history

**Commit Message Convention:**
```
feat(amro-parts): enhance Overview KPI cards with semantic variants
fix(amro-parts): increase touch targets to 44px minimum on mobile
refactor(amro-parts): extract Reservations panel to dedicated file
test(amro-parts): add AmroReservationsPanel unit tests
docs(amro-parts): update style guide with typography scale
perf(amro-parts): debounce filter inputs to reduce re-renders
```

---

**Document Version:** 1.0  
**Author:** AI Implementation Planner  
**Approved By:** Pending Engineering Manager Review  
**Next Review:** Weekly (every Friday during implementation)  
**Target Release Date:** June 6, 2026

---

*This implementation plan provides day-by-day task breakdowns for all 8 AMRO Parts modules across an 8-week timeline. Each enhancement is scoped to be achievable within the allocated time with clear acceptance criteria and demo checkpoints.*
