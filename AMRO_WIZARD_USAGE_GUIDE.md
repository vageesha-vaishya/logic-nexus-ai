# How to Use the AMRO Work Package Creation Wizard

**Date:** 2026-04-12  
**Component:** `AmroWorkOrderCreateWizard`  
**Location:** `src/features/module-amro/components/work-orders/AmroWorkOrderCreateWizard.tsx`

---

## 🎯 Quick Start (3 Steps)

### Step 1: Import the Wizard

```typescript
import { AmroWorkOrderCreateWizard } from '@/features/module-amro/components/work-orders';
```

### Step 2: Add State Management

```typescript
const [wizardOpen, setWizardOpen] = useState(false);
```

### Step 3: Add to Your Component

```typescript
// Trigger button
<Button onClick={() => setWizardOpen(true)}>
  <Plus className="mr-2 h-4 w-4" />
  Create Work Package
</Button>

// Wizard component
<AmroWorkOrderCreateWizard
  open={wizardOpen}
  onOpenChange={setWizardOpen}
  onSuccess={() => {
    // Refresh your data after successful creation
    refetchWorkOrders();
    toast.success('Work package created successfully');
  }}
/>
```

---

## 📍 Integration Scenarios

### Scenario 1: Replace Old Dialog in Settings Page (Recommended)

**File:** `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`

**Current Code (Line ~9244):**
```typescript
<AddWorkOrderDialog
  aircraftWorkOrderDialogOpen={aircraftWorkOrderDialogOpen}
  setAircraftWorkOrderDialogOpen={setAircraftWorkOrderDialogOpen}
  aircraftWorkOrderActiveTab={aircraftWorkOrderActiveTab}
  setAircraftWorkOrderActiveTab={setAircraftWorkOrderActiveTab}
  // ... 30+ props
/>
```

**New Code:**
```typescript
<AmroWorkOrderCreateWizard
  open={aircraftWorkOrderDialogOpen}
  onOpenChange={(isOpen) => {
    setAircraftWorkOrderDialogOpen(isOpen);
    if (!isOpen) {
      // Reset all form state when closing
      resetAircraftWorkOrderForm();
    }
  }}
  onSuccess={() => {
    // Refresh aircraft work package list
    loadWorkOrderTemplateRegistry();
    toast.success('Work package created successfully');
  }}
/>
```

**Changes Needed:**
1. Replace `<AddWorkOrderDialog>` with `<AmroWorkOrderCreateWizard>`
2. Simplify props from 30+ to just 3 (`open`, `onOpenChange`, `onSuccess`)
3. Remove all the old form state management (it's now internal to the wizard)
4. Delete unused state variables (see cleanup list below)

---

### Scenario 2: Use in Aircraft Detail Page

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AmroWorkOrderCreateWizard } from '@/features/module-amro/components/work-orders';
import { toast } from 'sonner';

