# Enterprise Design System Migration Guide

**Date:** 2026-04-10  
**Status:** 🚀 In Progress  
**Scope:** All dashboard pages (AMRO, CRM, Logistics, Platform/Admin)  
**Estimated Effort:** 40-60 hours  

---

## 📋 Executive Summary

This guide documents the systematic migration of all dashboard pages from the legacy `DashboardLayout` + shadcn component pattern to the **Enterprise Design System** (`EnterpriseFormLayout`, `EnterpriseSheet`, `EnterpriseTable`, etc.).

The migration ensures:
- ✅ Consistent platform look and feel (per `LNX-GOV-UX-001`)
- ✅ Higher information density for ERP workflows
- ✅ Standardized interaction patterns across all modules
- ✅ Reduced code duplication (per `LNX-GOV-CRUD-001`)
- ✅ Compliance with project rules (`.trae/rules/project_rules.md`)

---

## 🎯 Migration Patterns

### Pattern 1: List Pages (Most Common)

**Before (Legacy):**
```tsx
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export function Carriers() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Carriers</h1>
            <p className="text-muted-foreground">Manage shipping carriers</p>
          </div>
          <Button><Plus /> New Carrier</Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All Carriers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              {/* Manual table implementation */}
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

**After (Enterprise):**
```tsx
import { EnterpriseFormLayout, EnterpriseSheet, EnterpriseTable, EnterpriseHeader, EnterpriseButton } from '@/components/ui/enterprise';

export function Carriers() {
  const columns = [
    { id: 'name', label: 'Name', accessor: 'name', sortable: true },
    { id: 'status', label: 'Status', accessor: 'status' },
    { id: 'actions', label: 'Actions', accessor: 'actions' }
  ];

  return (
    <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
      <EnterpriseFormLayout
        title="Carriers"
        breadcrumbs={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Logistics', to: '/dashboard/logistics' },
          { label: 'Carriers' }
        ]}
        actions={
          <EnterpriseButton variant="primary" icon={<Plus />} onClick={handleNew}>
            New Carrier
          </EnterpriseButton>
        }
      >
        <EnterpriseSheet>
          <EnterpriseHeader
            title="All Carriers"
            subtitle="Manage shipping carriers and logistics providers"
          />
          <div className="p-6">
            <EnterpriseTable
              columns={columns}
              data={carriers}
              onRowClick={(row) => navigate(`/carriers/${row.id}`)}
              isLoading={isLoading}
            />
          </div>
        </EnterpriseSheet>
      </EnterpriseFormLayout>
    </div>
  );
}
```

---

### Pattern 2: Detail/Edit Pages

**Before (Legacy):**
```tsx
<DashboardLayout>
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{account.name}</h1>
      <Button onClick={() => setIsEditing(true)}>Edit</Button>
    </div>
    <Card>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Email</label>
            <p>{account.email}</p>
          </div>
          {/* More fields... */}
        </div>
      </CardContent>
    </Card>
  </div>
</DashboardLayout>
```

**After (Enterprise):**
```tsx
<div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
  <EnterpriseFormLayout
    title={account.name}
    breadcrumbs={[
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'CRM', to: '/dashboard/crm' },
      { label: 'Accounts', to: '/dashboard/accounts' },
      { label: account.name }
    ]}
    status={account.status}
    actions={
      <>
        <EnterpriseButton variant="outline" onClick={() => navigate('/dashboard/accounts')}>
          Back to List
        </EnterpriseButton>
        <EnterpriseButton variant="primary" onClick={() => setIsEditing(true)}>
          Edit Account
        </EnterpriseButton>
      </>
    }
  >
    <EnterpriseSheet
      header={
        <div className="flex items-center gap-4">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">{account.name}</h2>
            <p className="text-sm text-muted-foreground">{account.industry}</p>
          </div>
        </div>
      }
      smartButtons={[
        { icon: <Users />, label: 'Contacts', count: contactCount, onClick: () => navigate('/contacts') },
        { icon: <FileText />, label: 'Opportunities', count: oppCount, onClick: () => navigate('/opportunities') }
      ]}
    >
      {isEditing ? (
        <EnterpriseForm onSubmit={handleSubmit} initialValues={account}>
          <EnterpriseFormSection title="Basic Information">
            <EnterpriseFormGrid columns={2}>
              <EnterpriseFormField name="name" label="Account Name" required />
              <EnterpriseFormField name="email" label="Email" type="email" />
            </EnterpriseFormGrid>
          </EnterpriseFormSection>
          <EnterpriseFormActions
            submitLabel="Save Changes"
            onCancel={() => setIsEditing(false)}
          />
        </EnterpriseForm>
      ) : (
        <div className="p-6 space-y-6">
          <EnterpriseNotebook>
            <EnterpriseTab label="Overview" value="overview">
              <div className="grid grid-cols-2 gap-6 p-6">
                <EnterpriseField label="Email" value={account.email} />
                <EnterpriseField label="Phone" value={account.phone} />
                <EnterpriseField label="Industry" value={account.industry} />
                <EnterpriseField label="Website" value={account.website} />
              </div>
            </EnterpriseTab>
            <EnterpriseTab label="Contacts" value="contacts">
              <EnterpriseCard title="Related Contacts">
                <EnterpriseTable columns={contactColumns} data={contacts} />
              </EnterpriseCard>
            </EnterpriseTab>
          </EnterpriseNotebook>
        </div>
      )}
    </EnterpriseSheet>
    <EnterpriseActivityFeed className="hidden xl:flex shrink-0 w-[400px]" />
  </EnterpriseFormLayout>
