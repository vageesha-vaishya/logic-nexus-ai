# AMRO Modules - Unified Design Pattern Quick Reference

## Side-by-Side Comparison: Item Master Catalog ↔ Work Orders

This guide shows how Work Orders now matches the Item Master Catalog design patterns.

---

## 1️⃣ Module Container Pattern

### ✅ Item Master Catalog (Reference)
```tsx
<AmroModuleSurface
  title="Item Master Catalog"
  subtitle="Canonical part definitions with cross-reference and UOM governance."
  moduleId="inventory-core.item-master"
  status={error ? 'warning' : loading ? 'loading' : 'ready'}
>
  {/* Content */}
</AmroModuleSurface>
```

### ✅ Work Orders (ALIGNED)
```tsx
<AmroModuleSurface
  title="Work Orders"
  subtitle="Manage and track aircraft maintenance work orders."
  moduleId="amro.work-orders"
  status={error ? 'warning' : loading ? 'loading' : 'ready'}
>
  {/* Content */}
</AmroModuleSurface>
```

**Match:** ✅ Perfect alignment

---

## 2️⃣ Toolbar Pattern

### ✅ Item Master Catalog (Reference)
```tsx
<AmroStandardToolbar
  searchValue={search}
  onSearchChange={setSearch}
  placeholder="Search part number or description"
  leftActions={
    <>
      <Select value={statusFilter}>...</Select>
      <Select value={typeFilter}>...</Select>
      <Button>Apply Filters</Button>
    </>
  }
  rightActions={
    <>
      <Button><RefreshCw /> Refresh</Button>
      <Button><Plus /> New Item</Button>
    </>
  }
/>
```

### ✅ Work Orders (ALIGNED)
```tsx
<AmroStandardToolbar
  searchValue={search}
  onSearchChange={setSearch}
  placeholder="Search work orders..."
  leftActions={
    <>
      <Select value={statusFilter}>...</Select>
      <Select value={priorityFilter}>...</Select>
      <Select value={maintenanceFilter}>...</Select>
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

**Match:** ✅ Perfect alignment (with work-order-specific filters)

---

## 3️⃣ KPI Dashboard Pattern

### ✅ Item Master Catalog (Reference)
```tsx
<AmroKpiGrid
  items={[
    { label: 'Total Records', value: String(records.length) },
    { label: 'Active', value: String(activeRecords), tone: activeRecords > 0 ? 'success' : 'default' },
    { label: 'Inactive', value: String(inactiveRecords), tone: inactiveRecords > 0 ? 'warning' : 'default' },
  ]}
/>
```

### ✅ Work Orders (ALIGNED)
```tsx
<AmroKpiGrid
  items={[
    { label: 'Total Work Orders', value: String(stats.total) },
    { label: 'Active', value: String(stats.active), tone: stats.active > 0 ? 'success' : 'default' },
    { label: 'In Progress', value: String(stats.inProgress), tone: stats.inProgress > 0 ? 'warning' : 'default' },
    { label: 'Overdue', value: String(stats.overdue), tone: stats.overdue > 0 ? 'critical' : 'default' },
  ]}
/>
```

**Match:** ✅ Perfect alignment (with work-order-specific KPIs)

---

## 4️⃣ Grid-Detail Panel Pattern

### ✅ Item Master Catalog (Reference)
```tsx
<AmroModuleGridDetailPanel
  rows={records}
  loading={loading}
  emptyMessage="No item master records found."
  selectedId={selectedRecordId}
  onSelect={setSelectedRecordId}
  detailTitle="Item Master Detail"
  columns={[
    { key: 'partNumber', label: 'Part Number', render: (record) => record.partNumber },
    { key: 'description', label: 'Description', render: (record) => record.description || '-' },
    { key: 'itemType', label: 'Type', render: (record) => record.itemType },
    { key: 'lifecycleStatus', label: 'Lifecycle', render: (record) => record.lifecycleStatus },
    { key: 'uom', label: 'UOM', render: (record) => record.unitOfMeasure },
  ]}
  renderDetail={(record) => (
    !record ? <p>Select an item to inspect details.</p> : (
      <div className="space-y-2 text-xs">
        <p><span className="font-semibold">Part Number:</span> {record.partNumber}</p>
        <p><span className="font-semibold">Description:</span> {record.description || '-'}</p>
        {/* More detail fields */}
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="Create" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create (Alt+Shift+C)</TooltipContent>
              </Tooltip>
              {/* More action buttons */}
            </TooltipProvider>
          </div>
        </div>
      </div>
    )
  )}
