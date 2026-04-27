# AMRO Work Package Templates Component Migration Matrix

## Document Control
- Version: `v1.0`
- Status: `Implementation Reference`
- Owner: `AMRO FE Lead`
- Last Updated: `2026-04-06`
- Scope: `WorkOrderTemplateCreateSection` migration into `AmroStandardFormTemplate` adapter path

## Objective
Provide a field-by-field and block-by-block migration map so FE can standardize WPT UI with no ambiguity while preserving existing handlers, payload shape, and API integrations.

## Source Components
- Legacy source: `WorkOrderTemplateCreateSection`
  - [WorkOrderTemplateCreateSection.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/settings/pages/amro-settings-master-data/components/WorkOrderTemplateCreateSection.tsx)
- Standard shell: `AmroStandardFormTemplate`
  - [AmroStandardFormTemplate.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/components/templates/AmroStandardFormTemplate.tsx)
- Adapter path: `AmroWorkOrderTemplateAdapter`
  - [AmroWorkOrderTemplateAdapter.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/components/templates/AmroWorkOrderTemplateAdapter.tsx)

## Migration Strategy
- Keep legacy controller logic and all data handlers intact.
- Move presentation blocks in phases:
  - Phase A: standardized core fields (done)
  - Phase B: task row presentational standardization (next)
  - Phase C: optional handler callback migration after parity gates pass
- Feature flag guard remains mandatory:
  - `VITE_AMRO_WPT_STANDARD_TEMPLATE`

## Field-Level Migration Matrix
| Legacy Field Key | Legacy Label | Current Owner | Target Template Element | Phase | Handler Source | Required Parity Check | Rollback Trigger |
|---|---|---|---|---|---|---|---|
| `template_code` | Template Code | Adapter + legacy | Standard field renderer | A (done) | `setFieldValue('template_code', ...)` | Required validation and persisted value unchanged | Validation mismatch or empty value accepted unexpectedly |
| `template_name` | Template Name | Adapter + legacy | Standard field renderer | A (done) | `setFieldValue('template_name', ...)` | Persisted label/value unchanged | Update payload drift |
| `version` | Version | Adapter + legacy | Standard numeric field renderer | A (done) | `setFieldValue('version', ...)` | `>0` validation unchanged | Invalid versions accepted |
| `maintenance_type` | Maintenance Type | Adapter + legacy | Standard select field renderer | A (done) | `setFieldValue('maintenance_type', ...)` | Enum value remains `line/base/hangar/shop` | Enum mapping breaks |
| `policy_snapshot_id` | Policy Snapshot ID | Adapter + legacy | Standard input renderer | A (done) | `setFieldValue('policy_snapshot_id', ...)` | Value persists as-is | Value truncation or mapping errors |
| `active` | Active | Adapter + legacy | Standard checkbox renderer | A (done) | `setFieldValue('active', ...)` | Boolean persistence unchanged | Toggle inversion bug |
| `model_id` / `aircraft_model` | Aircraft Model | Legacy | Legacy block (then template select) | B | Existing model option resolution logic | model_id resolution unchanged in create/update | model not resolved in update mode |
| `scope_json` | Scope JSON | Legacy | Legacy block (then template json editor) | B | `setFieldValue('scope_json', ...)` | JSON validation behavior unchanged | invalid scope accepted/rejected incorrectly |
| `tasks_json` | Tasks JSON | Legacy | Legacy block (then template json editor) | B | `setFieldValue('tasks_json', ...)` + selection sync | selection-driven payload shape unchanged | tasks_json drift from selected rows |

## Block-Level Migration Matrix
| Legacy Block | Current Rendering | Target Rendering | Phase | Keep Legacy Logic? | Acceptance Criteria | Test Gate |
|---|---|---|---|---|---|---|
| `Work Package Template Registry` header | legacy | template header + status badges | A (done) | Yes | Header semantics remain clear | Story parity screenshot + QA visual check |
| `Work Package Details` | legacy full block | hybrid: core fields in template + remaining fields legacy | A/B | Yes | No create/update regression | Flag ON/OFF parity tests |
| `Selected Tasks` table | legacy table | template card + standardized row renderer | B | Yes | add/remove/select-all/filter/sort parity | task interaction parity suite |
| `Scope Definition` | legacy textarea | template section wrapper | B | Yes | scope_json unchanged | payload parity check |
| `Tasks JSON` | legacy textarea | template section wrapper | B | Yes | tasks_json unchanged | payload parity check |

## Task-Row Subcomponent Mapping (Phase B)
| Row Element | Legacy Behavior | Target Standardized Representation | Handler Owner | Validation/Parity Requirement |
|---|---|---|---|---|
| Selection checkbox | row select/unselect | standardized row checkbox cell | legacy | selected ID set remains identical |
| Select-all checkbox | tri-state + scoped rows | standardized header control | legacy | select-all semantics unchanged |
| Sort toggles | per-column asc/desc | standardized sortable headers | legacy | same default sort and direction toggles |
| Filter inputs | per-column text filter | standardized filter row inputs | legacy | filtered row counts remain consistent |
| `Selected` badge | selected row marker | standardized badge token | legacy | row selected state parity |
| JSON details column | serialized json | standardized expandable/preformatted cell | legacy | no data loss in display |
| Summary line | checked count + records | standardized summary footer | legacy | counts match source selection |

## Dependencies and Sequencing
- Must complete before Phase B:
  - Storybook parity stories approved (`WorkOrderTemplates_ProductionParity*`)
  - CI play checks green for ready + validation states
  - Feature-flag ON/OFF parity tests passing
- Phase B dependencies:
  - stable `task_templates` query result shape
  - stable `tasks_json` schema
- Phase C dependency:
  - 2 consecutive parity cycles with no Sev-1/Sev-2 defects

## Acceptance Criteria by Phase
### Phase A (Current)
- 6 standardized fields render and persist correctly.
- Validation summary and messages remain consistent with legacy rules.
- Legacy blocks (`Work Package Details`, `Selected Tasks`, `Scope Definition`) remain visible.

### Phase B (Next)
- Task-row visual subcomponents standardized with no behavior drift.
- Sort/filter/select/reorder interactions match legacy outcomes.
- `tasks_json` generated payload identical to legacy path for same interactions.

### Phase C (Optional)
- Handler callbacks migrated to template interfaces without changing API payloads.
- Legacy section internals can be reduced/retired only after parity KPI gates pass.

## Required Test Matrix
- Unit:
  - adapter field validation + label presence
  - selected-task payload generator equivalence
- Integration:
  - modal create/update, row double-click, save/delete parity
  - feature flag ON/OFF fallback parity
- Storybook CI gates:
  - `WorkOrderTemplates_ProductionParity` play assertions
  - `WorkOrderTemplates_ProductionParity_ValidationError` play assertions

## Rollback Procedure (Component Scope)
- Trigger:
  - parity KPI below threshold
  - create/update payload mismatch
  - task selection/reorder regression
- Action:
  - set `VITE_AMRO_WPT_STANDARD_TEMPLATE=false`
  - restart runtime
  - route all users to legacy `WorkOrderTemplateCreateSection` path
- Verification:
  - rerun ON/OFF parity sanity tests and confirm legacy restoration

## Owner Assignment (Implementation)
- FE: block/field migration and story updates
- BE: payload contract verification
- QA: parity matrix execution and sign-off
- UX: layout consistency and task-row usability validation
- DevOps: feature-flag rollout + rollback control
- Compliance: traceability/audit visibility checks
