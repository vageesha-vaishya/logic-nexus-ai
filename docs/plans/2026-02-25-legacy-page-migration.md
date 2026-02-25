# Legacy Page Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Migrate AccountDetailLegacy.tsx and ContactDetailLegacy.tsx to use the new enterprise component library for consistent design system implementation across CRM module.

**Architecture:** Replace generic Card/Tab-based layouts with EnterpriseSheet, EnterpriseFormLayout, EnterpriseNotebook, and EnterpriseActivityFeed components. Maintain all existing functionality (data fetching, forms, activities, relationships) while upgrading visual presentation to match newly refactored AccountDetail and ContactDetail pages.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Enterprise Components (EnterpriseSheet, EnterpriseFormLayout, EnterpriseNotebook, EnterpriseActivityFeed), Framer Motion

---

## Task 1: Migrate AccountDetailLegacy to Enterprise Components

**Files:**
- Modify: `src/pages/dashboard/AccountDetailLegacy.tsx`
- Reference: `src/pages/dashboard/AccountDetail.tsx` (already refactored example)
- Reference: `src/components/ui/enterprise/index.ts` (all available components)

**Context:**
The AccountDetailLegacy page currently uses:
- Generic `Card` component from shadcn/ui
- Tab-based navigation without enterprise styling
- Basic button and layout structure
- All the complex data fetching and state management (keep this)

The refactored AccountDetail.tsx uses:
- EnterpriseFormLayout with breadcrumbs and top navigation
- EnterpriseSheet with header
- EnterpriseNotebook for tab navigation
- EnterpriseActivityFeed for right sidebar
- EnterpriseCard + EnterpriseTable for related data

**Step 1: Update imports**

Replace the current imports with enterprise components:

```tsx
// Remove these:
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';

// Add these:
import {
  EnterpriseSheet,
  EnterpriseField,
  EnterpriseStatButton,
  EnterpriseFormLayout,
  EnterpriseNotebook,
  EnterpriseTab,
  EnterpriseActivityFeed,
  EnterpriseCard,
  EnterpriseTable,
  type Column
} from '@/components/ui/enterprise';
```

**Step 2: Replace page layout with EnterpriseFormLayout**

Change from:
```tsx
<DashboardLayout>
  {/* content */}
</DashboardLayout>
```

To:
```tsx
<EnterpriseFormLayout
  breadcrumbs={[
    { label: 'Accounts', to: '/accounts' },
    { label: account?.name || 'Loading...' }
  ]}
  title={account?.name || 'Account'}
  actions={
    <div className="flex gap-2">
      <Button onClick={() => setIsEditing(true)} variant="outline">
        <Edit className="h-4 w-4 mr-2" />
        Edit
      </Button>
      <Button onClick={() => setShowDeleteDialog(true)} variant="destructive">
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </Button>
    </div>
  }
>
  {/* Main content wrapped in EnterpriseSheet + EnterpriseNotebook */}
</EnterpriseFormLayout>
```

**Step 3: Replace Tab structure with EnterpriseNotebook**

Change from:
```tsx
<Tabs value={tab} onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="related">Related</TabsTrigger>
    {/* more tabs */}
  </TabsList>
  <TabsContent value="details">...</TabsContent>
  {/* more content */}
</Tabs>
```

To:
```tsx
<EnterpriseSheet header={/* header content */}>
  <EnterpriseNotebook>
    <EnterpriseTab label="Details" value="tab1">
      {/* Details content */}
    </EnterpriseTab>
    <EnterpriseTab label="Related" value="tab2">
      {/* Related content - use EnterpriseCard + EnterpriseTable */}
    </EnterpriseTab>
    {/* more tabs */}
  </EnterpriseNotebook>
</EnterpriseSheet>
<EnterpriseActivityFeed />
```

**Step 4: Replace Card sections with EnterpriseCard**

Example: For "Parent Account" section, change from:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Parent Account</CardTitle>
  </CardHeader>
  <CardContent>{/* content */}</CardContent>
