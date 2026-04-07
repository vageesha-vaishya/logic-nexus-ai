# AMRO Aircraft Screen — Add Work Package Dialog Functional Analysis

## Scope
- Feature analyzed: **Add work package** dialog from `/dashboard/amro/aircraft`.
- Primary UI component: [AircraftWorkPackageCreateDialog.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L140-L797)
- Orchestration and data loading: [AmroSettingsMasterDataPage.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4508-L5383)

---

## Dialog Purpose
- Create a new maintenance work package for the selected aircraft.
- Support multiple task sourcing paths:
  - Template-first (`New WP`)
  - Existing work package cloning (`Existing WP`)
  - Residual/non-performed tasks (`Non performed tasks`)
  - Manual task curation (`Selected task`)
  - Union view over all known tasks (`All Tasks`)
- Enforce required planning metadata before submit.

---

## Tab-by-Tab Functional Documentation

## 1) New WP
- **Intent**
  - Start from approved template registry.
  - Prefill maintenance type/scope and seed task selection.
- **UI behavior**
  - Template dropdown (`Template registry`), maintenance/scope/tasks counters, refresh action.
  - `Refresh Templates` triggers registry reload.
- **Business logic**
  - Loads templates from master-data endpoint and normalizes rows.
  - Selecting template updates:
    - `maintenanceType`
    - `scopeItemsText`
    - first task fields (`selectedTaskNumber`, `selectedTaskAtaCode`, etc.)
    - selected task IDs from template task rows
  - Code references:
    - Load registry: [AmroSettingsMasterDataPage.tsx#L4508-L4588](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4508-L4588)
    - Template select handler: [AmroSettingsMasterDataPage.tsx#L4782-L4815](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4782-L4815)
    - New WP tab UI: [AircraftWorkPackageCreateDialog.tsx#L585-L645](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L585-L645)

**Mockup (New WP)**
```text
┌ New WP ────────────────────────────────────────────────────────────────────┐
│ Template registry [Line Check v1 ▼] [Maintenance: line] [Scope: 6] [Tasks: 18]
│                                                      [Refresh Templates]
│ "Template selected. Open Selected task tab to review and adjust tasks."
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2) Existing WP
- **Intent**
  - Reuse one existing work package as baseline.
- **UI behavior**
  - Existing WP selector + table preview.
  - `Apply to Form` copies selected record into creation form.
- **Business logic**
  - Loads existing work packages for selected aircraft.
  - On apply:
    - copies WP number/title/type/station/status/priority
    - uses first task to prefill selected task fields
    - converts existing task descriptions into `scopeItemsText`
    - sets selected task IDs to selected WP task IDs
    - switches to `Selected task` tab
  - Code references:
    - Existing WP load: [AmroSettingsMasterDataPage.tsx#L4618-L4664](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4618-L4664)
    - Apply handler: [AmroSettingsMasterDataPage.tsx#L5340-L5379](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5340-L5379)
    - Existing WP tab UI: [AircraftWorkPackageCreateDialog.tsx#L646-L705](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L646-L705)

**Mockup (Existing WP)**
```text
┌ Existing WP ────────────────────────────────────────────────────────────────┐
│ Existing work package [WP-145 · 400 Hr Check ▼]     [Apply to Form]
│ Table: WP Number | Title | Status | Type | Tasks
│        WP-145      400 Hr   Open    line   24
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3) Non performed tasks
- **Intent**
  - Focus on actionable residual tasks that were not completed.
- **UI behavior**
  - Task grid with checkboxes and parent WP info.
- **Business logic**
  - Source:
    - selected existing WP tasks if one is selected; else all existing WP tasks.
  - Filtering rule:
    - `isTaskNonPerformedStatus(task.status)` only.
  - Selected rows update global selected task IDs and selected-task header fields.
  - Code references:
    - Non-performed list derivation: [AmroSettingsMasterDataPage.tsx#L5221-L5227](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5221-L5227)
    - Tab UI: [AircraftWorkPackageCreateDialog.tsx#L706-L742](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L706-L742)

**Mockup (Non performed tasks)**
```text
┌ Non performed tasks ────────────────────────────────────────────────────────┐
│ [ ] Select | Task number | ATA code | Description | WP
│ [x] 05-20-01  05-20       Engine Oil  WP-145
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4) Selected task
- **Intent**
  - Primary planning workspace combining form fields + selected task table.
- **UI behavior**
  - Left panel: work package details form.
  - Right panel: template selector + selected tasks table with pagination/sort.
  - Supports select-all for current page.
- **Business logic**
  - Task table uses paged/sorted selected tasks.
  - Checking a task updates:
    - `aircraftWorkPackageSelectedTaskIds`
    - selected-task quick fields (`selectedTaskNumber`, ATA, etc.) on check.
  - Validation errors surfaced inline in this tab.
  - Code references:
    - Selected task assembly: [AmroSettingsMasterDataPage.tsx#L5123-L5166](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5123-L5166)
    - Filtering/sorting/paging: [AmroSettingsMasterDataPage.tsx#L5168-L5203](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5168-L5203)
    - Selection handler: [AmroSettingsMasterDataPage.tsx#L5317-L5338](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5317-L5338)
    - Selected task tab UI: [AircraftWorkPackageCreateDialog.tsx#L196-L584](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L196-L584)

**Mockup (Selected task)**
```text
┌ Selected task ──────────────────────────────────────────────────────────────┐
│ Left: Number, Topic, TTAF, Validation, Dates, Trigger source, Comments
│ Right: Template registry + task table (Select | Task # | ATA | Serial | Desc)
│ Footer: [Cancel] [Create New Work Package]
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5) All Tasks
- **Intent**
  - Single consolidated view over all available tasks.
- **UI behavior**
  - Grid with selection + status.
- **Business logic**
  - Union set from:
    - template tasks
    - existing WP tasks
    - selected/scope-derived tasks
  - Dedupe via merged map keys.
  - Checkbox interactions use same global selected-task state.
  - Code references:
    - All tasks merge: [AmroSettingsMasterDataPage.tsx#L5228-L5269](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5228-L5269)
    - Tab UI: [AircraftWorkPackageCreateDialog.tsx#L743-L779](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L743-L779)

**Mockup (All Tasks)**
```text
┌ All Tasks ──────────────────────────────────────────────────────────────────┐
│ [ ] Select | Task number | ATA code | Description | Status
│ [x] 27-30-01 27-30        Rudder check  pending
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tab Interdependencies and Workflow

## Interdependencies
- `New WP` chooses template and seeds selection used by `Selected task`.
- `Existing WP` can overwrite form fields and task IDs, then routes operator to `Selected task`.
- `Non performed tasks` and `All Tasks` both write into the same selected task ID state.
- `Selected task` is the final composition/validation area before submit.
- Global state variables are shared across tabs via parent page component state.

## Create New Work Package Click Flow
1. User opens dialog (`openAircraftWorkPackageDialog`).
2. User optionally picks template / existing WP / task rows in tabs.
3. User clicks `Create New Work Package` button.
4. Client validates required fields and constraints.
5. Client builds payload with task IDs + scope + trigger metadata.
6. Client POSTs `/api/v2/amro/work-packages?interface=create-work-package`.
7. On success:
   - toast success
   - close dialog
   - refresh dashboard/snapshots
   - navigate to aircraft work package screen
8. On failure:
   - rollback attempt if partially committed
   - store draft in localStorage
   - error toast

Code reference for submit path: [AmroSettingsMasterDataPage.tsx#L4835-L5119](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4835-L5119)

---

## Data Models

## UI/Form Models
- `AircraftWorkPackageFormValues`:
  - source, maintenanceType, priority, status, validationState
  - WP metadata (number/topic/revision/date fields)
  - selected task “header” fields
  - scope text
- `WorkPackageTemplateRegistryItem`:
  - template id/code/name/type/version
  - scope items array
  - taskRows array
- `AircraftWorkPackageTaskListItem`:
  - task identity + ATA + status + source + parent wp
- `AircraftWorkPackageRecordSummary`:
  - existing WP summary + tasks list

Type definitions: [AircraftWorkPackageCreateDialog.tsx#L15-L138](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L15-L138)

## Submit Payload (core fields)
- `aircraft_id`
- `work_order_number`, `title`
- date fields (ISO)
- `ttaf_hours`, `validation_state`
- `selected_task` object
- `source`, `trigger_source`, `trigger_reference_id`
- `maintenance_type`, `station`, `priority`, `status`
- `scope_items[]`
- `selected_task_ids[]`
- template metadata (`template_id`, `template_code`)

Payload build: [AmroSettingsMasterDataPage.tsx#L4954-L4992](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4954-L4992)

---

## API Endpoints Involved

- **Load template registry**
  - `GET /api/v2/amro/master-data/work_package_templates?page=1&page_size=100&sort_by=updated_at&sort_dir=desc`
  - Reference: [AmroSettingsMasterDataPage.tsx#L4508-L4588](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4508-L4588)

- **Load existing aircraft work packages**
  - `GET /api/v2/amro/work-packages?aircraft_id=<id>&page=1&page_size=100`
  - Reference: [AmroSettingsMasterDataPage.tsx#L4618-L4664](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4618-L4664)

- **Create work package**
  - `POST /api/v2/amro/work-packages?interface=create-work-package`
  - Reference: [AmroSettingsMasterDataPage.tsx#L5011-L5054](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5011-L5054)
  - Contract doc: [openapi-3.1.yaml](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/pages/api/v2/amro/contracts/openapi-3.1.yaml)

- **Compensating rollback (on partial failure)**
  - `DELETE /api/v2/amro/work-packages/{id}?rollback=1`
  - Reference: [AmroSettingsMasterDataPage.tsx#L5080-L5095](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L5080-L5095)

---

## Validation Rules and Business Constraints

## Required fields
- templateRegistry
- workPackageNumber
- topic
- openingDate
- revisionNumber
- ttafHours
- status
- validationState
- transmissionDate
- expectedReceptionDate
- maintenanceReleaseDate
- workReceptionDate
- source
- at least one scope item
- at least one selected task

Validation logic: [AmroSettingsMasterDataPage.tsx#L4855-L4943](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L4855-L4943)

## Type/date constraints
- date fields must parse as valid dates
- `ttafHours` must be numeric and non-negative
- source must be one of: `schedule_due|defect|campaign|predictive_alert`

## Permission constraints
- creation blocked if `canCreateWorkPackage` false
- schedule action blocked if `canScheduleWorkPackage` false

## UI action constraints
- “Create New Work Package” button enabled only when user can create and a template is selected (`canCreateWorkPackageFromTemplate`).
  - [AmroSettingsMasterDataPage.tsx#L3310-L3313](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L3310-L3313)
  - [AircraftWorkPackageCreateDialog.tsx#L785-L789](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkPackageCreateDialog.tsx#L785-L789)

---

## Complete User Journey

1. User lands on aircraft page and selects an aircraft row.
2. User clicks **Create Work Package**.
3. Dialog opens in **New WP**:
   - template registry autoloaded.
4. User selects template and reviews counts.
5. User optionally:
   - switches to **Existing WP** and applies an old package,
   - uses **Non performed tasks** to pick deferred tasks,
   - checks **All Tasks** for broad selection,
   - finalizes fields in **Selected task**.
6. User completes required metadata.
7. User clicks **Create New Work Package**.
8. System validates client-side.
9. System posts create-work-package payload.
10. On success:
   - dialog closes,
   - success toast,
   - snapshot refresh,
   - navigation to aircraft work package page.
11. On failure:
   - rollback attempt if needed,
   - draft persisted locally,
   - user sees error toast.

---

## QA/Verification Checklist
- Template registry loads and refresh works.
- Existing WP apply copies expected fields and selected tasks.
- Non performed / All Tasks checkbox state updates Selected task tab state.
- Validation blocks submit until all required fields are valid.
- Successful submit creates record and navigates.
- Failure path saves draft and surfaces clear error.

Reference tests: [AmroSettingsMasterDataPage.test.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.test.tsx#L1097-L1395)
