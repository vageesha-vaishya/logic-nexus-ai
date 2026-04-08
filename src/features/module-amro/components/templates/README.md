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

## Standardized Data Grid Component
- Component: `AmroInventoryDataGridTemplate`
- Storybook path: `AMRO/Templates/AmroInventoryDataGridTemplate`
- Core capabilities:
  - Dynamic grid + adjacent detail panel with synchronized record focus.
  - Three layout modes:
    - horizontal split (`left grid / right detail`)
    - vertical split (`top grid / bottom detail`)
    - responsive stacked (`mobile stacked`, `tablet vertical`, `desktop horizontal`)
  - Scroll behavior modes:
    - virtualization (`@tanstack/react-virtual`)
    - pagination
    - infinite scroll
  - Density presets: `compact`, `normal`, `comfortable`.
  - Column configuration support:
    - sortable
    - filterable
    - groupable
    - resizable
  - Event callbacks:
    - `onRecordSelectionChange`
    - `onScrollPositionChange`
    - `onViewModeChange`
    - `onDetailPanelVisibilityChange`
  - Accessibility:
    - keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`, `Tab`)
    - ARIA labels + live region announcements
    - high contrast mode toggle

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

## Step 3: Task Row Block Standardization (Hybrid)
- **Current implementation**:
  - Standardized core fields are rendered by `AmroStandardFormTemplate` through adapter field/section config.
  - Complex task-row behavior (`Selected Tasks`, scope controls, task cards, sequencing) continues to run from legacy section logic.
  - This provides visible standardization without changing existing mutation/query handlers.
- **Recommended next migration sequence**:
  1. Move task row header and summary chips into adapter config slots.
  2. Move task row presentational cells (code/title/interval badges) to standardized row renderer.
  3. Keep action handlers (`remove/reorder/edit`) in legacy controller until parity tests pass.
  4. Switch task row interactions to template callbacks only after parity is green for create/update/delete.
- **Parity checkpoints (must pass before expanding scope)**:
  - Task add/remove behavior unchanged.
  - Scope selector and planning values persist unchanged.
  - Save/update payload shape exactly matches legacy output.
  - Validation errors appear in both field-level and summary contexts.
  - Double-click/edit flows remain stable with the feature flag on/off.

## Related Sections To Update During Step 3+
- **Stories**:
  - Add `WorkPackageTaskRowsVariant` and `TaskRowValidationVariant` in `AmroStandardFormTemplate.stories.tsx`.
- **Tests**:
  - Add parity tests for task-row ordering, duplicate prevention, and payload integrity.
- **Accessibility checks**:
  - Keyboard focus order across task-row controls.
  - ARIA labels for row-level actions and error summaries.

## Program Plan Reference
- Execution plan (dated Week 1/2/3 with governance, gates, rollback, KPI thresholds):
  - [AMRO_WPT_3_WEEK_EXECUTION_PLAN.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/AMRO/AMRO_WPT_3_WEEK_EXECUTION_PLAN.md)
- Stakeholder approval workflow:
  - Follow the "Documentation and Approval Workflow" section in the execution plan before each phase gate.
