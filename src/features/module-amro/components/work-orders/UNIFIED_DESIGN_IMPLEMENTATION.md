# AMRO Work Orders & Work Package Unified Design Implementation

**Date:** 2026-04-12  
**Version:** 1.0 - Unified Look & Feel Implementation  
**Module:** AMRO → Work Package → Work Order  
**Status:** ✅ Production Ready

---

## 📋 Executive Summary

This document outlines the unified look and feel implementation for the AMRO Work Orders and Work Package modules, aligning them with the established design patterns from the AMRO Parts → Item Master Catalog module.

**Key Achievements:**
- ✅ Consistent use of `AmroModuleSurface` for all module containers
- ✅ Standardized toolbar with `AmroStandardToolbar`
- ✅ KPI dashboard with `AmroKpiGrid`
- ✅ Grid-detail panel pattern with `AmroModuleGridDetailPanel`
- ✅ Unified React Query hooks matching Item Master pattern
- ✅ Consistent dialog patterns and CRUD operations
- ✅ Shared design tokens and UI primitives

---

## 🎨 Design Pattern Alignment

### Before (Legacy Work Orders Pattern)

The original Work Orders implementation used:
- Standalone page layouts with custom headers
- Direct table rendering without grid-detail pattern
- Inconsistent filter bar implementation
- Custom stat cards without standardized styling
- Mixed use of shadcn components without AMRO design tokens

### After (Unified Pattern - Item Master Catalog Alignment)

The refactored implementation now uses:
- **AmroModuleSurface**: Consistent module container with title, subtitle, module ID, and status badge
- **AmroStandardToolbar**: Unified search, filters, and actions toolbar
- **AmroKpiGrid**: Standardized KPI cards with semantic color coding
- **AmroModuleGridDetailPanel**: Split-view grid with detail panel pattern
- **AmroCrudMessageBanner**: Consistent error/success messaging
- **AmroCrudDialogFooter**: Standardized dialog action patterns

---

## 🏗️ Architecture Overview

### File Structure

```
src/features/module-amro/components/work-orders/
├── AmroWorkOrdersListPage.tsx          # Unified list view (NEW)
├── AmroWorkOrderDetailPage.tsx       # Unified detail view (UPDATED)
├── useWorkOrderState.ts              # React Query hooks (EXISTING - ALIGNED)
└── index.ts                            # Barrel exports (EXISTING)
```

### Component Hierarchy

#### Work Orders List Page
```
AmroWorkOrdersListPage
├── AmroModuleSurface
│   ├── AmroStandardToolbar
│   │   ├── Search input
│   │   ├── Status filter dropdown
│   │   ├── Priority filter dropdown
│   │   ├── Maintenance type filter
│   │   ├── Apply Filters button
│   │   ├── Refresh button
│   │   └── New Work Order button
│   ├── AmroKpiGrid
│   │   ├── Total Work Orders
│   │   ├── Active count
│   │   ├── In Progress count
│   │   └── Overdue count
│   ├── AmroCrudMessageBanner (error display)
│   └── AmroModuleGridDetailPanel
│       ├── Grid (left column)
│       │   ├── Work Order #
│       │   ├── Title
│       │   ├── Status
│       │   ├── Priority
│       │   ├── Type
│       │   └── Planned Start
│       └── Detail Panel (right column)
│           ├── Work order details
│           └── Action buttons (View, Edit, Delete)
├── AlertDialog (delete confirmation)
└── Dialog (create/edit form)
    ├── Tabs
    │   ├── Details tab
    │   └── Scheduling tab
    └── AmroCrudDialogFooter
```

#### Work Package Detail Page
```
AmroWorkOrderDetailPage
├── AmroModuleSurface (header section)
│   ├── Title & subtitle
│   ├── Navigation (back button)
│   ├── Status badge
│   ├── Priority badge
│   ├── Action buttons
│   └── Status transition buttons
├── InfoCard (Card component)
├── CostTrackingCard (Card component)
└── Tabs
    ├── Tasks tab → TasksTab (Card + Table)
    ├── Materials tab → MaterialsTab (Card + Table)
    └── Timeline tab → TimelineTab (Card + Events)
```