</div>
```

---

### Pattern 3: New Record Forms

**Before (Legacy):**
```tsx
<DashboardLayout>
  <Card>
    <CardHeader>
      <CardTitle>New Account</CardTitle>
    </CardHeader>
    <CardContent>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name" />
          <Input label="Email" />
        </div>
        <Button type="submit">Create Account</Button>
      </form>
    </CardContent>
  </Card>
</DashboardLayout>
```

**After (Enterprise):**
```tsx
<div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
  <EnterpriseFormLayout
    title="New Account"
    breadcrumbs={[
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'CRM', to: '/dashboard/crm' },
      { label: 'Accounts', to: '/dashboard/accounts' },
      { label: 'New' }
    ]}
    status="Draft"
    actions={
      <EnterpriseButton variant="outline" onClick={() => navigate('/dashboard/accounts')}>
        Cancel
      </EnterpriseButton>
    }
  >
    <EnterpriseSheet>
      <EnterpriseForm onSubmit={handleSubmit} initialValues={{}}>
        <EnterpriseFormSection title="Account Information">
          <EnterpriseFormGrid columns={2}>
            <EnterpriseFormField name="name" label="Account Name" required />
            <EnterpriseFormField name="email" label="Email" type="email" required />
            <EnterpriseFormField name="phone" label="Phone" />
            <EnterpriseFormField name="website" label="Website" />
          </EnterpriseFormGrid>
        </EnterpriseFormSection>
        <EnterpriseFormSection title="Additional Details">
          <EnterpriseFormField name="description" label="Description" type="textarea" />
        </EnterpriseFormSection>
        <EnterpriseFormActions
          submitLabel="Create Account"
          onCancel={() => navigate('/dashboard/accounts')}
        />
      </EnterpriseForm>
    </EnterpriseSheet>
  </EnterpriseFormLayout>
</div>
```

---

## 🔧 Component Migration Map

| Legacy Component | Enterprise Replacement | Notes |
|-----------------|------------------------|-------|
| `DashboardLayout` | `EnterpriseFormLayout` | Main wrapper replacement |
| `Card` + `CardHeader` + `CardContent` | `EnterpriseSheet` | Container for content |
| shadcn `Table` + manual sort/pagination | `EnterpriseTable` | Built-in features |
| shadcn `Dialog` | `EnterpriseModal` | Consistent modal UX |
| shadcn `Tabs` | `EnterpriseNotebook` + `EnterpriseTab` | Tab navigation |
| Manual field display `<div>` | `EnterpriseField` | Standardized key-value |
| Page header `<h1>` + `<p>` | `EnterpriseHeader` or `EnterpriseFormLayout.title` | Unified headers |
| `Button` (various styles) | `EnterpriseButton` | Standardized variants |
| Manual stat buttons | `EnterpriseStatButton` | In `EnterpriseSheet.smartButtons` |
| Custom activity sidebar | `EnterpriseActivityFeed` | Standard activity feed |
| Custom form layout | `EnterpriseForm` + `EnterpriseFormField` | Form system |

---

## 📦 Enterprise Component Reference

### Core Layout Components

#### `EnterpriseFormLayout`
**Purpose:** Main page wrapper (replaces `DashboardLayout`)  
**Props:**
- `title`: Page title (shown in header)
- `breadcrumbs`: Array of `{ label: string, to?: string }`
- `actions`: ReactNode for header actions (buttons)
- `status`: Status badge text
- `children`: Page content

**Usage:**
```tsx
<EnterpriseFormLayout
  title="Page Title"
  breadcrumbs={[{ label: 'Parent', to: '/parent' }, { label: 'Current' }]}
  actions={<EnterpriseButton>New</EnterpriseButton>}
  status="Active"
