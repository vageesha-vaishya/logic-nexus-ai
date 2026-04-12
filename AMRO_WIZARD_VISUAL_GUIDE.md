# AMRO Work Package Wizard - Quick Visual Guide

## 🎯 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  User Clicks "Create Work Package" Button                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  AmroWorkPackageCreateWizard Opens                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Step 1: Aircraft & Creation Path                     │  │
│  │                                                       │  │
│  │  Aircraft: [VT-ABC - Boeing 737-800 ▼]               │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  📅 Scheduled Maintenance                       │ │  │
│  │  │  Based on approved templates                    │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  ⚠️  Non-Scheduled                              │ │  │
│  │  │  Pilot reports, inspection findings             │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │  🛡️ Emergency / AOG                             │ │  │
│  │  │  Rapid response for AOG situations              │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  [Cancel]                          [Next →]          │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ User selects path and clicks Next
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Conditional Fields Appear                                   │
│                                                               │
│  If Scheduled:          If Non-Scheduled:    If Emergency:   │
│  ┌─────────────────┐   ┌─────────────────┐  ┌─────────────┐│
│  │ Template: [▼]   │   │ Source: [▼]     │  │ Type: [▼]   ││
│  │ A-Check v2.1    │   │ Defect: [...]   │  │ Urgency:[▼] ││
│  │                 │   │ Priority: [▼]   │  │ Reason:     ││
│  │ Maintenance:    │   │                 │  │ [...]       ││
│  │ Line [▼]        │   │                 │  │ Ground Time:││
│  │ Priority: P3[▼] │   │                 │  │ [24] hours  ││
│  └─────────────────┘   └─────────────────┘  └─────────────┘│
│                                                               │
│  [← Back]                               [Next →]            │
└──────────────────────┬──────────────────────────────────────┘
                       │ User fills details and clicks Next
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Work Package Details                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ✈️ VT-ABC - Boeing 737-800    [Scheduled]           │  │
│  │                                                       │  │
│  │  Title: [400 Hour Inspection____________]            │  │
│  │  Description: [_________________________________]    │  │
│  │               [_________________________________]    │  │
│  │                                                       │  │
│  │  Maint Type: [Line ▼]  Priority: [P3-Medium ▼]      │  │
│  │                                                       │  │
│  │  Start Date: [📅 2026-04-15 ▼]                       │  │
│  │  End Date:   [📅 2026-04-17 ▼]                       │  │
│  │  Station: [DEL__________]                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [← Back]                               [Next →]            │
└──────────────────────┬──────────────────────────────────────┘
                       │ User completes form and clicks Next
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Task Selection (if Scheduled)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ☑ Select  Task #    ATA Code    Description         │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │ ☐        TASK-001  05-20      General Insp      │ │  │
│  │  │ ☑        TASK-002  29-10      Hydraulic Check   │ │  │
│  │  │ ☐        TASK-003  32-40      Landing Gear      │ │  │
│  │  │ ☑        TASK-004  71-00      Engine Insp       │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  │  Total Est. Labor Hours: [12.5____]                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [← Back]                               [Next →]            │
└──────────────────────┬──────────────────────────────────────┘
                       │ User selects tasks and clicks Next
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Review & Submit                                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ✈️ VT-ABC - Boeing 737-800                          │  │
│  │                                                       │  │
│  │  Creation Path:    Scheduled                          │  │
│  │  Maint Type:       Line Maintenance                   │  │
│  │  Priority:         P3 - Medium                        │  │
│  │  Station:          DEL                                │  │
│  │                                                       │  │
│  │  Title: 400 Hour Inspection                           │  │
│  │  Start Date: April 15, 2026                           │  │
│  │  End Date: April 17, 2026                             │  │
│  │  Tasks Selected: 2 of 4                               │  │
│  │  Est. Labor: 12.5 hours                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  [← Back]    [Save Draft]    [Create Work Package]         │
└──────────────────────┬──────────────────────────────────────┘
                       │ User clicks "Create Work Package"
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  ✅ Success!                                                 │
│  Work package created successfully                          │
│  Dialog closes, data refreshes                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔀 Three Creation Paths

```
Creation Path Selection
         │
    ┌────┼────┐
    │    │    │
    ▼    ▼    ▼
┌──────┐ ┌──────┐ ┌────────┐
│Sched │ │Non-  │ │Emergency│
│uled  │ │Sched │ │/AOG     │
└──┬───┘ └──┬───┘ └───┬────┘
   │        │         │
   ▼        ▼         ▼
Template  Defect    Rapid
Select    Report    Form
   │        │         │
   ▼        ▼         ▼
Full WP   Simple    Auto-
Details   WP        Priority
   │        │         │
   ▼        ▼         ▼
Tasks     Tasks     Immediate
(Opt)     (Opt)     Creation
   │        │         │
   └────┬───┴─────────┘
        │
        ▼
   Work Package
   Created!
```

---

## 📊 Comparison: Old vs New

