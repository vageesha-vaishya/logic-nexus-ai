# How to Use the AMRO Work Package Creation Wizard

**Date:** 2026-04-12  
**Component:** `AmroWorkPackageCreateWizard`  
**Location:** `src/features/module-amro/components/work-orders/AmroWorkPackageCreateWizard.tsx`

---

## 🎯 Quick Start (3 Steps)

### Step 1: Import the Wizard

```typescript
import { AmroWorkPackageCreateWizard } from '@/features/module-amro/components/work-orders';
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
<AmroWorkPackageCreateWizard
  open={wizardOpen}
  onOpenChange={setWizardOpen}
  onSuccess={() => {
    // Refresh your data after successful creation
    refetchWorkPackages();
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
<AddWorkPackageDialog
  aircraftWorkPackageDialogOpen={aircraftWorkPackageDialogOpen}
  setAircraftWorkPackageDialogOpen={setAircraftWorkPackageDialogOpen}
  aircraftWorkPackageActiveTab={aircraftWorkPackageActiveTab}
  setAircraftWorkPackageActiveTab={setAircraftWorkPackageActiveTab}
  // ... 30+ props
/>
```

**New Code:**
```typescript
<AmroWorkPackageCreateWizard
  open={aircraftWorkPackageDialogOpen}
  onOpenChange={(isOpen) => {
    setAircraftWorkPackageDialogOpen(isOpen);
    if (!isOpen) {
      // Reset all form state when closing
      resetAircraftWorkPackageForm();
    }
  }}
  onSuccess={() => {
    // Refresh aircraft work package list
    loadWorkPackageTemplateRegistry();
    toast.success('Work package created successfully');
  }}
/>
```