>
  {children}
</EnterpriseFormLayout>
```

#### `EnterpriseSheet`
**Purpose:** Main content container (replaces `Card`)  
**Props:**
- `header`: ReactNode for sheet header content
- `smartButtons`: Array of `EnterpriseStatButton` configs
- `children`: Sheet content

**Usage:**
```tsx
<EnterpriseSheet
  header={<div>Header content</div>}
  smartButtons={[{ icon: <Icon />, label: 'Label', count: 5 }]}
>
  {children}
</EnterpriseSheet>
```

---

### Data Display Components

#### `EnterpriseTable`
**Purpose:** Data tables with built-in sort, pagination, loading, empty states  
**Props:**
- `columns`: Array of `{ id, label, accessor, sortable?, width? }`
- `data`: Array of row objects
- `onSort?: (column, direction) => void`
- `onRowClick?: (row) => void`
- `isLoading?: boolean`
- `emptyState?: ReactNode`

**Usage:**
```tsx
<EnterpriseTable
  columns={[
    { id: 'name', label: 'Name', accessor: 'name', sortable: true },
    { id: 'status', label: 'Status', accessor: 'status' }
  ]}
  data={rows}
  onRowClick={(row) => navigate(`/detail/${row.id}`)}
  isLoading={loading}
/>
```

#### `EnterpriseField`
**Purpose:** Standardized key-value display  
**Props:**
- `label`: Field label
- `value`: Field value (string or ReactNode)

**Usage:**
```tsx
<EnterpriseField label="Email" value={user.email} />
```

#### `EnterpriseHeader`
**Purpose:** Page/section headers  
**Props:**
- `title`: Header title
- `subtitle?: string`
- `variant?: "default" | "bordered" | "minimal"`
- `breadcrumbs?: Array<{ label, href? }>`
- `actions?: ReactNode`
- `status?: string`

**Usage:**
```tsx
<EnterpriseHeader
  title="All Carriers"
  subtitle="Manage shipping carriers"
  variant="bordered"
/>
```

---

### Form Components

#### `EnterpriseForm`
**Purpose:** Form wrapper with state management  
**Props:**
- `onSubmit`: (values) => void
- `initialValues`: Object
- `validationSchema?:` Zod schema
- `isSubmitting?: boolean`

#### `EnterpriseFormField`
**Purpose:** Form input field  
**Props:**
- `name`: Field name
- `label`: Display label
- `type?: "text" | "email" | "number" | "textarea" | "select" | "checkbox" | "date"`
- `required?: boolean`
- `placeholder?: string`
- `error?: string`
- `helpText?: string`
- `disabled?: boolean`

#### `EnterpriseFormSection`
**Purpose:** Form section grouping  
**Props:**
- `title?: string`
- `description?: string`

#### `EnterpriseFormGrid`
**Purpose:** Multi-column form layout  
**Props:**
- `columns?: 1 | 2 | 3`

#### `EnterpriseFormActions`
**Purpose:** Form submit/cancel buttons  
**Props:**
- `submitLabel?: string` (default: "Submit")
- `cancelLabel?: string`
- `onCancel?: () => void`
- `isLoading?: boolean`

**Complete Form Example:**
```tsx
<EnterpriseForm onSubmit={handleSubmit} initialValues={initialValues}>
  <EnterpriseFormSection title="Basic Information">
    <EnterpriseFormGrid columns={2}>
      <EnterpriseFormField name="name" label="Name" required />
      <EnterpriseFormField name="email" label="Email" type="email" />
    </EnterpriseFormGrid>
  </EnterpriseFormSection>
  <EnterpriseFormActions
    submitLabel="Save"
    onCancel={() => navigate('/back')}
  />
