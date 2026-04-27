# Where to Find the Work Package Creation Wizard in the UI

**Date:** 2026-04-12  
**Status:** Integration Guide

---

## 🎯 Exact UI Location

The wizard is triggered from the **Aircraft Master Data Page** in the AMRO Settings.

### Navigation Path
```
Dashboard → AMRO → Settings → Master Data → Aircraft
```

---

## 📍 Visual Location Guide

### Step 1: Navigate to Aircraft Page
```
┌─────────────────────────────────────────────────────────┐
│  AMRO Dashboard                                         │
├─────────────────────────────────────────────────────────┤
│  Sidebar:                                               │
│  ├─ Overview                                            │
│  ├─ Work Orders                                         │
│  ├─ Parts Inventory                                     │
│  └─ Settings ▼                                          │
│      ├─ Master Data ▼                                   │
│      │   ├─ ✈️ Aircraft ← YOU ARE HERE                 │
│      │   ├─ Templates                                   │
│      │   └─ ...                                         │
└─────────────────────────────────────────────────────────┘
```

### Step 2: Select an Aircraft
```
┌─────────────────────────────────────────────────────────┐
│  Aircraft Master Data                                   │
├─────────────────────────────────────────────────────────┤
│  [Search aircraft...] [Status: All ▼]                   │
├─────────────────────────────────────────────────────────┤
│  ✈️ VT-ABC - Boeing 737-800 ← Click to select          │
│  ✈️ VT-DEF - Airbus A320neo                            │
│  ✈️ VT-GHI - Boeing 787-9                              │
└─────────────────────────────────────────────────────────┘
```

### Step 3: Click "Create Work Package" Button
```
┌─────────────────────────────────────────────────────────┐
│  Aircraft: VT-ABC - Boeing 737-800                      │
├─────────────────────────────────────────────────────────┤
│  [📋 Create Work Package] ← CLICK THIS BUTTON!          │
│  [👁️ View Logs]                                         │
│  [➕ Add Log]                                            │
│  [✏️ Edit Aircraft]                                      │
└─────────────────────────────────────────────────────────┘
```

### Step 4: Wizard Opens!
```
┌────────────────────────────────────────────┐
│ ➕ Create Work Package               [✕]   │
├────────────────────────────────────────────┤
│ ①━━━②━━━③━━━④                              │
│                                            │
│ Select Aircraft *                          │
│ [VT-ABC - Boeing 737-800 ▼]               │
│                                            │
│ Creation Path *                            │
│ ┌────────────────────────────────────┐    │
│ │ 📅 Scheduled Maintenance           │    │
│ │ Based on approved templates        │    │
│ └────────────────────────────────────┘    │
│ ┌────────────────────────────────────┐    │
│ │ ⚠️  Non-Scheduled                  │    │
│ │ Pilot reports, inspection findings │    │
│ └────────────────────────────────────┘    │
│ ┌────────────────────────────────────┐    │
│ │ 🛡️ Emergency / AOG                 │    │
│ │ Rapid response for AOG situations  │    │
│ └────────────────────────────────────┘    │
│                                            │
│               [Cancel]      [Next →]      │
└────────────────────────────────────────────┘
```

---

## 🔘 Exact Button Location (Code Reference)

**File:** `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`  
**Line:** ~7134-7143

```typescript
const aircraftStatusPaletteActions = useMemo<AircraftPaletteAction[]>(
  () => [
    {
      id: 'create-work-order',
      label: 'Create Work Package',  // ← THIS BUTTON
      icon: <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />,
      group: 'primary',
      variant: 'default',
      permission: 'create_maintenance_request',
      onAction: async () => {
        openAircraftWorkOrderDialog(); // ← OPENS DIALOG
      },
    },
    // ... more actions
  ],
);
```

---

## 🗺️ Complete User Journey

### Scenario 1: Creating Scheduled Work Package

```
1. User navigates to:
   Dashboard → AMRO → Settings → Master Data → Aircraft

2. User selects aircraft "VT-ABC" from the list

3. User sees action buttons panel:
   ┌────────────────────────────────────────┐
   │ [📋 Create Work Package] ← Click here │
   │ [👁️ View Logs]                         │
   │ [➕ Add Log]                            │
   └────────────────────────────────────────┘

4. Dialog opens with aircraft pre-selected

5. User selects "Scheduled Maintenance" card

6. User selects template: "A-Check Template v2.1"

7. User clicks "Next"

8. User fills details:
   - Title: "400 Hour Inspection"
   - Start Date: April 15, 2026
   - End Date: April 17, 2026
   - Station: DEL

9. User clicks "Next"

10. User selects tasks from template (8 of 12)

11. User clicks "Next"

12. User reviews all details

13. User clicks "Create Work Package"

14. ✅ Success! Work package created.
```