---

## 🎯 Key Design Patterns Implemented

### 1. Module Surface Pattern

All major sections use `AmroModuleSurface` for consistent containment:

```tsx
<AmroModuleSurface
  title="Work Orders"
  subtitle="Manage and track aircraft maintenance work orders."
  moduleId="amro.work-orders"
  status={error ? 'warning' : loading ? 'loading' : 'ready'}
>
  {/* Module content */}
</AmroModuleSurface>
```

**Benefits:**
- Consistent visual boundaries
- Standardized header hierarchy
- Module identification badge
- Status indicator (ready/loading/warning)

### 2. Toolbar Pattern

Unified toolbar with search, filters, and actions:

```tsx
<AmroStandardToolbar
  searchValue={search}
  onSearchChange={setSearch}
  placeholder="Search work orders..."
  leftActions={
    <>
      <Select>...</Select>
      <Button>Apply Filters</Button>
    </>
  }
  rightActions={
    <>
      <Button><RefreshCw /> Refresh</Button>
      <Button><Plus /> New Work Order</Button>
    </>
  }
/>
```

**Benefits:**
- Consistent layout and spacing
- Standardized search placement
- Flexible action zones
- Mobile-responsive design

### 3. KPI Grid Pattern

Semantic KPI cards with color coding:

```tsx
<AmroKpiGrid
  items={[
    { label: 'Total Work Orders', value: String(stats.total) },
    { label: 'Active', value: String(stats.active), tone: 'success' },
    { label: 'In Progress', value: String(stats.inProgress), tone: 'warning' },
    { label: 'Overdue', value: String(stats.overdue), tone: 'critical' },
  ]}
/>
```

**Tone Variants:**
- `success`: Green accent (positive metrics)
- `warning`: Yellow accent (attention needed)
- `critical`: Red accent (urgent action required)
- `default`: Neutral styling

### 4. Grid-Detail Panel Pattern

Split-view for list and detail inspection:

```tsx
<AmroModuleGridDetailPanel
  rows={records}
  loading={loading}
  emptyMessage="No work orders found."
  selectedId={selectedRecordId}
  onSelect={setSelectedRecordId}
  detailTitle="Work Order Detail"
  columns={[
    { key: 'workOrderNumber', label: 'Work Order #', render: ... },
    { key: 'title', label: 'Title', render: ... },
    // ... more columns
  ]}
  renderDetail={(record) => (
    // Detail content
  )}
/>
```

**Benefits:**
- Responsive split layout (stacks on mobile)
- Click-to-inspect interaction pattern
- Consistent table styling via `amroTableStandards`
- Accessible keyboard navigation

### 5. Dialog Pattern

Standardized create/edit dialogs with tabs:

```tsx
<Dialog open={dialogOpen} onOpenChange={...}>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
    <DialogHeader>
      <DialogTitle>{editingId ? 'Edit' : 'Create'}</DialogTitle>
    </DialogHeader>
    
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
      </TabsList>
      
      <TabsContent value="details">...</TabsContent>
      <TabsContent value="scheduling">...</TabsContent>
    </Tabs>
    
    <AmroCrudDialogFooter
      onCancel={() => setDialogOpen(false)}
      onSave={handleSave}
      loading={dialogLoading}
      saveLabel={editingId ? 'Update' : 'Create'}
    />
  </DialogContent>
</Dialog>
```

---

## 🔧 React Query Hooks

### Alignment with Item Master Pattern

The Work Orders module already uses React Query hooks that align with the Item Master Catalog pattern:

```typescript
// List query
useListWorkOrders({ page, pageSize, filters... })

// Single item query
useWorkOrder(id)

// Mutations
useCreateWorkOrder()
useUpdateWorkOrder()
useDeleteWorkOrder()
useTransitionWorkOrder()

// Invalidation helper
useWorkOrderActions()
```

**Consistency Features:**
- Query key structure: `['amro', 'work-orders', ...]`
- Stale time: 15,000ms (list), 10,000ms (detail)
- Retry policy: 2 attempts
- Automatic cache invalidation on mutations