</EnterpriseForm>
```

---

### Interactive Components

#### `EnterpriseButton`
**Purpose:** Standardized buttons  
**Props:**
- `variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"`
- `size?: "sm" | "md" | "lg"`
- `icon?: ReactNode`
- `isLoading?: boolean`
- `disabled?: boolean`

**Usage:**
```tsx
<EnterpriseButton variant="primary" size="lg" icon={<Plus />}>
  New Record
</EnterpriseButton>
```

#### `EnterpriseModal`
**Purpose:** Dialog/modal  
**Props:**
- `isOpen: boolean`
- `onClose: () => void`
- `title: string`
- `size?: "sm" | "md" | "lg" | "xl"`
- `footer?: ReactNode`

**Usage:**
```tsx
<EnterpriseModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Edit Record"
  size="lg"
  footer={
    <div className="flex gap-2">
      <EnterpriseButton variant="outline" onClick={() => setIsOpen(false)}>Cancel</EnterpriseButton>
      <EnterpriseButton variant="primary" onClick={handleSave}>Save</EnterpriseButton>
    </div>
  }
>
  {formContent}
</EnterpriseModal>
```

#### `EnterpriseNotebook` + `EnterpriseTab`
**Purpose:** Tab navigation  
**Usage:**
```tsx
<EnterpriseNotebook>
  <EnterpriseTab label="Overview" value="overview">
    {overviewContent}
  </EnterpriseTab>
  <EnterpriseTab label="Details" value="details">
    {detailsContent}
  </EnterpriseTab>
</EnterpriseNotebook>
```

#### `EnterpriseActivityFeed`
**Purpose:** Right sidebar for activity/history  
**Usage:**
```tsx
<EnterpriseActivityFeed className="hidden xl:flex shrink-0 w-[400px]" />
```

---

## 🚀 Migration Procedure

### Step 1: Identify Page Type
Determine which pattern applies:
- **List Page**: Shows a table/grid of records
- **Detail Page**: Shows a single record with fields
- **New/Edit Form**: Form for creating/updating records
- **Complex Page**: Mix of multiple views (tabs, kanban, etc.)

### Step 2: Update Imports
Remove legacy imports and add Enterprise imports:
```diff
- import { DashboardLayout } from '@/components/layout/DashboardLayout';
- import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
- import { Table } from '@/components/ui/table';
- import { Button } from '@/components/ui/button';
+ import {
+   EnterpriseFormLayout,
+   EnterpriseSheet,
+   EnterpriseTable,
+   EnterpriseHeader,
+   EnterpriseButton
+ } from '@/components/ui/enterprise';
```

### Step 3: Replace Outer Wrapper
```diff
- <DashboardLayout>
-   <div className="space-y-6">
+ <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
+   <EnterpriseFormLayout
+     title="Page Title"
+     breadcrumbs={[{ label: 'Module', to: '/dashboard/module' }, { label: 'Page' }]}
+     actions={<EnterpriseButton>New</EnterpriseButton>}
+   >
```

### Step 4: Replace Content Containers
```diff
- <Card>
-   <CardHeader>
-     <CardTitle>All Records</CardTitle>
-   </CardHeader>
-   <CardContent>
+ <EnterpriseSheet>
+   <EnterpriseHeader title="All Records" subtitle="Description" />
+   <div className="p-6">
```

### Step 5: Replace Tables
```diff
- <Table>
-   <TableHeader>
-     <TableRow>
-       <TableHead>Name</TableHead>
-       <TableHead>Status</TableHead>
-     </TableRow>
-   </TableHeader>
-   <TableBody>
-     {data.map(row => (
-       <TableRow key={row.id}>
-         <TableCell>{row.name}</TableCell>
-         <TableCell>{row.status}</TableCell>
-       </TableRow>
-     ))}
-   </TableBody>
- </Table>
+ <EnterpriseTable
+   columns={[
+     { id: 'name', label: 'Name', accessor: 'name', sortable: true },
+     { id: 'status', label: 'Status', accessor: 'status' }
+   ]}
+   data={data}
+   onRowClick={(row) => navigate(`/detail/${row.id}`)}
+ />
```

