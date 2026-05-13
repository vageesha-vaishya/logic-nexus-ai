# Phase 2: Settings Modules Migration Guide

**Date:** 2026-04-12  
**Status:** Pilot Complete (Manufacturers) - Template Ready for Remaining 11 Modules

---

## Completed

### ✅ Manufacturers Module

**File:** `src/features/module-amro/settings/pages/ManufacturersPage.tsx`  
**Route:** `/dashboard/amro/settings/master-data/manufacturers`  
**Status:** Production-ready

**Features Implemented:**
- ✅ `AmroUnifiedPageLayout` with breadcrumbs, KPI metrics, header actions
- ✅ `AmroUnifiedTable` with search, filters, sorting, pagination
- ✅ `AmroUnifiedActions` for row actions (Edit, Delete)
- ✅ `AmroUnifiedForm` for create/edit dialogs
- ✅ Delete confirmation dialog
- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ API integration with existing endpoints

**Benefits Delivered:**
- ~400 lines of clean, maintainable code (vs ~800 in old pattern)
- Consistent layout with all AMRO modules
- Standardized UX patterns
- Full TypeScript support

---

## Remaining Modules to Migrate (11)

| # | Module | Route | Priority | Complexity |
|---|--------|-------|----------|------------|
| 1 | Aircraft | `/dashboard/amro/settings/master-data/aircraft` | P0 | High |
| 2 | Parts Inventory | `/dashboard/amro/settings/master-data/parts-inventory` | P0 | High |
| 3 | Suppliers | `/dashboard/amro/settings/master-data/suppliers` | P1 | Medium |
| 4 | Maintenance Facilities | `/dashboard/amro/settings/master-data/maintenance-facilities` | P1 | Medium |
| 5 | Work Centers | `/dashboard/amro/settings/master-data/work-centers` | P1 | Low |
| 6 | Skill Codes | `/dashboard/amro/settings/master-data/skill-codes` | P1 | Low |
| 7 | Model | `/dashboard/amro/settings/master-data/model` | P1 | Medium |
| 8 | Regulator Profiles | `/dashboard/amro/settings/master-data/regulator-profiles` | P2 | Medium |
| 9 | Shift Calendars | `/dashboard/amro/settings/master-data/shift-calendars` | P2 | Low |
| 10 | Work Packages | `/dashboard/amro/settings/master-data/work-orders` | P2 | High |
| 11 | Work Package Templates | `/dashboard/amro/settings/master-data/work-order_templates` | P2 | High |

---

## Migration Template

Use the **ManufacturersPage.tsx** as a template for all remaining modules. Here's the pattern:

### Step 1: Create Entity Page

```tsx
// src/features/module-amro/settings/pages/{Entity}Page.tsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, IconName } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import {
  AmroUnifiedPageLayout,
  AmroUnifiedTable,
  AmroUnifiedActions,
  AmroUnifiedForm,
  AmroActions,
} from '@/features/module-amro/components/unified';
import type { Column, PaginationConfig, SearchConfig, TableFilter } from '@/features/module-amro/components/unified';

// ── Types ────────────────────────────────────────────────────────────────────

interface Entity {
  id: string;
  tenant_id: string;
  // ... entity-specific fields
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EntityFormData {
  // ... form fields
  is_active: boolean;
}

// ── API Functions ──────────────────────────────────────────────────────────────

async function fetchEntities(...) { /* ... */ }
async function createEntity(...) { /* ... */ }
async function updateEntity(...) { /* ... */ }
async function deleteEntity(...) { /* ... */ }

// ── Component ──────────────────────────────────────────────────────────────────

export function EntityPage() {
  // State, loading, filters, form, delete
  // Load function
  // Form handlers
  // Delete handlers
  // Table configuration
  // Render with AmroUnifiedPageLayout
}
```

### Step 2: Update Routes in App.tsx

```tsx
// Add lazy import
const EntityPage = lazy(() => import("./features/module-amro/settings/pages/EntityPage").then((module) => ({ default: module.EntityPage })));

// Update route
<Route path="/dashboard/amro/settings/master-data/entity" element={<ProtectedRoute ...><EntityPage /></ProtectedRoute>} />
```

### Step 3: Test

- [ ] Page loads without errors
- [ ] Table displays data correctly
- [ ] Search works
- [ ] Filters work
- [ ] Sorting works
- [ ] Pagination works
- [ ] Create form works
- [ ] Edit form works
- [ ] Delete confirmation works
- [ ] Delete operation works
- [ ] Error handling works
- [ ] Loading states work
- [ ] Empty states work

---

## Per-Module Customization Guide

### Aircraft
**Complexity:** High  
**Special Considerations:**
- Has flight logs relationship
- Has parts inventory relationship
- Has maintenance history
- May need tabs for related data

**Recommended Structure:**
```tsx
<AmroUnifiedForm.Tabs defaultValue="basic">
  <AmroUnifiedForm.Tab value="basic" label="Basic Info">
    {/* Registration, model, manufacturer, etc. */}
  </AmroUnifiedForm.Tab>
  <AmroUnifiedForm.Tab value="specs" label="Specifications">
    {/* Capacity, range, engine type, etc. */}
  </AmroUnifiedForm.Tab>
  <AmroUnifiedForm.Tab value="maintenance" label="Maintenance">
    {/* Last maintenance, next due, etc. */}
  </AmroUnifiedForm.Tab>
</AmroUnifiedForm.Tabs>
```

### Parts Inventory
**Complexity:** High  
**Special Considerations:**
- Has stock levels
- Has suppliers relationship
- Has manufacturers relationship
- May have batch/lot tracking