**Changes Needed:**
1. Replace `<AddWorkPackageDialog>` with `<AmroWorkPackageCreateWizard>`
2. Simplify props from 30+ to just 3 (`open`, `onOpenChange`, `onSuccess`)
3. Remove all the old form state management (it's now internal to the wizard)
4. Delete unused state variables (see cleanup list below)

---

### Scenario 2: Use in Aircraft Detail Page

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { AmroWorkPackageCreateWizard } from '@/features/module-amro/components/work-orders';
import { toast } from 'sonner';

function AircraftDetailPage({ aircraftId }: { aircraftId: string }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  
  const handleSuccess = () => {
    // Refresh work packages for this aircraft
    refetchWorkPackages(aircraftId);
    toast.success('Work package created successfully');
  };

  return (
    <div>
      {/* Your aircraft detail content */}
      
      <Button onClick={() => setWizardOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Work Package
      </Button>

      <AmroWorkPackageCreateWizard
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
import { AmroWorkPackageCreateWizard } from '@/features/module-amro/components/work-orders';
import { useListWorkPackages } from '@/features/module-amro/components/work-orders/useWorkPackageState';
import { toast } from 'sonner';

function WorkOrdersListPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const { refetch } = useListWorkPackages();

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

      <AmroWorkPackageCreateWizard
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

export function AmroWorkPackageCreateWizard({ 
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
<AmroWorkPackageCreateWizard
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
import { AddWorkPackageDialog } from './amro-settings-master-data/components/AddWorkPackageDialog';
```

**Add:**
```typescript
import { AmroWorkPackageCreateWizard } from '@/features/module-amro/components/work-orders';
```

---

### 2. Simplify State Management

**Remove These State Variables (No longer needed):**
```typescript
// DELETE all these:
const [aircraftWorkPackageActiveTab, setAircraftWorkPackageActiveTab] = useState(...);
const [aircraftWorkPackageValues, setAircraftWorkPackageValues] = useState(...);
const [aircraftWorkPackageErrors, setAircraftWorkPackageErrors] = useState(...);
const [selectedWorkPackageTemplateId, setSelectedWorkPackageTemplateId] = useState(...);
const [aircraftWorkPackagePagedTasks, setAircraftWorkPackagePagedTasks] = useState(...);
const [aircraftWorkPackageSelectedTaskIds, setAircraftWorkPackageSelectedTaskIds] = useState(...);
const [aircraftWorkPackageTaskSort, setAircraftWorkPackageTaskSort] = useState(...);
const [aircraftWorkPackageTaskPage, setAircraftWorkPackageTaskPage] = useState(...);
const [aircraftWorkPackageTaskTotalPages, setAircraftWorkPackageTaskTotalPages] = useState(...);
const [aircraftSelectedExistingWorkPackageId, setAircraftSelectedExistingWorkPackageId] = useState(...);
const [aircraftExistingWorkPackages, setAircraftExistingWorkPackages] = useState(...);
const [aircraftExistingWorkPackagesError, setAircraftExistingWorkPackagesError] = useState(...);
const [aircraftExistingWorkPackagesLoading, setAircraftExistingWorkPackagesLoading] = useState(...);
const [aircraftTaskGridFilteredRows, setAircraftTaskGridFilteredRows] = useState(...);
const [aircraftWorkPackageSubmitting, setAircraftWorkPackageSubmitting] = useState(...);
const [aircraftTemplateAssociatedTasks, setAircraftTemplateAssociatedTasks] = useState(...);
const [aircraftTemplateAssociatedTasksLoading, setAircraftTemplateAssociatedTasksLoading] = useState(...);
const [aircraftTemplateAssociatedTasksError, setAircraftTemplateAssociatedTasksError] = useState(...);
```

**Keep:**
```typescript
const [aircraftWorkPackageDialogOpen, setAircraftWorkPackageDialogOpen] = useState(false);
```

---

### 3. Remove Old Handlers

**Delete these functions:**
```typescript
// DELETE:
const handleOpenWorkPackageCreateDialog
const setAircraftWorkPackageField
const handleAircraftWorkPackageTemplateSelect
const handleAircraftWorkPackageTaskSelection
const handleApplyExistingWorkPackageSelection
const handleAircraftWorkPackageSubmit
const loadWorkPackageTemplateRegistry
// And all related functions
```

---

### 4. Replace Dialog Component

**Old (Line ~9244):**
```typescript
<AddWorkPackageDialog
  aircraftWorkPackageDialogOpen={aircraftWorkPackageDialogOpen}
  setAircraftWorkPackageDialogOpen={setAircraftWorkPackageDialogOpen}
  aircraftWorkPackageActiveTab={aircraftWorkPackageActiveTab}
  setAircraftWorkPackageActiveTab={setAircraftWorkPackageActiveTab}
  aircraftWorkPackageValues={aircraftWorkPackageValues}
  aircraftWorkPackageErrors={aircraftWorkPackageErrors}
  setAircraftWorkPackageField={setAircraftWorkPackageField}
  selectedWorkPackageTemplateId={selectedWorkPackageTemplateId}
  handleAircraftWorkPackageTemplateSelect={handleAircraftWorkPackageTemplateSelect}
  workPackageTemplateRegistryLoading={workPackageTemplateRegistryLoading}
  workPackageTemplateRegistry={workPackageTemplateRegistry}
  workPackageTemplateRegistryError={workPackageTemplateRegistryError}
  selectedWorkPackageTemplate={selectedWorkPackageTemplate}
  aircraftWorkPackagePagedTasks={aircraftWorkPackagePagedTasks}
  aircraftWorkPackageSelectedTaskIds={aircraftWorkPackageSelectedTaskIds}
  handleAircraftWorkPackageTaskSelection={handleAircraftWorkPackageTaskSelection}
  setAircraftWorkPackageSelectedTaskIds={setAircraftWorkPackageSelectedTaskIds}
  aircraftWorkPackageTaskSort={aircraftWorkPackageTaskSort}
  setAircraftWorkPackageTaskSort={setAircraftWorkPackageTaskSort}
  setAircraftWorkPackageTaskSortDirection={setAircraftWorkPackageTaskSortDirection}
  aircraftWorkPackageTaskPage={aircraftWorkPackageTaskPage}
  setAircraftWorkPackageTaskPage={setAircraftWorkPackageTaskPage}
  aircraftWorkPackageTaskTotalPages={aircraftWorkPackageTaskTotalPages}
  loadWorkPackageTemplateRegistry={loadWorkPackageTemplateRegistry}
  aircraftSelectedExistingWorkPackageId={aircraftSelectedExistingWorkPackageId}
  setAircraftSelectedExistingWorkPackageId={setAircraftSelectedExistingWorkPackageId}
  aircraftExistingWorkPackagesError={aircraftExistingWorkPackagesError}
  aircraftExistingWorkPackagesLoading={aircraftExistingWorkPackagesLoading}
  aircraftExistingWorkPackageList={aircraftExistingWorkPackageList}
  handleApplyExistingWorkPackageSelection={handleApplyExistingWorkPackageSelection}
  aircraftTaskGridFilteredRows={aircraftTaskGridFilteredRows}
  aircraftWorkPackageSubmitting={aircraftWorkPackageSubmitting}
  handleAircraftWorkPackageSubmit={handleAircraftWorkPackageSubmit}
  canCreateWorkPackageFromTemplate={canCreateWorkPackageFromTemplate}
  associatedTemplateTasks={aircraftTemplateAssociatedTasks}
  associatedTemplateTasksLoading={aircraftTemplateAssociatedTasksLoading}
  associatedTemplateTasksError={aircraftTemplateAssociatedTasksError}
/>
```

**New:**
```typescript
<AmroWorkPackageCreateWizard
  open={aircraftWorkPackageDialogOpen}
  onOpenChange={(isOpen) => {
    setAircraftWorkPackageDialogOpen(isOpen);
    if (!isOpen) {
      // Optional: Reset any parent state
      console.log('Wizard closed');
    }
  }}
  onSuccess={() => {
    // Refresh your data
    loadWorkPackageTemplateRegistry();
    toast.success('Work package created successfully');
  }}
/>
```

---

### 5. Update Open Dialog Handler

**Old:**
```typescript
const handleOpenWorkPackageCreateDialog = useCallback(() => {
  // Reset all state
  setAircraftWorkPackageActiveTab('selected-task');
  setAircraftWorkPackageValues({...});
  setAircraftWorkPackageErrors({});
  setSelectedWorkPackageTemplateId('');
  setAircraftWorkPackageSelectedTaskIds([]);
  // ... 20+ lines of state reset
  
  setAircraftWorkPackageDialogOpen(true);
  trackWorkPackageTemplateAdoption('dialog_opened', {...});
}, [/* 10+ dependencies */]);
```

**New:**
```typescript
const handleOpenWorkPackageCreateDialog = useCallback(() => {
  setAircraftWorkPackageDialogOpen(true);
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
  <AmroWorkPackageCreateWizard
    open={aircraftWorkPackageDialogOpen}
    onOpenChange={setAircraftWorkPackageDialogOpen}
    onSuccess={handleSuccess}
  />
) : (
  <AddWorkPackageDialog {/* old props */} />
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

- [ ] Import `AmroWorkPackageCreateWizard`
- [ ] Add `wizardOpen` state
- [ ] Replace `<AddWorkPackageDialog>` with `<AmroWorkPackageCreateWizard>`
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
<AmroWorkPackageCreateWizard
  open={wizardOpen}
  onOpenChange={(isOpen) => {
    setWizardOpen(isOpen);
    if (isOpen) {
      analytics.track('work_package_creation_started');
    }
  }}
  onSuccess={() => {
    analytics.track('work_package_created');
    refetch();
  }}
/>
```

### 2. Add Error Boundary
```typescript
<ErrorBoundary fallback={<div>Failed to load wizard</div>}>
  <AmroWorkPackageCreateWizard
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

<AmroWorkPackageCreateWizard
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