### Step 6: Replace Dialogs/Modals
```diff
- <Dialog open={isOpen} onOpenChange={setIsOpen}>
-   <DialogContent>
-     <DialogHeader>
-       <DialogTitle>Edit Record</DialogTitle>
-     </DialogHeader>
-     {formContent}
-   </DialogContent>
- </Dialog>
+ <EnterpriseModal
+   isOpen={isOpen}
+   onClose={() => setIsOpen(false)}
+   title="Edit Record"
+   size="lg"
+ >
+   {formContent}
+ </EnterpriseModal>
```

### Step 7: Replace Forms
```diff
- <form onSubmit={handleSubmit}>
-   <div className="grid grid-cols-2 gap-4">
-     <div>
-       <label>Name</label>
-       <Input value={name} onChange={setName} />
-     </div>
-   </div>
-   <Button type="submit">Save</Button>
- </form>
+ <EnterpriseForm onSubmit={handleSubmit} initialValues={values}>
+   <EnterpriseFormSection title="Information">
+     <EnterpriseFormGrid columns={2}>
+       <EnterpriseFormField name="name" label="Name" required />
+     </EnterpriseFormGrid>
+   </EnterpriseFormSection>
+   <EnterpriseFormActions submitLabel="Save" onCancel={handleCancel} />
+ </EnterpriseForm>
```

### Step 8: Close Wrappers
```diff
-     </CardContent>
-   </Card>
-   </div>
- </DashboardLayout>
+   </EnterpriseSheet>
+   </EnterpriseFormLayout>
+ </div>
```

### Step 9: Add Activity Feed (Detail Pages Only)
For detail/edit pages, add the activity feed:
```tsx
<EnterpriseFormLayout {...props}>
  <EnterpriseSheet>{/* ... */}</EnterpriseSheet>
  <EnterpriseActivityFeed className="hidden xl:flex shrink-0 w-[400px]" />
</EnterpriseFormLayout>
```

### Step 10: Verify and Test
1. Run type check: `npm run type-check` or `tsc --noEmit`
2. Run linter: `npm run lint`
3. Test page in browser:
   - Verify all data displays correctly
   - Test all button/action handlers
   - Test form submission (if applicable)
   - Test responsive behavior
   - Verify breadcrumbs navigate correctly
4. Check against `DESIGN_SYSTEM.md` for compliance
5. Check against `.trae/rules/project_rules.md` for compliance

---

## 📋 Migration Checklist

For each page migrated, verify:

### Structure
- [ ] `DashboardLayout` replaced with `EnterpriseFormLayout`
- [ ] Outer wrapper is `<div className="h-screen w-full bg-[#f9fafb] overflow-hidden">`
- [ ] `Card` replaced with `EnterpriseSheet`
- [ ] Breadcrumbs are present and correct
- [ ] Page title is in `EnterpriseFormLayout.title`
- [ ] Actions are in `EnterpriseFormLayout.actions`

### Components
- [ ] `Table` replaced with `EnterpriseTable` (if applicable)
- [ ] `Dialog` replaced with `EnterpriseModal` (if applicable)
- [ ] `Tabs` replaced with `EnterpriseNotebook` + `EnterpriseTab` (if applicable)
- [ ] `Button` replaced with `EnterpriseButton` (if applicable)
- [ ] Form fields use `EnterpriseFormField` (if applicable)
- [ ] Manual field displays use `EnterpriseField` (if applicable)

### Design System Compliance
- [ ] Follows `DESIGN_SYSTEM.md` color palette
- [ ] Typography matches spec (`text-3xl` for H1, `text-lg` for H2, `text-sm` for body)
- [ ] Spacing uses standard gaps (`gap-4`, `gap-6`)
- [ ] Status badges use semantic colors
- [ ] Information density matches ERP standards

### Project Rules Compliance
- [ ] Follows `LNX-GOV-UX-001` (Base UI/UX Uniformity)
- [ ] Follows `LNX-GOV-CRUD-001` (CRUD Operations Standardization)
- [ ] Reuses existing Enterprise components (no duplication)
- [ ] Maintains backward compatibility (`LNX-GOV-COMPAT-001`)

### Quality Gates
- [ ] TypeScript compiles without errors
- [ ] ESLint passes without warnings
- [ ] Page renders correctly in browser
- [ ] All interactions work as expected
- [ ] Responsive behavior tested
- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] Error handling present

---

## 📊 Page Inventory by Module

