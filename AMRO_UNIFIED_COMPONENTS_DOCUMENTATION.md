# AMRO Unified Layout Components - Documentation

**Date:** 2026-04-12  
**Status:** ✅ Phase 1 Complete - Ready for Use

---

## Overview

The AMRO Unified Layout Components provide a consistent, enterprise-grade layout model across all AMRO modules. These components are designed to be **additive** - they don't modify any existing functionality but provide new building blocks for future development and gradual migration.

---

## Components

### 1. AmroUnifiedPageLayout

**Purpose:** Standard page container for all AMRO modules.

**File:** `src/features/module-amro/components/unified/AmroUnifiedPageLayout.tsx`

**Features:**
- Wraps `FirstScreenTemplate` for consistent breadcrumbs and header
- Card-based content area
- Optional KPI metrics row
- Header actions support
- Consistent spacing and padding

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | ✅ | Page title |
| `breadcrumbs` | `BreadcrumbItem[]` | ✅ | Breadcrumb navigation |
| `description` | `string` | ❌ | Page subtitle |
| `children` | `ReactNode` | ✅ | Page content |
| `headerActions` | `ReactNode` | ❌ | Actions in header (e.g., New button) |
| `viewMode` | `'list' \| 'grid'` | ❌ | View mode (default: 'list') |
| `kpiMetrics` | `Array<{label, value, icon}>` | ❌ | KPI metrics to display |

**Usage Example:**

```tsx
import { AmroUnifiedPageLayout } from '@/features/module-amro/components/unified';
import { Plus, RefreshCw } from 'lucide-react';

function AircraftPage() {
  return (
    <AmroUnifiedPageLayout
      title="Aircraft"
      description="Manage aircraft fleet records"
      breadcrumbs={[
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'AMRO', to: '/dashboard/amro' },
        { label: 'Aircraft' },
      ]}
      headerActions={
        <>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1" />
            New Aircraft
          </Button>
        </>
      }
      kpiMetrics={[
        { label: 'Total Aircraft', value: totalCount, icon: <Plane /> },
        { label: 'Active', value: activeCount, icon: <CheckCircle /> },
        { label: 'In Maintenance', value: maintenanceCount, icon: <Wrench /> },
      ]}
    >
      {/* Table or grid content */}
      <AmroUnifiedTable ... />
    </AmroUnifiedPageLayout>
  );
}
```

---

### 2. AmroUnifiedTable

**Purpose:** Standardized table with search, filters, sorting, pagination, and actions.

**File:** `src/features/module-amro/components/unified/AmroUnifiedTable.tsx`

**Features:**
- Search input with icon
- Filter dropdowns
- Sortable columns
- Row selection (checkboxes)
- Actions dropdown per row
- Pagination with page size selector
- Empty state with messaging
- Loading state
- Responsive column visibility

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `columns` | `Column<T>[]` | ✅ | Column definitions |
| `data` | `T[]` | ✅ | Table data |
| `loading` | `boolean` | ❌ | Loading state |
| `search` | `SearchConfig` | ❌ | Search configuration |
| `filters` | `TableFilter[]` | ❌ | Filter configurations |
| `pagination` | `PaginationConfig` | ❌ | Pagination configuration |
| `actions` | `(row: T) => ActionItem[]` | ❌ | Actions factory |
| `onRowClick` | `(row: T) => void` | ❌ | Row click handler |
| `selectable` | `boolean` | ❌ | Enable row selection |
| `emptyMessage` | `string` | ❌ | Empty state message |
| `emptyDescription` | `string` | ❌ | Empty state description |

**Column Definition:**

```typescript
interface Column<T> {
  key: string;              // Unique column key
  label: string;            // Column header
  sortable?: boolean;       // Enable sorting
  width?: string;           // Tailwind width class
  render?: (row: T) => ReactNode;  // Custom cell renderer
  hideOnMobile?: boolean;   // Hide on mobile
}
```

**Usage Example:**