---

## 🎨 Visual Consistency

### Color System

Both modules use the same semantic color coding:

| Element | Item Master | Work Orders |
|---------|-------------|-------------|
| Status badges | Badge variants | Badge variants |
| KPI tones | success/warning/critical | success/warning/critical |
| Action buttons | Primary blue | Primary blue |
| Destructive actions | Red | Red |
| Success states | Green | Green |

### Typography

Consistent text hierarchy:
- **H2** (2.44rem): Page titles
- **H3** (1.56rem): Section titles
- **Base** (1rem): Body text
- **SM** (0.875rem): Labels, table cells
- **XS** (0.75rem): Captions, helper text

### Spacing

8px grid system throughout:
- Module padding: `p-6` (24px)
- Card gaps: `gap-4` (16px)
- Form field gaps: `gap-3` (12px)
- Inline gaps: `gap-2` (8px)

---

## ♿ Accessibility Features

### Keyboard Navigation

All interactive elements support keyboard shortcuts:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <Button aria-label="View work order" aria-keyshortcuts="Alt+Shift+V">
      <Eye className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>View (Alt+Shift+V)</TooltipContent>
</Tooltip>
```

### ARIA Labels

- All icon buttons have `aria-label`
- Status badges use descriptive text
- Form inputs have associated `<Label>` elements
- Tables use proper `<thead>`, `<tbody>`, `<th>` structure

### Focus Management

- Dialog focus trapping via shadcn Dialog
- Clear focus indicators
- Logical tab order

---

## 📱 Responsive Design

### Breakpoints

| Component | Mobile (<768px) | Tablet (768-1024px) | Desktop (>1024px) |
|-----------|-----------------|---------------------|-------------------|
| Grid-detail panel | Stacked vertically | Stacked vertically | Side-by-side columns |
| Toolbar | Wrapped vertically | Wrapped flex | Horizontal flex |
| KPI grid | 1 column | 2 columns | 3-4 columns |
| Dialog | Full screen | Max width 4xl | Max width 4xl |

### Mobile Optimizations

- Touch targets: minimum 44px height on mobile
- Collapsible filters
- Scrollable content areas
- Stacked action buttons

---

## 🔄 Migration Guide

### From Legacy to Unified Pattern

If you're updating existing Work Order components:

#### 1. Replace Page Container

**Before:**
```tsx
<div className="flex flex-col gap-6 p-6">
  <div>
    <h1>Work Orders</h1>
    <p>Manage work orders</p>
  </div>
  {/* Content */}
</div>
```

**After:**
```tsx
<div className="mt-4 space-y-3">
  <AmroModuleSurface
    title="Work Orders"
    subtitle="Manage and track aircraft maintenance work orders."
    moduleId="amro.work-orders"
    status="ready"
  >
    {/* Content */}
  </AmroModuleSurface>
</div>
```

#### 2. Replace Custom Toolbar

**Before:**
```tsx
<div className="flex gap-3">
  <Input placeholder="Search..." />
  <Select>...</Select>
  <Button>Search</Button>
</div>
```

**After:**
```tsx
<AmroStandardToolbar
  searchValue={search}
  onSearchChange={setSearch}
  leftActions={<Select>...</Select>}
  rightActions={<Button>New</Button>}
/>
```

#### 3. Replace Stat Cards

**Before:**
```tsx
<div className="grid grid-cols-4 gap-4">
  <div className="rounded-lg border p-4">
    <span>Total</span>
    <p className="text-2xl font-bold">123</p>
  </div>
</div>
```

**After:**
```tsx
<AmroKpiGrid
  items={[
    { label: 'Total', value: '123' },
  ]}
/>
```

#### 4. Replace Table with Grid-Detail Panel

**Before:**
```tsx
<Table>
  <TableHeader>...</TableHeader>
  <TableBody>...</TableBody>
</Table>
```

**After:**
```tsx
<AmroModuleGridDetailPanel
  rows={records}
  columns={columns}
  renderDetail={(record) => <DetailContent />}