### AMRO Module (~40-50 pages)
**Priority:** High - Largest module, most complex pages  
**Location:** `src/pages/dashboard/amro/` and `src/features/module-amro/`  
**Pages:**
- AmroOverview
- AmroWorkspace
- AmroTaskExecution
- AmroScheduling
- AmroParts (list, detail, new)
- AmroCompliance
- AmroInventory (multiple views)
- AmroWorkPackages
- Stock Ledger pages
- Master Data pages
- Settings pages

**Complexity:** High (many pages have kanban, complex tables, multi-step workflows)  
**Estimated Effort:** 15-20 hours

---

### CRM Module (~25-30 pages)
**Priority:** High - Must follow `LNX-GOV-CRM-001` (CRM Module Header Rules)  
**Location:** `src/pages/dashboard/crm/` and `src/features/module-crm/`  
**Pages:**
- Leads (list, pipeline, detail, new)
- Accounts (list, detail, new) - ✅ Some already migrated
- Contacts (list, detail, new) - ✅ Some already migrated
- Opportunities (list, detail, new, pipeline)
- Activities (list, detail, new)

**Complexity:** Medium-High (Leads page is 2574 lines, very complex)  
**Estimated Effort:** 10-15 hours  
**Special Notes:**
- Must preserve `CRMModuleHeaderNavigation` where required
- Must follow `LNX-GOV-CRM-001` control order
- Pipeline views may need custom handling

---

### Logistics Module (~20-25 pages)
**Priority:** Medium  
**Location:** `src/pages/dashboard/logistics/`  
**Pages:**
- Shipments (list, detail, new)
- Bookings (list, detail, new)
- Carriers (list, detail, new)
- Vendors (list, detail, new)
- Consignees (list, detail, new)
- Warehouses (list, detail, new)
- Vehicles (list, detail, new)
- Containers (list, detail, new)

**Complexity:** Medium (standard CRUD pages)  
**Estimated Effort:** 8-12 hours

---

### Platform/Admin Module (~30-40 pages)
**Priority:** Medium  
**Location:** `src/pages/dashboard/admin/` or similar  
**Pages:**
- Tenants (list, detail, new)
- Franchises (list, detail, new)
- Users (list, detail, new)
- Roles (list, detail, new)
- Permissions (list, detail)
- AuditLogs (list, detail)
- Security settings
- Platform settings
- Data Management
- Theme Management
- Email Management
- Communications Hub

**Complexity:** Medium (mix of simple and complex pages)  
**Estimated Effort:** 10-15 hours

---

## ⚠️ Common Pitfalls

### 1. Keeping DashboardLayout
**Mistake:** Wrapping `EnterpriseFormLayout` inside `DashboardLayout`  
**Fix:** `EnterpriseFormLayout` completely replaces `DashboardLayout`

### 2. Missing Outer Wrapper
**Mistake:** Forgetting `<div className="h-screen w-full bg-[#f9fafb] overflow-hidden">`  
**Fix:** Always wrap `EnterpriseFormLayout` with this div

### 3. EnterpriseTable Column Definitions
**Mistake:** Passing JSX render functions directly to columns  
**Fix:** Use `accessor` for simple field access, add custom render via column definition if needed

### 4. Breadcrumb Navigation
**Mistake:** Incorrect or missing breadcrumbs  
**Fix:** Always include full path from Dashboard to current page

### 5. Activity Feed on List Pages
**Mistake:** Adding `EnterpriseActivityFeed` to list pages  
**Fix:** Only detail/edit pages need activity feed

### 6. Complex Custom Features
**Mistake:** Trying to force complex custom features into Enterprise components  
**Fix:** Some pages (e.g., Leads with column resize, split-pane) may need incremental migration or Enterprise component extensions

### 7. CRM Module Header Controls
**Mistake:** Removing `CRMModuleHeaderNavigation` from CRM pages  
**Fix:** Per `LNX-GOV-CRM-001`, some CRM pages must preserve this - integrate with Enterprise layout instead of removing

---

## 🔍 Reference Examples

### Fully Migrated Pages (Study These)
1. **AccountNew.tsx** - Simple "New Record" form (108 lines)
2. **ContactNew.tsx** - Simple "New Record" form (107 lines)
3. **AccountDetail.tsx** - Full detail/edit page with tabs, tables, activity feed (395 lines)
4. **ContactDetail.tsx** - Contact detail page
5. **UnifiedQuoteComposer.tsx** - Large complex form (4300+ lines)