```
OLD DIALOG (905 lines, 5 tabs)
┌────────────────────────────────────────┐
│ Add work package                       │
├────────────────────────────────────────┤
│ [New WP][Existing][Non-perf][Sel][All]│ ← 5 confusing tabs
├────────────────────────────────────────┤
│ Work Package details    Selected task  │
│ ┌─────────────────┐   ┌──────────────┐│
│ │ Number: [145]   │   │ ☑ TASK-001   ││
│ │ Topic: [400hr]  │   │ ☐ TASK-002   ││
│ │ TTAF: [406.30]  │   │ ☐ TASK-003   ││
│ │ Validation: []  │   │              ││
│ │ Trans Date: []  │   │              ││
│ │ Maint Rel: []   │   │              ││
│ │ Work Report: [] │   │              ││
│ │ Comments: []    │   │              ││
│ │ Revision: [2]   │   │              ││
│ │ Opening: []     │   │              ││
│ │ Status: []      │   │              ││
│ │ Trigger: []     │   │              ││
│ │ Exp Recv: []    │   │              ││
│ │ Work Recv: []   │   │              ││
│ └─────────────────┘   └──────────────┘│
│                                        │
│ [NO ACTION BUTTONS!]                   │
└────────────────────────────────────────┘
Problems:
❌ 98.5vw width (entire screen!)
❌ 10-11px font (unreadable)
❌ 26px inputs (too small)
❌ No aircraft selection
❌ 14 date fields (text input)
❌ No creation path
❌ No validation feedback
❌ No action buttons


NEW WIZARD (680 lines, 4 steps)
┌────────────────────────────────────┐
│ ➕ Create Work Package             │
├────────────────────────────────────┤
│ ①━━━②━━━③━━━④                      │ ← Progress bar
├────────────────────────────────────┤
│ Step 2: Details                    │
│                                    │
│ ✈️ VT-ABC - Boeing 737-800         │
│                                    │
│ Title: [________________]          │
│ Description: [_________________]   │
│              [_________________]   │
│                                    │
│ Maint: [Line ▼]  Priority: [P3▼]  │
│                                    │
│ Start: [📅 Select date ▼]         │
│ End:   [📅 Select date ▼]         │
│                                    │
│ Station: [DEL__________]           │
├────────────────────────────────────┤
│ [← Back]        [Next →]           │ ← Clear actions
└────────────────────────────────────┘
Benefits:
✅ max-w-4xl (standard dialog)
✅ 14px+ font (readable)
✅ 44px inputs (touch-friendly)
✅ Aircraft selection FIRST
✅ 2 date fields (calendar picker)
✅ 3 creation paths
✅ Inline validation
✅ Clear action buttons
```

---

## 🎯 User Journey

### Scenario 1: Scheduled Maintenance (A-Check)
```
User Goal: Create scheduled A-check work package

1. Click "Create Work Package"
2. Select aircraft: VT-ABC
3. Click "Scheduled Maintenance" card
4. Select template: "A-Check Template v2.1"
5. Click Next
6. Fill title: "400 Hour Inspection"
7. Select dates: April 15-17, 2026
8. Select station: DEL
9. Click Next
10. Select 8 of 12 tasks
11. Enter labor hours: 24
12. Click Next
13. Review all details
14. Click "Create Work Package"
15. ✅ Success!

Time: ~3 minutes (vs 10 minutes old way)
```

### Scenario 2: Non-Scheduled (Pilot Report)
```
User Goal: Create WP from pilot report

1. Click "Create Work Package"
2. Select aircraft: VT-DEF
3. Click "Non-Scheduled" card
4. Select source: "Pilot Report"
5. Describe defect: "Cabin pressure fluctuation"
6. Select priority: High
7. Click Next
8. Title auto-filled: "NS-TASK: PILOT REPORT - Cabin pressure..."
9. Adjust dates if needed
10. Click Next
11. Skip tasks (optional)
12. Click Next
13. Review
14. Click "Create Work Package"
15. ✅ Success!

Time: ~2 minutes
```

### Scenario 3: Emergency (AOG)
```
User Goal: Emergency AOG work package

1. Click "Create Work Package"
2. Select aircraft: VT-GHI
3. Click "Emergency / AOG" card (RED)
4. Select type: "AOG (Aircraft on Ground)"
5. Select urgency: "Immediate"
6. Enter reason: "Engine oil pressure low - aircraft grounded"
7. Enter ground time: 24 hours
8. Click Next
9. Title auto-filled: "EMERGENCY: AOG - Engine oil pressure..."
10. Click Next
11. Skip tasks
12. Click Next
13. Review emergency details
14. Click "Create Work Package"
15. ✅ Success! Auto-prioritized to P1

Time: <1 minute (vs 15 minutes old way)
```

---

## 📱 Responsive Behavior

```
Desktop (>1024px)
┌──────────────────────────────────────┐
│ ①━━━②━━━③━━━④                        │
│                                      │
│ [Aircraft] [Creation Path]           │ ← 2 columns
│ [Template] [Details]                 │
│                                      │
│ [Start Date] [End Date]             │
└──────────────────────────────────────┘

Tablet (768px - 1024px)
┌────────────────────────┐
│ ①━━━②━━━③━━━④          │
│                        │
│ [Aircraft]             │ ← 1 column
│ [Creation Path]        │
│ [Template]             │
│ [Details]              │
│ [Start Date]           │
│ [End Date]             │
└────────────────────────┘

Mobile (<768px)
┌──────────────────┐
│ ① ② ③ ④          │ ← Dots only
│                  │
│ [Aircraft]       │
│ [Path]           │
│ [Template]       │
│ ...              │
└──────────────────┘
```

---

**Ready to use!** See `AMRO_WIZARD_USAGE_GUIDE.md` for integration instructions.