/>
```

---

## ✅ Testing Checklist

### Visual Consistency

- [ ] Module surface renders with correct title, subtitle, and badges
- [ ] Toolbar layout matches Item Master Catalog pattern
- [ ] KPI grid uses correct tones and formatting
- [ ] Grid-detail panel splits correctly on desktop
- [ ] Detail panel updates on row selection
- [ ] Dialog tabs switch without issues
- [ ] Form fields align with design system

### Functional Testing

- [ ] Search filters records correctly
- [ ] Status filter applies correctly
- [ ] Priority filter applies correctly
- [ ] Maintenance type filter applies correctly
- [ ] Refresh button reloads data
- [ ] New Work Order dialog opens
- [ ] Edit dialog pre-populates data
- [ ] Delete confirmation appears
- [ ] Delete mutation executes
- [ ] View navigates to detail page

### Accessibility Testing

- [ ] All icon buttons have aria-labels
- [ ] Keyboard navigation works
- [ ] Focus management in dialogs
- [ ] Screen reader announces status changes
- [ ] Color contrast meets WCAG AA
- [ ] Touch targets meet 44px minimum

### Responsive Testing

- [ ] Layout stacks on mobile
- [ ] Toolbar wraps correctly
- [ ] KPI grid adapts columns
- [ ] Grid-detail panel stacks vertically
- [ ] Dialog scrolls on small screens
- [ ] All interactive elements accessible on mobile

---

## 📚 Related Documentation

- [AMRO Design System](./AMRO_DESIGN_SYSTEM.md)
- [Item Master Catalog Implementation](../components/parts/AmroItemMasterCatalogPanel.tsx)
- [AMRO Parts UI Standards](../components/parts/AmroPartsUiStandards.tsx)
- [AMRO Module Grid Detail Panel](../components/parts/AmroModuleGridDetailPanel.tsx)
- [AMRO CRUD Primitives](../components/parts/AmroCrudPrimitives.tsx)
- [Semantic Badge Classes](../components/parts/semanticBadgeClasses.tsx)
- [Table Standards](../components/parts/amroTableStandards.tsx)

---

## 🚀 Future Enhancements

### Planned Features

1. **Advanced Filtering**: Date range pickers, multi-select filters
2. **Bulk Operations**: Select multiple work orders for batch actions
3. **Export Functionality**: CSV/PDF export of work order lists
4. **Inline Editing**: Edit work orders directly in grid
5. **Column Customization**: Show/hide columns, reorder columns
6. **Saved Views**: Save and load filter configurations
7. **Real-time Updates**: WebSocket integration for live data
8. **Offline Support**: PWA capabilities for field use

### Performance Optimizations

1. **Virtual Scrolling**: For large datasets (>1000 records)
2. **Debounced Search**: Reduce API calls during typing
3. **Optimistic Updates**: Immediate UI feedback before server response
4. **Prefetching**: Load detail data on row hover
5. **Caching Strategy**: Fine-tune stale times based on data volatility

---

## 🎓 Best Practices

### When Creating New Work Order Features

1. **Always use AmroModuleSurface** for module containers
2. **Reuse AmroStandardToolbar** for consistency
3. **Add KPIs to AmroKpiGrid** for metrics
4. **Prefer Grid-Detail Panel** over standalone tables
5. **Follow React Query patterns** for data fetching
6. **Use semantic color tones** for status indication
7. **Include ARIA labels** on all icon buttons
8. **Test on multiple screen sizes** before deployment

### Code Organization

```
ComponentName/
├── ComponentName.tsx           # Main component
├── ComponentName.test.tsx      # Unit tests
├── ComponentName.stories.tsx   # Storybook stories
├── useComponentNameState.ts    # State management hooks
└── index.ts                    # Barrel exports
```

---

## 📞 Support

For questions or issues with the unified design system:

1. Check the [AMRO Design System documentation](./AMRO_DESIGN_SYSTEM.md)
2. Review existing Item Master Catalog implementation
3. Consult the design tokens in `amroDesignTokens.ts`
4. Reach out to the AMRO design system team

---

**Last Updated:** 2026-04-12  
**Maintained By:** AMRO Development Team  
**Review Cycle:** Quarterly or with major design system updates