---

## 🎨 Visual Button Appearance

The button appears in the **Aircraft Action Palette** with these characteristics:

**Button Style:**
- **Icon:** CheckSquare (✓ in a box)
- **Label:** "Create Work Package"
- **Group:** Primary (highlighted)
- **Variant:** Default (colored, not outline)
- **Permission:** Requires `create_maintenance_request`

**Visual Representation:**
```
┌──────────────────────────────────────┐
│ ✓ Create Work Package                │ ← Primary button, colored
├──────────────────────────────────────┤
│ 👁️ View Logs                         │ ← Secondary button
│ ➕ Add Log                            │ ← Secondary button
│ ✏️ Edit Aircraft                      │ ← Secondary button
└──────────────────────────────────────┘
```

---

## 📍 Alternative Entry Points

### Option 2: From Aircraft Sub-Module Page

**Navigation:**
```
Dashboard → AMRO → Aircraft → List
```

**Button Location:**
- In the aircraft card actions menu
- Usually under "⋮" (more options) dropdown
- Look for "Create Work Package" option

### Option 3: From Work Orders Page (Future)

**Planned Location:**
```
Dashboard → AMRO → Work Orders
```

**Button Location:**
- Top right corner of work orders list
- "`➕ Create Work Package`" button
- Will pre-select aircraft if coming from aircraft context

---

## 🔍 How to Find It (Quick Checklist)

- [ ] You're on the AMRO Settings page
- [ ] You've clicked "Master Data" in the sidebar
- [ ] You've selected "Aircraft" from master data options
- [ ] You see a list of aircraft (VT-ABC, VT-DEF, etc.)
- [ ] You've clicked on an aircraft to select it
- [ ] You see an action panel/buttons appear
- [ ] One button says "Create Work Package" with a checkmark icon
- [ ] **← CLICK THIS BUTTON!**

---

## 🚀 After Clicking the Button

### Current Behavior (Old Dialog)
```
Opens: AircraftWorkOrderCreateDialog
- 98.5vw width (entire screen)
- 5 confusing tabs
- 10-11px font (tiny)
- No aircraft selection
- Manual date entry
```

### New Behavior (After Integration)
```
Opens: AmroWorkOrderCreateWizard
- max-w-4xl (reasonable size)
- 4-step wizard
- 14px+ font (readable)
- Aircraft pre-selected
- Calendar date pickers
- Clear validation
- Action buttons
```

---

## 🛠️ Developer: How to Replace Old Dialog

**Current Code (Line ~9244):**
```typescript
<AddWorkOrderDialog
  aircraftWorkOrderDialogOpen={aircraftWorkOrderDialogOpen}
  setAircraftWorkOrderDialogOpen={setAircraftWorkOrderDialogOpen}
  // ... 30+ props
/>
```

**Replace With:**
```typescript
<AmroWorkOrderCreateWizard
  open={aircraftWorkOrderDialogOpen}
  onOpenChange={setAircraftWorkOrderDialogOpen}
  preselectedAircraftId={selectedAircraft?.id}
  onSuccess={() => {
    loadWorkOrderTemplateRegistry();
    toast.success('Work package created successfully');
  }}
/>
```

**The button stays the same!** Only the dialog component changes.

---

## 📊 Button Permission Requirements

To see the "Create Work Package" button, users need:

**Permission:** `create_maintenance_request`

**Check in Code:**
```typescript
const canCreateWorkOrder = hasPermission('create_maintenance_request');

// Button only shows if:
if (canCreateWorkOrder) {
  // Show button
}
```

---

## 🎯 Summary: Where to Click

**The Exact Button:**
1. **Page:** Aircraft Master Data
2. **Location:** Action buttons panel (usually top-right or sidebar)
3. **Text:** "Create Work Package"
4. **Icon:** ✓ (CheckSquare)
5. **Color:** Primary (colored, not gray)
6. **Action:** Opens the wizard dialog

**Visual Cue:**
Look for this button among the aircraft actions:
```
[📋 Create Work Package] ← This is the one!
```

---

## 📞 Can't Find It?

### Troubleshooting

**Button Not Visible?**
1. Check permissions: Do you have `create_maintenance_request`?
2. Is an aircraft selected? (Button may require selection)
3. Try refreshing the page
4. Check browser console for errors

**Old Dialog Opens?**
- The integration hasn't been completed yet
- Currently shows `AircraftWorkOrderCreateDialog`
- After integration, will show `AmroWorkOrderCreateWizard`

**Need Access?**
- Contact your AMRO administrator
- Request `create_maintenance_request` permission
- Ensure you're in the correct tenant/franchise

---

**Last Updated:** 2026-04-12  
**Status:** Button exists, wizard integration pending  
**Next:** Complete the integration in `AmroSettingsMasterDataPage.tsx`