**Recommended Structure:**
```tsx
// Add stock level indicator in table
{
  key: 'stock_level',
  label: 'Stock',
  render: (row) => (
    <Badge variant={row.stock_level > row.reorder_point ? 'default' : 'destructive'}>
      {row.stock_level} / {row.reorder_point}
    </Badge>
  ),
}
```

### Suppliers
**Complexity:** Medium  
**Similar to:** Manufacturers  
**Customization:** Add contact details, rating, lead time fields

### Maintenance Facilities
**Complexity:** Medium  
**Special Considerations:** Location, capacity, certifications, available work centers

### Work Centers
**Complexity:** Low  
**Similar to:** Skill Codes  
**Customization:** Add capacity, available shifts, assigned skills

### Skill Codes
**Complexity:** Low  
**Similar to:** Manufacturers (simple CRUD)  
**Customization:** Add skill level, certification requirements

### Model
**Complexity:** Medium  
**Special Considerations:** Manufacturer relationship, specifications, variants

### Regulator Profiles
**Complexity:** Medium  
**Special Considerations:** Regulatory authority, compliance requirements, audit trail

### Shift Calendars
**Complexity:** Low  
**Special Considerations:** Date ranges, shift patterns, holiday exceptions

### Work Packages
**Complexity:** High  
**Special Considerations:** Template relationship, aircraft assignment, task execution, materials

### Work Package Templates
**Complexity:** High  
**Special Considerations:** Already has unified catalog - may need different approach

---

## Migration Checklist

For each module:

### Pre-Migration
- [ ] Review existing `AmroSettingsMasterDataPage` implementation for the entity
- [ ] Identify all fields and relationships
- [ ] Check existing API endpoints
- [ ] Note any special UI requirements (tabs, related data, etc.)

### Implementation
- [ ] Copy `ManufacturersPage.tsx` as template
- [ ] Rename to `{Entity}Page.tsx`
- [ ] Update types/interfaces for entity
- [ ] Update API functions (endpoints, payload structure)
- [ ] Update column definitions
- [ ] Update form fields
- [ ] Update KPI metrics
- [ ] Update breadcrumbs
- [ ] Add lazy import to `App.tsx`
- [ ] Update route in `App.tsx`

### Testing
- [ ] TypeScript compilation passes
- [ ] Page loads without errors
- [ ] All CRUD operations work
- [ ] Search, filters, sorting, pagination work
- [ ] Form validation works
- [ ] Error handling works
- [ ] Loading/empty states work
- [ ] Responsive layout works
- [ ] No regression in existing functionality

---

## Estimated Timeline

| Module | Complexity | Estimated Time |
|--------|------------|----------------|
| Manufacturers | ✅ Done | - |
| Skill Codes | Low | 2 hours |
| Work Centers | Low | 2 hours |
| Shift Calendars | Low | 2 hours |
| Suppliers | Medium | 3 hours |
| Maintenance Facilities | Medium | 3 hours |
| Model | Medium | 3 hours |
| Regulator Profiles | Medium | 3 hours |
| Aircraft | High | 4 hours |
| Parts Inventory | High | 4 hours |
| Work Packages | High | 4 hours |
| **Total** | | **~30 hours** |

**With parallel development:** Can be completed in 3-4 days

---

## Code Reuse Patterns

### Common API Functions

```tsx
// Generic CRUD operations can be abstracted
async function fetchList<T>(endpoint: string, accessToken: string, params: any) { /* ... */ }
async function createItem<T>(endpoint: string, accessToken: string, data: any) { /* ... */ }
async function updateItem<T>(endpoint: string, id: string, accessToken: string, data: any) { /* ... */ }
async function deleteItem(endpoint: string, id: string, accessToken: string) { /* ... */ }
```

### Common Table Patterns

```tsx
// Status badge pattern
const statusColumn: Column<Entity> = {
  key: 'is_active',
  label: 'Status',
  render: (row) => (
    <Badge variant={row.is_active ? 'default' : 'secondary'}>
      {row.is_active ? 'Active' : 'Inactive'}
    </Badge>
  ),
};

// Date column pattern
const dateColumn: Column<Entity> = {
  key: 'created_at',
  label: 'Created',
  sortable: true,
  render: (row) => new Date(row.created_at).toLocaleDateString(),
};
```

### Common Form Patterns

```tsx
// Text input field
<AmroUnifiedForm.Field label="Name" required error={errors.name}>
  <Input value={formData.name} onChange={...} />
</AmroUnifiedForm.Field>

// Select field
<AmroUnifiedForm.Field label="Manufacturer" required>
  <Select value={formData.manufacturer_id} onValueChange={...}>
    <SelectTrigger><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
    <SelectContent>
      {manufacturers.map(m => (
        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
</AmroUnifiedForm.Field>

// Checkbox field
<AmroUnifiedForm.Field label="Active" colSpan={3}>
  <div className="flex items-center gap-2">
    <Checkbox checked={formData.is_active} onCheckedChange={...} />
    <label>Active (available for selection)</label>
  </div>
</AmroUnifiedForm.Field>
```

---

## Summary

**Phase 2 Progress:**
- ✅ 1 of 12 modules migrated (Manufacturers)
- 📝 Template and guide created for remaining 11 modules
- ⏱️ Estimated 30 hours total for completion
- 🎯 Can be done in 3-4 days with parallel development

**Next Steps:**
1. Review ManufacturersPage.tsx as reference
2. Migrate low-complexity modules first (Skill Codes, Work Centers, Shift Calendars)
3. Progress to medium-complexity modules
4. Complete high-complexity modules last
5. Test all modules thoroughly
6. Update documentation

**Ready to continue migration!** 🚀