### Pages Needing Migration (Examples)
1. **Bookings.tsx** - Logistics list page
2. **Carriers.tsx** - Logistics list with dialogs
3. **Leads.tsx** - CRM complex list page (2574 lines)
4. **Commodities.tsx** - Data management with grid view
5. **Contacts.tsx** - CRM multi-view list
6. **Invoices.tsx** - Finance list page
7. **SystemLogs.tsx** - Audit list with detail sheet
8. **AmroChangesPreview.tsx** - AMRO kanban + table

---

## 🛠 Migration Automation

### Manual Process (Recommended for First 5 Pages)
1. Follow step-by-step procedure above
2. Review against reference examples
3. Get peer review before merging

### Semi-Automated (After Patterns Established)
Create codemods or scripts for:
- Import statement replacement
- Wrapper component replacement
- Common pattern transforms

### Quality Assurance
For every 10 pages migrated:
1. Run full type check
2. Run full lint suite
3. Manual testing of each migrated page
4. Cross-browser testing (Chrome, Firefox, Safari)
5. Responsive testing (mobile, tablet, desktop)

---

## 📈 Progress Tracking

### Phase 1: Foundation (2-4 hours)
- [x] Create migration guide (this document)
- [ ] Identify all pages requiring migration
- [ ] Create tracking spreadsheet/list
- [ ] Migrate 3-5 simple pages as practice
- [ ] Get team alignment on patterns

### Phase 2: AMRO Module (15-20 hours)
- [ ] Audit all AMRO pages
- [ ] Migrate simple AMRO pages first (10-15 pages)
- [ ] Migrate complex AMRO pages (10-15 pages)
- [ ] Migrate AMRO settings pages (5-10 pages)
- [ ] Verify AMRO documentation compliance (`LNX-GOV-AMRO-001`)

### Phase 3: CRM Module (10-15 hours)
- [ ] Audit all CRM pages
- [ ] Migrate simple CRM pages (5-10 pages)
- [ ] Migrate complex CRM pages (5-10 pages)
- [ ] Preserve CRM header controls per `LNX-GOV-CRM-001`
- [ ] Verify CRM rule compliance

### Phase 4: Logistics Module (8-12 hours)
- [ ] Audit all Logistics pages
- [ ] Migrate simple Logistics pages (10-15 pages)
- [ ] Migrate complex Logistics pages (5-10 pages)

### Phase 5: Platform/Admin (10-15 hours)
- [ ] Audit all Admin pages
- [ ] Migrate simple Admin pages (15-20 pages)
- [ ] Migrate complex Admin pages (5-10 pages)

### Phase 6: Verification (4-6 hours)
- [ ] Full type check pass
- [ ] Full lint pass
- [ ] Manual testing of all migrated pages
- [ ] Update DESIGN_SYSTEM.md if gaps found
- [ ] Update project_rules.md if needed
- [ ] Create migration completion report

---

## 🎓 Learning Resources

### Documentation
- `DESIGN_SYSTEM.md` - Complete design system specification
- `.trae/rules/project_rules.md` - Project governance rules
- `src/components/ui/enterprise/` - Component source code
- Reference migrated pages (AccountDetail.tsx, AccountNew.tsx, etc.)

### Commands
```bash
# Type check
npm run type-check
# or
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Dev server
npm run dev
```

---

## 📞 Support and Escalation

### Questions?
1. Check reference migrated pages first
2. Review DESIGN_SYSTEM.md
3. Check project_rules.md
4. Ask team lead or architect

### Blocking Issues
1. Enterprise component missing feature → Document gap, extend component
2. Complex custom feature doesn't fit → Discuss with architect, may need custom solution
3. Rule conflict → Escalate to governance council

---

## ✅ Completion Criteria

Migration is complete when:
- [ ] All ~150 dashboard pages migrated to Enterprise Design System
- [ ] Zero pages use legacy `DashboardLayout` + `Card` + `Table` pattern
- [ ] Full type check passes without errors
- [ ] Full lint passes without warnings
- [ ] All migrated pages manually tested and verified
- [ ] Migration completion report created
- [ ] DESIGN_SYSTEM.md updated with any gaps found
- [ ] Team trained on migration patterns for future pages

---

**Last Updated:** 2026-04-10  
**Maintained By:** Engineering Team  
**Review Cadence:** Weekly during migration effort