</Card>
```

To:
```tsx
<EnterpriseCard
  title="Parent Account"
  description={parentAccount?.name}
>
  {/* content */}
</EnterpriseCard>
```

**Step 5: Use EnterpriseTable for related data**

For related contacts, child accounts, etc., use EnterpriseTable with Column definitions:

```tsx
const accountColumns: Column<any>[] = [
  { key: 'id', label: 'ID', width: '100px' },
  { key: 'name', label: 'Name', width: '200px' },
  { key: 'industry', label: 'Industry', width: '150px' },
];

<EnterpriseCard title="Child Accounts">
  <EnterpriseTable
    columns={accountColumns}
    data={childAccounts}
    rowKey={(row) => row.id}
    onRowClick={(row) => navigate(`/accounts/${row.id}`)}
    emptyState={<p className="text-center py-8">No child accounts</p>}
  />
</EnterpriseCard>
```

**Step 6: Keep all existing functionality**

- All state management (useState, useEffect) stays the same
- All data fetching functions (fetchAccount, fetchRelatedContacts, etc.) stay the same
- All form handling and validation stays the same
- All delete/update logic stays the same
- Just replace the visual presentation layer

**Step 7: Test the changes**

Navigate to an account detail page and verify:
- ✅ Page loads and displays account data
- ✅ All tabs work correctly (Details, Related, Activities, Emails)
- ✅ Forms render and validation works
- ✅ Related data tables display correctly
- ✅ Delete/update functionality works
- ✅ Activity feed displays on the right side
- ✅ Navigation works (breadcrumbs, row clicks, back button)

**Step 8: Commit**

```bash
git add src/pages/dashboard/AccountDetailLegacy.tsx
git commit -m "refactor(crm): migrate AccountDetailLegacy to enterprise components"
```

---

## Task 2: Migrate ContactDetailLegacy to Enterprise Components

**Files:**
- Modify: `src/pages/dashboard/ContactDetailLegacy.tsx`
- Reference: `src/pages/dashboard/AccountDetail.tsx` (pattern to follow)
- Reference: `src/pages/dashboard/AccountDetailLegacy.tsx` (just refactored)

**Context:**
Similar to AccountDetailLegacy but for contacts. Has:
- Contact form (ContactForm component)
- Activities tab
- Segments display
- Email history

**Step 1: Update imports**

```tsx
// Remove:
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailScreenTemplate } from '@/components/system/DetailScreenTemplate';

// Add:
import {
  EnterpriseSheet,
  EnterpriseField,
  EnterpriseStatButton,
  EnterpriseFormLayout,
  EnterpriseNotebook,
  EnterpriseTab,
  EnterpriseActivityFeed,
  EnterpriseCard,
  EnterpriseTable,
  type Column
} from '@/components/ui/enterprise';
```

**Step 2: Replace layout with EnterpriseFormLayout**

```tsx
<EnterpriseFormLayout
  breadcrumbs={[
    { label: 'Contacts', to: '/contacts' },
    { label: contact?.first_name ? `${contact.first_name} ${contact.last_name}` : 'Loading...' }
  ]}
  title={contact?.first_name ? `${contact.first_name} ${contact.last_name}` : 'Contact'}
  actions={
    <div className="flex gap-2">
      <Button onClick={() => setIsEditing(true)} variant="outline">
        <Edit className="h-4 w-4 mr-2" />
        Edit
      </Button>
      <Button onClick={() => setShowDeleteDialog(true)} variant="destructive">
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </Button>
    </div>
  }
>
  {/* Main content */}
</EnterpriseFormLayout>
```

**Step 3: Replace Tabs with EnterpriseNotebook**

```tsx
<EnterpriseSheet>
  <EnterpriseNotebook>
    <EnterpriseTab label="Details" value="tab1">
      {/* Contact details and form */}
    </EnterpriseTab>
    <EnterpriseTab label="Account" value="tab2">
      {/* Linked account */}
    </EnterpriseTab>
    <EnterpriseTab label="Activities" value="tab3">
      {/* Activities table */}
    </EnterpriseTab>
    {/* more tabs if needed */}
  </EnterpriseNotebook>
