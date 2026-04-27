# AMRO Master Data Dialog Refactor Guide

## Scope
- Refactor target: extract the `Create Aircraft` dialog content from [AmroSettingsMasterDataPage.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx) into a reusable component while preserving existing behavior.
- New component: [AircraftCreateDialogSection.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftCreateDialogSection.tsx).
- Follow-up extraction: `Create/Update Aircraft Template` dialog moved into [AircraftTemplateDialog.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftTemplateDialog.tsx).

## Dialog Inventory Analysis (Current)
- **Master data create/update dialog** (`modalOpen`)
  - Container location: [AmroSettingsMasterDataPage.tsx#L8513](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L8513)
  - Contains entity-specific render paths:
    - Aircraft section
    - Work package template section
    - Generic tabbed form section
- **Aircraft work package create dialog**
  - Component: [AircraftWorkOrderCreateDialog.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftWorkOrderCreateDialog.tsx)
  - Mounted in page near [AmroSettingsMasterDataPage.tsx#L9090](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L9090)
- **Flight log create/update dialog**
  - Uses `FlightLogForm` in page near [AmroSettingsMasterDataPage.tsx#L9126](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L9126)
- **Flight log detail dialog**
  - Read-only detail modal near [AmroSettingsMasterDataPage.tsx#L9138](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L9138)
- **Aircraft template create/update dialog**
  - Extracted component: [AircraftTemplateDialog.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftTemplateDialog.tsx)
  - Mounted in page near [AmroSettingsMasterDataPage.tsx#L8820](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L8820)
- **Aircraft template delete confirmation**
  - Alert dialog near [AmroSettingsMasterDataPage.tsx#L9326](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L9326)
- **Generic delete confirmation dialog**
  - Alert dialog near [AmroSettingsMasterDataPage.tsx#L9342](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L9342)

## Extracted Component Design
- Component: `AircraftCreateDialogSection`
- Responsibility boundaries:
  - Owns only aircraft-specific form rendering for the master-data modal.
  - Receives all state and callbacks from parent page via props.
  - Does not perform network calls directly.
- State ownership:
  - Parent keeps all source-of-truth state, async loaders, and submit orchestration.
  - Child is presentational + controlled-input emitter through callbacks.

## Prop Contract
- The extracted component uses strict TypeScript prop interfaces for:
  - form data/error maps
  - select/listbox options
  - aircraft template hydration callback
  - auxiliary aircraft state setters (base/owner/counters/revision/amendment/date)
  - required progress and collaboration indicators
- Entry point usage: [AmroSettingsMasterDataPage.tsx#L8524-L8569](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L8524-L8569)

## Backward Compatibility
- Dialog shell, title/description, footer actions, and submit/delete handlers remain in parent page.
- Existing create/update workflows remain unchanged because:
  - `handleSubmitModal()` is unchanged.
  - `handleDelete()` is unchanged.
  - all field names, validation keys, and bindings are unchanged.

## Validation and API Flow Preservation
- Validation source remains parent-level (`formErrors` map and existing validation pipeline).
- API payload construction and submission remain parent-level (`buildPayloadFromForm` + existing submit handlers).
- Collaboration state and aircraft progress indicators remain parent-level.

## Testing Strategy
- Unit/interaction:
  - Existing aircraft form tests in [AmroSettingsMasterDataPage.test.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.test.tsx) cover aircraft dialog interactions and select filtering.
- Integration:
  - Existing master data page tests validate create/update modal flow and field persistence.
- E2E:
  - Existing end-to-end scenarios should continue to assert unchanged labels, selectors, and submit behavior because DOM semantics are preserved.

## Migration Guide
1. Import new component in page:
   - [AmroSettingsMasterDataPage.tsx imports](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx#L131-L133)
2. Replace aircraft inline JSX block in master modal with `<AircraftCreateDialogSection ... />`.
3. Keep dialog shell/footer in parent.
4. Keep submit/delete handlers in parent.
5. Run validation:
   - `npm run typecheck`
   - `npx eslint src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftCreateDialogSection.tsx`
   - targeted page tests for aircraft dialog behavior.

## Next Modularization Plan for Remaining Dialogs
- Extract `FlightLogDetailDialog` from inline dialog into `components/FlightLogDetailDialog.tsx`.
- Extract `AircraftTemplateDialog` into `components/AircraftTemplateDialog.tsx`.
- Extract `AircraftTemplateDeleteDialog` and `MasterDataDeleteDialog` into separate alert components.
- Extract generic `MasterDataEntityFormDialog` shell to consolidate entity rendering branches.

## Acceptance Criteria Checklist
- Aircraft dialog behavior unchanged for create and update modes.
- No state ownership inversion; parent remains orchestration owner.
- TypeScript strictness preserved and no implicit `any` usage in extracted component interface.
- Existing selectors and accessibility labels preserved.