/>
```

### ✅ Work Orders (ALIGNED)
```tsx
<AmroModuleGridDetailPanel
  rows={records}
  loading={loading}
  emptyMessage="No work orders found."
  selectedId={selectedRecordId}
  onSelect={setSelectedRecordId}
  detailTitle="Work Order Detail"
  columns={[
    { key: 'workOrderNumber', label: 'Work Order #', render: (record) => record.work_package_number },
    { key: 'title', label: 'Title', render: (record) => record.title || '—' },
    { key: 'status', label: 'Status', render: (record) => <StatusBadge status={record.status} /> },
    { key: 'priority', label: 'Priority', render: (record) => <PriorityBadge priority={record.priority} /> },
    { key: 'maintenanceType', label: 'Type', render: (record) => MAINTENANCE_LABELS[record.maintenance_type] },
    { key: 'plannedStart', label: 'Planned Start', render: (record) => record.planned_start_date ? new Date(record.planned_start_date).toLocaleDateString() : '—' },
  ]}
  renderDetail={(record) => (
    !record ? <p>Select a work order to inspect details.</p> : (
      <div className="space-y-2 text-xs">
        <p><span className="font-semibold">Work Order #:</span> {record.work_package_number}</p>
        <p><span className="font-semibold">Title:</span> {record.title || '—'}</p>
        <p><span className="font-semibold">Aircraft:</span> {record.aircraft_registration || '—'}</p>
        <p><span className="font-semibold">Status:</span> {STATUS_CONFIG[record.status].label}</p>
        {/* More detail fields */}
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button aria-label="View" onClick={() => handleView(record.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Details</TooltipContent>
              </Tooltip>
              {/* More action buttons */}
            </TooltipProvider>
          </div>
        </div>
      </div>
    )
  )}
/>
```

**Match:** ✅ Perfect alignment

---

## 5️⃣ Create/Edit Dialog Pattern

### ✅ Item Master Catalog (Reference)
```tsx
<Dialog open={dialogOpen} onOpenChange={...}>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
    <DialogHeader>
      <DialogTitle>{editingId ? 'Edit Item Master' : 'Create Item Master'}</DialogTitle>
    </DialogHeader>

    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="core">Core</TabsTrigger>
        <TabsTrigger value="cross">Cross-References</TabsTrigger>
        <TabsTrigger value="uom">UOM Conversions</TabsTrigger>
      </TabsList>
      
      <TabsContent value="core" className="space-y-3 pt-3">
        {/* Form fields */}
      </TabsContent>
      
      <TabsContent value="cross" className="space-y-3 pt-3">
        {/* Cross-reference management */}
      </TabsContent>
      
      <TabsContent value="uom" className="space-y-3 pt-3">
        {/* UOM conversion management */}
      </TabsContent>
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

### ✅ Work Orders (ALIGNED)
```tsx
<Dialog open={dialogOpen} onOpenChange={...}>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
    <DialogHeader>
      <DialogTitle>{editingId ? 'Edit Work Order' : 'Create Work Order'}</DialogTitle>
    </DialogHeader>

    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
      </TabsList>
      
      <TabsContent value="details" className="space-y-3 pt-3">
        {/* Form fields: Title, Description, Type, Priority, Assigned To */}
      </TabsContent>
      
      <TabsContent value="scheduling" className="space-y-3 pt-3">
        {/* Form fields: Dates, Notes */}
      </TabsContent>
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

**Match:** ✅ Perfect alignment (with work-order-specific tabs)

---

## 6️⃣ Delete Confirmation Pattern

### ✅ Item Master Catalog (Reference)
```tsx
<AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Item Master?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete item {deleteCandidate?.part_number}.
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => deleteCandidate && handleDelete(deleteCandidate.id)}
        className="bg-destructive hover:bg-destructive/90"
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### ✅ Work Orders (ALIGNED)
```tsx
<AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
      <AlertDialogDescription>
        This will permanently delete work order {deleteCandidate?.work_package_number}.
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => deleteCandidate && handleDelete(deleteCandidate.id)}
        className="bg-destructive hover:bg-destructive/90"
      >
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Match:** ✅ Perfect alignment

---

## 7️⃣ Error Handling Pattern

### ✅ Item Master Catalog (Reference)
```tsx
<AmroCrudMessageBanner message={error} tone="error" />
```

### ✅ Work Orders (ALIGNED)
```tsx
<AmroCrudMessageBanner message={error} tone="error" />
```

**Match:** ✅ Perfect alignment

---

## 8️⃣ React Query Hook Pattern

### ✅ Item Master Catalog (Reference)
```typescript
// List query
const { data } = useListItemMaster({
  page: 1,
  pageSize: 50,
  search,
  status: statusFilter,
  itemType: typeFilter,
});

// Mutations
const createMutation = useCreateItemMaster();
const updateMutation = useUpdateItemMaster();
const deleteMutation = useDeleteItemMaster();

// Invalidation
const { invalidate } = useItemMasterActions();
```

### ✅ Work Orders (ALIGNED)
```typescript
// List query
const { data } = useListWorkPackages({
  page: 1,
  pageSize: 50,
  search,
  status: statusFilter,
  priority: priorityFilter,
  maintenanceType: maintenanceFilter,
});

// Mutations
const createMutation = useCreateWorkPackage();
const updateMutation = useUpdateWorkPackage();
const deleteMutation = useDeleteWorkPackage();

// Invalidation
const { invalidate } = useWorkPackageActions();
```

**Match:** ✅ Perfect alignment

---

## 📊 Pattern Alignment Scorecard

| Pattern | Item Master Catalog | Work Orders | Match Score |
|---------|---------------------|-------------|-------------|
| Module Container | AmroModuleSurface | AmroModuleSurface | ✅ 100% |
| Toolbar | AmroStandardToolbar | AmroStandardToolbar | ✅ 100% |
| KPI Dashboard | AmroKpiGrid | AmroKpiGrid | ✅ 100% |
| Grid-Detail Panel | AmroModuleGridDetailPanel | AmroModuleGridDetailPanel | ✅ 100% |
| Error Messages | AmroCrudMessageBanner | AmroCrudMessageBanner | ✅ 100% |
| Dialog Footer | AmroCrudDialogFooter | AmroCrudDialogFooter | ✅ 100% |
| Create/Edit Dialog | Tabbed Dialog | Tabbed Dialog | ✅ 100% |
| Delete Confirmation | AlertDialog | AlertDialog | ✅ 100% |
| React Query Hooks | useItemMaster* | useWorkPackage* | ✅ 100% |
| TypeScript Types | Strong typing | Strong typing | ✅ 100% |

**Overall Alignment Score: 100%** ✅

---

## 🎨 Visual Design Tokens

Both modules use the same design tokens:

### Colors
- **Primary**: Blue (`hsl(221.2 83.2% 53.3%)`)
- **Success**: Green (`hsl(142.1 76.2% 36.3%)`)
- **Warning**: Yellow (`hsl(47.9 95.8% 53.1%)`)
- **Critical**: Red (`hsl(0 84.2% 60.2%)`)
- **Muted**: Gray (`hsl(210 40% 96.1%)`)

### Typography
- **H2**: 2.44rem (39.04px) - Page titles
- **H3**: 1.56rem (24.96px) - Section titles
- **Base**: 1rem (16px) - Body text
- **SM**: 0.875rem (14px) - Labels, table cells
- **XS**: 0.75rem (12px) - Captions

### Spacing
- **Module padding**: 24px (p-6)
- **Card gaps**: 16px (gap-4)
- **Form gaps**: 12px (gap-3)
- **Inline gaps**: 8px (gap-2)

### Border Radius
- **Cards**: 8px (rounded-lg)
- **Buttons**: 6px (rounded-md)
- **Badges**: 9999px (rounded-full)

---

## 🎯 Key Takeaways

### ✅ What's Aligned
1. **Container Patterns**: Both use AmroModuleSurface
2. **Toolbar Patterns**: Identical search/filter/action layout
3. **KPI Presentation**: Same grid structure with semantic tones
4. **Grid-Detail Pattern**: Split-view with consistent interaction
5. **Dialog Patterns**: Tabbed interface with standard footer
6. **Confirmation Patterns**: Unified AlertDialog usage
7. **Error Handling**: Consistent banner messaging
8. **Data Fetching**: React Query with same structure
9. **Type Safety**: Full TypeScript integration
10. **Accessibility**: ARIA labels, keyboard navigation, focus management

### 🎨 Module-Specific Customizations
While maintaining unified patterns, each module has domain-specific elements:

**Item Master Catalog:**
- Part Number, Description, Item Type, Lifecycle
- Cross-References tab
- UOM Conversions tab
- Status: active/inactive/deprecated/retired

**Work Orders:**
- Work Order #, Title, Aircraft, Status, Priority
- Status filter, Priority filter, Maintenance Type filter
- Details tab, Scheduling tab
- Status: planning/approved/scheduled/in_progress/on_hold/completed/closed/cancelled

These customizations are **additive** and don't break the unified pattern.

---

## 📚 Reference Files

### Source Code
- Item Master: `src/features/module-amro/components/parts/AmroItemMasterCatalogPanel.tsx`
- Work Orders: `src/features/module-amro/components/work-orders/AmroWorkOrdersListPage.tsx`
- Work Package Detail: `src/features/module-amro/components/work-orders/AmroWorkPackageDetailPage.tsx`

### Shared Components
- UI Standards: `src/features/module-amro/components/parts/AmroPartsUiStandards.tsx`
- Grid-Detail Panel: `src/features/module-amro/components/parts/AmroModuleGridDetailPanel.tsx`
- CRUD Primitives: `src/features/module-amro/components/parts/AmroCrudPrimitives.tsx`
- Table Standards: `src/features/module-amro/components/parts/amroTableStandards.tsx`

### Documentation
- Design System: `src/features/module-amro/AMRO_DESIGN_SYSTEM.md`
- Implementation Guide: `src/features/module-amro/components/work-orders/UNIFIED_DESIGN_IMPLEMENTATION.md`
- This Reference: `AMRO_WORK_ORDERS_UNIFIED_IMPLEMENTATION.md`

---

**Last Updated:** 2026-04-12  
**Maintenance:** Update when design system components change  
**Review Cycle:** Quarterly