</EnterpriseSheet>
<EnterpriseActivityFeed />
```

**Step 4: Replace Card sections with EnterpriseCard**

For segments, account link, etc.:

```tsx
<EnterpriseCard
  title="Active Segments"
  description={`${activeSegments.length} segments`}
>
  <div className="flex flex-wrap gap-2">
    {activeSegments.map((segment) => (
      <Badge key={segment.id}>{segment.name}</Badge>
    ))}
  </div>
</EnterpriseCard>
```

**Step 5: Use EnterpriseTable for activities**

```tsx
const activityColumns: Column<any>[] = [
  { key: 'type', label: 'Type', width: '100px' },
  { key: 'description', label: 'Description', width: '300px' },
  { key: 'created_at', label: 'Date', width: '150px', render: (value) => format(new Date(value), 'MMM d, yyyy') },
];

<EnterpriseCard title="Activities">
  <EnterpriseTable
    columns={activityColumns}
    data={activities}
    rowKey={(row) => row.id}
    emptyState={<p className="text-center py-8">No activities</p>}
  />
</EnterpriseCard>
```

**Step 6: Keep all existing functionality**

- All state management stays the same
- All data fetching stays the same
- ContactForm component stays the same
- Email history panel stays the same
- Just replace the visual containers

**Step 7: Test the changes**

Navigate to a contact detail page and verify:
- ✅ Page loads and displays contact data
- ✅ All tabs work correctly
- ✅ Contact form renders and works
- ✅ Activities display in table format
- ✅ Segments display correctly
- ✅ Email history works
- ✅ Delete/update functionality works
- ✅ Navigation works (breadcrumbs, back button)

**Step 8: Commit**

```bash
git add src/pages/dashboard/ContactDetailLegacy.tsx
git commit -m "refactor(crm): migrate ContactDetailLegacy to enterprise components"
```

---

## Task 3: Verify Migration and Update Type Checking

**Files:**
- Verify: `src/pages/dashboard/AccountDetailLegacy.tsx`
- Verify: `src/pages/dashboard/ContactDetailLegacy.tsx`
- Check: All enterprise component imports work

**Step 1: Run TypeScript type checking**

```bash
npm run typecheck
```

Expected: No TypeScript errors

**Step 2: Run the dev server and test both pages**

```bash
npm run dev
```

Navigate to:
- Account detail page → verify it loads and displays correctly
- Contact detail page → verify it loads and displays correctly
- Test all tabs, forms, and interactions

**Step 3: Verify no console errors**

Check browser console for any errors. All data should load correctly.

**Step 4: Commit verification**

If everything passes:

```bash
git add .
git commit -m "chore(crm): verify legacy page migration - all tests pass"
```

---

## Success Criteria

✅ Both legacy pages migrated to enterprise components
✅ All existing functionality preserved (data fetching, forms, activities, delete)
✅ Visual presentation matches refactored AccountDetail/ContactDetail
✅ TypeScript type checking passes with zero errors
✅ All pages load and render correctly
✅ All user interactions work (tabs, forms, navigation, delete)
✅ No console errors
✅ 3 clean git commits

---

## Notes

- The "Legacy" naming suggests these were older implementations. After migration, you may want to:
  - Rename AccountDetailLegacy.tsx back to AccountDetail.tsx if it's the primary version
  - Or keep both if the new one (AccountDetail.tsx) is the official version
  - Update routing to point to the correct version

- All data structure, forms, and business logic remain unchanged - this is purely a UI layer refactoring

- The EnterpriseActivityFeed component is currently a placeholder with mock data. If you need real activity data, wire it to the actual activities data fetching functions

---
