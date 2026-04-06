# AMRO Storybook Form Standard

## Existing Module Analysis Summary
- **Observed patterns**:
  - Dense data-entry forms with mixed controls (`Input`, `Select`, `Textarea`, table-like task selectors).
  - Modal and page-level forms coexist (`FlightLogForm`, work-package dialogs/sections, master-data pages).
  - Multi-tenant/branch-aware data loading through scoped DB access and adapter logic.
  - Repeated states across modules: loading, save/update, validation errors, inline helper text, and read-only paths.
- **Core compatibility requirement**:
  - Keep all existing API queries/mutations in module adapters and handlers.
  - Standard template must remain presentational and config-driven.

## Standardized Component
- Component: `AmroStandardFormTemplate`
- Storybook path: `AMRO/Templates/AmroStandardFormTemplate`
- Architecture: slot + config model
  - `fields`, `sections`, `values`, `renderField`
  - `listSlot`, `sidePanelSlot`, `footerSlot`
  - `state`, `mode`, `validation`, `steps`
  - `primaryActions`, `secondaryActions`

## Naming Conventions
- **Template components**: `AmroStandard*`
- **Adapter components**: `Amro*Adapter` (module-specific binding layer)
- **Story variants**: `<ModuleName>Variant`, `FormStandardContract`, `<State>Variant`
- **Field keys**: snake_case to align with backend payloads and DB columns

## Backward Compatibility Rules
- No direct API calls inside template component.
- Existing module handlers remain the source of truth for CRUD, validation, and mutation sequencing.
- Template migration must be done module-by-module behind adapter layers.
- Existing data handling and API contracts remain unchanged.

## Accessibility (WCAG 2.1 AA) Baseline
- Clear headings and landmark grouping via sections/cards.
- Validation and state messages exposed with semantic `Alert`.
- Workflow step controls expose tab-like semantics.
- Screen-reader status line (`aria-live`) included for rendered field count and state transitions.

## Testing Scenarios (Required)
- **State coverage**: loading, error, success, ready.
- **Validation coverage**: required field, cross-field constraints, warning/error rendering.
- **Conditional rendering**: fields hidden/shown by `visibleWhen`.
- **Multi-step workflow**: step navigation, completed/active visuals.
- **Cross-module compatibility**: run shared template stories for each module variant.
- **Regression checks**: verify existing adapter-based API flows are unchanged after migration.

## Feature-Flag Rollout (Work Package Templates)
- **Flag name**: `VITE_AMRO_WPT_STANDARD_TEMPLATE`
- **Default**: `false` (legacy form path)
- **Enable**:
  1. Set `VITE_AMRO_WPT_STANDARD_TEMPLATE=true`
  2. Restart dev/build runtime
  3. Verify parity on update/create dialogs (`Work Package Details`, task selection, scope definition, save/delete)
- **Rollback**:
  1. Set `VITE_AMRO_WPT_STANDARD_TEMPLATE=false`
  2. Restart runtime
  3. Module immediately falls back to existing `WorkPackageTemplateCreateSection` path