```tsx
import { AmroUnifiedTable } from '@/features/module-amro/components/unified';
import { AmroActions } from '@/features/module-amro/components/unified/AmroUnifiedActions';

function AircraftTable() {
  const columns: Column<Aircraft>[] = [
    { key: 'registration', label: 'Registration', sortable: true },
    { key: 'model', label: 'Model', sortable: true },
    { 
      key: 'status', 
      label: 'Status', 
      sortable: true,
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
          {row.status}
        </Badge>
      ),
    },
    { key: 'lastMaintenance', label: 'Last Maintenance', sortable: true },
  ];

  return (
    <AmroUnifiedTable
      columns={columns}
      data={aircraftData}
      loading={loading}
      search={{
        value: searchValue,
        onChange: setSearchValue,
        placeholder: 'Search aircraft...',
      }}
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'In Maintenance', value: 'maintenance' },
            { label: 'Retired', value: 'retired' },
          ],
          value: statusFilter,
          onChange: setStatusFilter,
        },
      ]}
      pagination={{
        page,
        pageSize,
        total: totalCount,
        onPageChange: setPage,
        onPageSizeChange: setPageSize,
        pageSizeOptions: [10, 20, 50, 100],
      }}
      actions={(row) => AmroActions.crud({
        onPreview: () => handlePreview(row),
        onEdit: () => handleEdit(row),
        onDelete: () => handleDelete(row),
      })}
      onRowClick={handleRowClick}
      selectable
      onRowSelect={handleRowSelect}
    />
  );
}
```

---

### 3. AmroUnifiedActions

**Purpose:** Standardized dropdown menu for row actions.

**File:** `src/features/module-amro/components/unified/AmroUnifiedActions.tsx`

**Features:**
- Consistent icon + label pattern
- Separator support for grouping
- Destructive action styling (red)
- Disabled state support
- Keyboard navigation
- Pre-defined action creators

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `actions` | `ActionItem[]` | ✅ | Action items |
| `triggerLabel` | `string` | ❌ | Accessibility label (default: 'Actions') |
| `menuWidth` | `string` | ❌ | Menu width (default: 'w-48') |

**ActionItem Interface:**

```typescript
interface ActionItem {
  label: string;          // Action label
  icon: LucideIcon;       // Action icon
  onClick: () => void;    // Click handler
  disabled?: boolean;     // Disabled state
  destructive?: boolean;  // Red styling
  separator?: boolean;    // Show separator before
  tooltip?: string;       // Tooltip text
}
```

**Usage Example:**

```tsx
import { AmroUnifiedActions, AmroActions } from '@/features/module-amro/components/unified';
import { Eye, Pencil, Trash2 } from 'lucide-react';

// Option 1: Manual actions
<AmroUnifiedActions
  actions={[
    { label: 'Preview', icon: Eye, onClick: () => handlePreview(row) },
    { label: 'Edit', icon: Pencil, onClick: () => handleEdit(row) },
    { separator: true },
    { label: 'Delete', icon: Trash2, onClick: () => handleDelete(row), destructive: true },
  ]}
/>

// Option 2: Pre-defined CRUD actions
<AmroUnifiedActions
  actions={AmroActions.crud({
    onPreview: () => handlePreview(row),
    onEdit: () => handleEdit(row),
    onDelete: () => handleDelete(row),
  })}
/>
```

---

### 4. AmroUnifiedForm

**Purpose:** Standardized data entry dialog with tabs, sections, and fields.

**File:** `src/features/module-amro/components/unified/AmroUnifiedForm.tsx`

**Features:**
- Dialog wrapper with header
- Tabs for organizing sections
- Sections for grouping fields
- Fields with labels, validation, and helper text
- 2-3 column responsive layout
- Loading state
- Customizable footer

**Components:**

| Component | Purpose |
|-----------|---------|
| `AmroUnifiedForm` | Main dialog wrapper |
| `AmroUnifiedForm.Section` | Group related fields |
| `AmroUnifiedForm.Field` | Individual field with label |
| `AmroUnifiedForm.Tabs` | Tab container |
| `AmroUnifiedForm.Tab` | Individual tab |

**Usage Example:**

```tsx
import { AmroUnifiedForm } from '@/features/module-amro/components/unified';

function AircraftForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await saveAircraft(formData);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AmroUnifiedForm
      open={open}
      onOpenChange={setOpen}
      title="Create Aircraft"
      description="Add a new aircraft to the fleet"
      onSubmit={handleSubmit}
      onCancel={() => setOpen(false)}
      loading={loading}
      submitLabel="Create Aircraft"
    >
      <AmroUnifiedForm.Section title="Basic Information">
        <AmroUnifiedForm.Field label="Registration" required error={errors.registration}>
          <Input value={formData.registration} onChange={...} />
        </AmroUnifiedForm.Field>
        <AmroUnifiedForm.Field label="Model" required>
          <Select ... />
        </AmroUnifiedForm.Field>
        <AmroUnifiedForm.Field label="Manufacturer">
          <Select ... />
        </AmroUnifiedForm.Field>
      </AmroUnifiedForm.Section>

      <AmroUnifiedForm.Section title="Specifications">
        <AmroUnifiedForm.Field label="Capacity">
          <Input type="number" value={formData.capacity} onChange={...} />
        </AmroUnifiedForm.Field>
        <AmroUnifiedForm.Field label="Range (km)">
          <Input type="number" value={formData.range} onChange={...} />
        </AmroUnifiedForm.Field>
      </AmroUnifiedForm.Section>
    </AmroUnifiedForm>
  );
}
```