function AircraftDetailPage({ aircraftId }: { aircraftId: string }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  
  const handleSuccess = () => {
    // Refresh work packages for this aircraft
    refetchWorkOrders(aircraftId);
    toast.success('Work package created successfully');
  };

  return (
    <div>
      {/* Your aircraft detail content */}
      
      <Button onClick={() => setWizardOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Work Package
      </Button>

      <AmroWorkOrderCreateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
```

---

### Scenario 3: Use in Work Orders List Page

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AmroWorkOrderCreateWizard } from '@/features/module-amro/components/work-orders';
import { useListWorkOrders } from '@/features/module-amro/components/work-orders/useWorkOrderState';
import { toast } from 'sonner';

function WorkOrdersListPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { refetch } = useListWorkOrders();

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1>Work Orders</h1>
        <Button onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Work Package
        </Button>
      </div>

      {/* Your work orders list */}

      <AmroWorkOrderCreateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSuccess={() => {
          refetch();
          toast.success('Work package created!');
        }}
      />
    </>
  );
}
```

---

### Scenario 4: Pre-select Aircraft (Advanced)

If you want to pre-select an aircraft when opening from aircraft detail page:

**Modified Wizard Props (Add to component):**
```typescript
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedAircraftId?: string; // NEW
};

export function AmroWorkOrderCreateWizard({ 
  open, 
  onOpenChange, 
  onSuccess,
  preselectedAircraftId 
}: Props) {
  const [formData, setFormData] = useState<WizardFormData>({
    ...DEFAULT_FORM_DATA,
    aircraftId: preselectedAircraftId || '', // Use preselected
  });

  // Rest of component...
}
```

**Usage:**
```typescript
<AmroWorkOrderCreateWizard
  open={wizardOpen}
  onOpenChange={setWizardOpen}
  onSuccess={handleSuccess}
  preselectedAircraftId={aircraftId} // Pre-fill aircraft
/>
```

---

## 🔧 Complete Migration Guide (Settings Page)

### 1. Update Import

**Remove:**
```typescript
import { AddWorkOrderDialog } from './amro-settings-master-data/components/AddWorkOrderDialog';
```

**Add:**
```typescript
import { AmroWorkOrderCreateWizard } from '@/features/module-amro/components/work-orders';
```

---

### 2. Simplify State Management

**Remove These State Variables (No longer needed):**
```typescript
// DELETE all these:
const [aircraftWorkOrderActiveTab, setAircraftWorkOrderActiveTab] = useState(...);
const [aircraftWorkOrderValues, setAircraftWorkOrderValues] = useState(...);
const [aircraftWorkOrderErrors, setAircraftWorkOrderErrors] = useState(...);
const [selectedWorkOrderTemplateId, setSelectedWorkOrderTemplateId] = useState(...);
const [aircraftWorkOrderPagedTasks, setAircraftWorkOrderPagedTasks] = useState(...);
const [aircraftWorkOrderSelectedTaskIds, setAircraftWorkOrderSelectedTaskIds] = useState(...);
const [aircraftWorkOrderTaskSort, setAircraftWorkOrderTaskSort] = useState(...);
const [aircraftWorkOrderTaskPage, setAircraftWorkOrderTaskPage] = useState(...);
const [aircraftWorkOrderTaskTotalPages, setAircraftWorkOrderTaskTotalPages] = useState(...);
const [aircraftSelectedExistingWorkOrderId, setAircraftSelectedExistingWorkOrderId] = useState(...);
const [aircraftExistingWorkOrders, setAircraftExistingWorkOrders] = useState(...);
const [aircraftExistingWorkOrdersError, setAircraftExistingWorkOrdersError] = useState(...);
const [aircraftExistingWorkOrdersLoading, setAircraftExistingWorkOrdersLoading] = useState(...);
const [aircraftTaskGridFilteredRows, setAircraftTaskGridFilteredRows] = useState(...);
const [aircraftWorkOrderSubmitting, setAircraftWorkOrderSubmitting] = useState(...);
const [aircraftTemplateAssociatedTasks, setAircraftTemplateAssociatedTasks] = useState(...);
const [aircraftTemplateAssociatedTasksLoading, setAircraftTemplateAssociatedTasksLoading] = useState(...);
const [aircraftTemplateAssociatedTasksError, setAircraftTemplateAssociatedTasksError] = useState(...);
```

**Keep:**
```typescript
const [aircraftWorkOrderDialogOpen, setAircraftWorkOrderDialogOpen] = useState(false);
```

---

### 3. Remove Old Handlers

**Delete these functions:**
```typescript
// DELETE:
const handleOpenWorkOrderCreateDialog
const setAircraftWorkOrderField
const handleAircraftWorkOrderTemplateSelect
const handleAircraftWorkOrderTaskSelection
const handleApplyExistingWorkOrderSelection
const handleAircraftWorkOrderSubmit
const loadWorkOrderTemplateRegistry
// And all related functions
```

---

### 4. Replace Dialog Component

**Old (Line ~9244):**
```typescript
<AddWorkOrderDialog
  aircraftWorkOrderDialogOpen={aircraftWorkOrderDialogOpen}
  setAircraftWorkOrderDialogOpen={setAircraftWorkOrderDialogOpen}
  aircraftWorkOrderActiveTab={aircraftWorkOrderActiveTab}
  setAircraftWorkOrderActiveTab={setAircraftWorkOrderActiveTab}
  aircraftWorkOrderValues={aircraftWorkOrderValues}
  aircraftWorkOrderErrors={aircraftWorkOrderErrors}
  setAircraftWorkOrderField={setAircraftWorkOrderField}
  selectedWorkOrderTemplateId={selectedWorkOrderTemplateId}
  handleAircraftWorkOrderTemplateSelect={handleAircraftWorkOrderTemplateSelect}
  workOrderTemplateRegistryLoading={workOrderTemplateRegistryLoading}
  workOrderTemplateRegistry={workOrderTemplateRegistry}
  workOrderTemplateRegistryError={workOrderTemplateRegistryError}
  selectedWorkOrderTemplate={selectedWorkOrderTemplate}
  aircraftWorkOrderPagedTasks={aircraftWorkOrderPagedTasks}
  aircraftWorkOrderSelectedTaskIds={aircraftWorkOrderSelectedTaskIds}
  handleAircraftWorkOrderTaskSelection={handleAircraftWorkOrderTaskSelection}
  setAircraftWorkOrderSelectedTaskIds={setAircraftWorkOrderSelectedTaskIds}
  aircraftWorkOrderTaskSort={aircraftWorkOrderTaskSort}
  setAircraftWorkOrderTaskSort={setAircraftWorkOrderTaskSort}
  setAircraftWorkOrderTaskSortDirection={setAircraftWorkOrderTaskSortDirection}
  aircraftWorkOrderTaskPage={aircraftWorkOrderTaskPage}
  setAircraftWorkOrderTaskPage={setAircraftWorkOrderTaskPage}
  aircraftWorkOrderTaskTotalPages={aircraftWorkOrderTaskTotalPages}
  loadWorkOrderTemplateRegistry={loadWorkOrderTemplateRegistry}
  aircraftSelectedExistingWorkOrderId={aircraftSelectedExistingWorkOrderId}
  setAircraftSelectedExistingWorkOrderId={setAircraftSelectedExistingWorkOrderId}
  aircraftExistingWorkOrdersError={aircraftExistingWorkOrdersError}
  aircraftExistingWorkOrdersLoading={aircraftExistingWorkOrdersLoading}
  aircraftExistingWorkOrderList={aircraftExistingWorkOrderList}
  handleApplyExistingWorkOrderSelection={handleApplyExistingWorkOrderSelection}
  aircraftTaskGridFilteredRows={aircraftTaskGridFilteredRows}
  aircraftWorkOrderSubmitting={aircraftWorkOrderSubmitting}
  handleAircraftWorkOrderSubmit={handleAircraftWorkOrderSubmit}
  canCreateWorkOrderFromTemplate={canCreateWorkOrderFromTemplate}
  associatedTemplateTasks={aircraftTemplateAssociatedTasks}
  associatedTemplateTasksLoading={aircraftTemplateAssociatedTasksLoading}
  associatedTemplateTasksError={aircraftTemplateAssociatedTasksError}
/>
```

**New:**
```typescript
<AmroWorkOrderCreateWizard
  open={aircraftWorkOrderDialogOpen}
  onOpenChange={(isOpen) => {
    setAircraftWorkOrderDialogOpen(isOpen);
    if (!isOpen) {
      // Optional: Reset any parent state
      console.log('Wizard closed');
    }
  }}
  onSuccess={() => {
    // Refresh your data
    loadWorkOrderTemplateRegistry();
    toast.success('Work package created successfully');
  }}
/>
```

---

### 5. Update Open Dialog Handler

**Old:**
```typescript
const handleOpenWorkOrderCreateDialog = useCallback(() => {
  // Reset all state
  setAircraftWorkOrderActiveTab('selected-task');
  setAircraftWorkOrderValues({...});
  setAircraftWorkOrderErrors({});
  setSelectedWorkOrderTemplateId('');
  setAircraftWorkOrderSelectedTaskIds([]);
  // ... 20+ lines of state reset
  
  setAircraftWorkOrderDialogOpen(true);
  trackWorkOrderTemplateAdoption('dialog_opened', {...});
}, [/* 10+ dependencies */]);
```

**New:**
```typescript
const handleOpenWorkOrderCreateDialog = useCallback(() => {
  setAircraftWorkOrderDialogOpen(true);
  // Wizard handles all internal state management
}, []);
```

---

## 🎨 Wizard Props Reference

### Required Props

| Prop | Type | Description | Example |
|------|------|-------------|---------|
| `open` | `boolean` | Controls dialog visibility | `true` / `false` |
| `onOpenChange` | `(open: boolean) => void` | Called when dialog opens/closes | `setWizardOpen` |

### Optional Props

| Prop | Type | Description | Example |
|------|------|-------------|---------|
| `onSuccess` | `() => void` | Called after successful creation | `() => refetch()` |

---

## 🔄 Wizard Internal State (Managed Automatically)

The wizard manages all its own state internally:

✅ Aircraft selection  
✅ Creation path (Scheduled / Non-Scheduled / Emergency)  
✅ Template selection  
✅ Form validation  
✅ Error messages  
✅ Step navigation  
✅ Task selection  
✅ Date pickers  
✅ API mutations  

**You don't need to manage any of this!**

---

## 📋 Feature Flags (Optional)

If you want to rollout gradually, add feature flag:

**.env.local:**
```bash
VITE_AMRO_WP_WIZARD_ENABLED=true
```

**Settings Page:**
```typescript
const useNewWizard = process.env.VITE_AMRO_WP_WIZARD_ENABLED === 'true';

{useNewWizard ? (
  <AmroWorkOrderCreateWizard
    open={aircraftWorkOrderDialogOpen}
    onOpenChange={setAircraftWorkOrderDialogOpen}
    onSuccess={handleSuccess}
  />
) : (
  <AddWorkOrderDialog {/* old props */} />
)}
```

---

## 🧪 Testing Your Integration

### 1. Basic Functionality
```typescript
// Open wizard
click("Create Work Package");

// Verify step 1 appears
expect(screen.getByText("Select Aircraft")).toBeTruthy();
expect(screen.getByText("Creation Path")).toBeTruthy();

// Select aircraft
selectOption("Select an aircraft...", "VT-ABC");

// Select creation path
click("Scheduled Maintenance");

// Click Next
click("Next");

// Verify step 2
expect(screen.getByText("Title")).toBeTruthy();
```

### 2. Validation Testing
```typescript
// Try to proceed without required fields
click("Next");

// Should show error
expect(screen.getByText("Aircraft selection is required")).toBeTruthy();
```

### 3. Success Flow
```typescript
// Complete all steps
fillAircraftAndPath();
click("Next");

fillDetails();
click("Next");

selectTasks();
click("Next");

// Review and submit
expect(screen.getByText("Review Work Package")).toBeTruthy();
click("Create Work Package");

// Should call onSuccess
expect(onSuccessMock).toHaveBeenCalled();
```

---

## 🚀 Deployment Checklist

- [ ] Import `AmroWorkOrderCreateWizard`
- [ ] Add `wizardOpen` state
- [ ] Replace `<AddWorkOrderDialog>` with `<AmroWorkOrderCreateWizard>`
- [ ] Simplify props to 3 props max
- [ ] Remove old form state variables
- [ ] Remove old handler functions
- [ ] Test opening/closing wizard
- [ ] Test all 3 creation paths
- [ ] Test validation
- [ ] Test success callback
- [ ] Test cancel/reset
- [ ] Remove unused imports
- [ ] Run TypeScript check: `npm run typecheck`
- [ ] Run tests: `npm run test`
- [ ] Build check: `npm run build`

---

## 💡 Pro Tips

### 1. Add Analytics Tracking
```typescript
<AmroWorkOrderCreateWizard
  open={wizardOpen}
  onOpenChange={(isOpen) => {
    setWizardOpen(isOpen);
    if (isOpen) {
      analytics.track('work_order_creation_started');
    }
  }}
  onSuccess={() => {
    analytics.track('work_order_created');
    refetch();
  }}
/>
```

### 2. Add Error Boundary
```typescript
<ErrorBoundary fallback={<div>Failed to load wizard</div>}>
  <AmroWorkOrderCreateWizard
    open={wizardOpen}
    onOpenChange={setWizardOpen}
    onSuccess={handleSuccess}
  />
</ErrorBoundary>
```

### 3. Pre-select from URL
```typescript
// If user comes from aircraft detail page
const searchParams = useSearchParams();
const preselectedAircraft = searchParams.get('aircraft_id');

<AmroWorkOrderCreateWizard
  open={wizardOpen}
  onOpenChange={setWizardOpen}
  onSuccess={handleSuccess}
  preselectedAircraftId={preselectedAircraft || undefined}
/>
```

### 4. Keyboard Shortcut
```typescript
useHotkeys('ctrl+n', (e) => {
  e.preventDefault();
  setWizardOpen(true);
});
```

---

## 📞 Support

**Issues?** Check these files:
- `AMRO_WORK_PACKAGE_WIZARD_ENHANCEMENT.md` - Full enhancement documentation
- `AMRO_WORK_PACKAGE_UX_AUDIT.md` - Original UX audit
- `AMRO_UI_COMPONENTS_IMPLEMENTATION.md` - Design system reference

**Need Help?** The wizard is fully self-contained - just pass the 3 props and it works!

---

**Last Updated:** 2026-04-12  
**Status:** Production Ready  
**Next:** Integration testing and deployment