**With Tabs:**

```tsx
<AmroUnifiedForm
  open={open}
  onOpenChange={setOpen}
  title="Edit Template"
  onSubmit={handleSubmit}
>
  <AmroUnifiedForm.Tabs defaultValue="details">
    <AmroUnifiedForm.Tab value="details" label="Details">
      <AmroUnifiedForm.Section title="Template Info">
        <AmroUnifiedForm.Field label="Code" required>
          <Input ... />
        </AmroUnifiedForm.Field>
        <AmroUnifiedForm.Field label="Name" required>
          <Input ... />
        </AmroUnifiedForm.Field>
      </AmroUnifiedForm.Section>
    </AmroUnifiedForm.Tab>

    <AmroUnifiedForm.Tab value="tasks" label="Tasks">
      {/* Task selection UI */}
    </AmroUnifiedForm.Tab>

    <AmroUnifiedForm.Tab value="materials" label="Materials">
      {/* Materials UI */}
    </AmroUnifiedForm.Tab>
  </AmroUnifiedForm.Tabs>
</AmroUnifiedForm>
```

---

## Migration Guide

### How to Use in New Modules

1. **Import components:**
```tsx
import {
  AmroUnifiedPageLayout,
  AmroUnifiedTable,
  AmroUnifiedActions,
  AmroUnifiedForm,
} from '@/features/module-amro/components/unified';
```

2. **Create page layout:**
```tsx
<AmroUnifiedPageLayout
  title="Module Name"
  description="Module description"
  breadcrumbs={[...]}
  headerActions={...}
>
  {/* Content */}
</AmroUnifiedPageLayout>
```

3. **Add table:**
```tsx
<AmroUnifiedTable
  columns={columns}
  data={data}
  search={{...}}
  filters={filters}
  pagination={{...}}
  actions={(row) => AmroActions.crud({...})}
/>
```

4. **Add form:**
```tsx
<AmroUnifiedForm
  open={open}
  onOpenChange={setOpen}
  title="Create Item"
  onSubmit={handleSubmit}
>
  <AmroUnifiedForm.Section title="Basic Info">
    <AmroUnifiedForm.Field label="Name" required>
      <Input ... />
    </AmroUnifiedForm.Field>
  </AmroUnifiedForm.Section>
</AmroUnifiedForm>
```

### How to Migrate Existing Modules

**Step-by-step migration for each module:**

1. **Replace page layout:**
   - Replace `FirstScreenTemplate` + `Card` with `AmroUnifiedPageLayout`
   - Move header actions to `headerActions` prop

2. **Replace table:**
   - Replace custom table with `AmroUnifiedTable`
   - Define columns using `Column<T>[]` interface
   - Use `AmroActions.crud()` for standard actions

3. **Replace forms:**
   - Replace custom dialogs with `AmroUnifiedForm`
   - Use `AmroUnifiedForm.Section` for field groups
   - Use `AmroUnifiedForm.Field` for individual fields

4. **Test thoroughly:**
   - Verify all CRUD operations work
   - Check search, filters, sorting, pagination
   - Test responsive layout
   - Verify accessibility

---

## Best Practices

### Do's ✅

- **Use unified components** for all new modules
- **Follow column patterns** - define `key`, `label`, `sortable`, `render`
- **Use AmroActions.crud()** for standard CRUD actions
- **Group fields in Sections** with clear titles
- **Use Field component** for consistent labeling and validation
- **Provide empty state messages** for better UX
- **Test accessibility** - keyboard navigation, screen readers

### Don'ts ❌

- **Don't mix old and new patterns** in the same module
- **Don't skip validation** on required fields
- **Don't hardcode action arrays** - use `AmroActions.crud()`
- **Don't forget loading states** for async operations
- **Don't skip empty states** - always provide helpful messaging
- **Don't ignore mobile responsiveness** - test on small screens

---

## Summary

The 4 unified components provide:

| Component | Purpose | Lines of Code Saved |
|-----------|---------|---------------------|
| `AmroUnifiedPageLayout` | Page container | ~50 per module |
| `AmroUnifiedTable` | Table with search/filters/pagination | ~200 per module |
| `AmroUnifiedActions` | Standardized actions menu | ~30 per module |
| `AmroUnifiedForm` | Data entry dialogs | ~100 per module |

**Total:** ~380 lines of code saved per module, with consistent UX across all 15 AMRO modules! 🎉
