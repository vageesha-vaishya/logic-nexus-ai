# AMRO Work Package Templates: Storybook Integration Technical Assessment

## 1. Objective
- Assess current AMRO Work Package Templates implementation against Storybook Work Package Template specifications.
- Identify integration gaps, dependencies, risks, and migration-safe implementation strategy.

## 2. Current State Architecture
- **UI container**: `AmroSettingsMasterDataPage` orchestrates list/form/create/update/delete workflows for `work_package_templates`.
- **Feature flag switch**: `VITE_AMRO_WPT_STANDARD_TEMPLATE` toggles standard Storybook-aligned adapter path.
- **Form implementation**:
  - `AmroWorkPackageTemplateAdapter` provides Storybook-standard labels/validation contract surface.
  - `WorkPackageTemplateCreateSection` contains operational sections:
    - Work Package Details
    - Selected Tasks
    - Scope Definition
- **API routes**:
  - `/api/v2/amro/work-package-templates` and `/api/v2/amro/work_package_templates` map to generic master-data handler.
  - Generic handlers in `master-data/[entity].ts` and `master-data/[entity]/[id].ts`.
- **Data model**:
  - `work_package_templates` core columns: template code/name/version/maintenance type/scope/tasks/policy snapshot.
  - `model_id` added by migration with FK/check constraint (check currently `NOT VALID`).
  - Link table `work_package_template_task_templates` manages template-task relationships.

## 3. Storybook Section Mapping
- **Storybook standardized fields**
  - Template Code (Standard)
  - Template Name (Standard)
  - Maintenance Type (Standard)
  - Aircraft Model (Standard)
  - Version (Standard)
  - Active (Standard)
  - Policy Snapshot ID (Standard)
- **Storybook parity sections**
  - Work Package Details
  - Selected Tasks
  - Scope Definition
- **Current implementation status**
  - All three parity sections are present in production form component.
  - Task grid supports filters/sorting/selection.
  - JSON editors for `scope_json` and `tasks_json` are present.

## 4. Gap Analysis
- **Gap A (resolved in this phase)**: API contract previously omitted `model_id` and `aircraft_model` in write/list projection for `work_package_templates`.
  - Impact: model context could be dropped in create/update payloads and list hydration.
- **Gap B**: API wrappers are still generic passthrough at route boundary; domain behavior lives in generic handler.
  - Impact: discoverability and API ownership are weaker; behavior is harder to reason about externally.
- **Gap C**: DB check `ck_work_package_templates_model_id_required` exists as `NOT VALID`.
  - Impact: legacy rows may not satisfy final model integrity requirement.
- **Gap D**: Potential divergence risk between `tasks_json` and relation table if out-of-band writes bypass sync logic.
  - Impact: UI-selected tasks and persisted links can drift.

## 5. Integration Strategy
### Phase 1: Contract Alignment (Implemented)
- Extend `work_package_templates` entity config in `master-data/shared.ts`:
  - include `model_id`, `aircraft_model` in `writeAllowedFields`.
  - include `model_id`, `aircraft_model` in `listColumns`.
  - include model context in search columns.
  - normalize and validate `model_id` UUID.

### Phase 2: Workflow Consistency (Implemented in existing code path + retained)
- Keep route compatibility while leveraging existing relationship sync internals:
  - parse selected task IDs/tokens from `tasks_json`.
  - resolve scoped task templates.
  - sync `work_package_template_task_templates`.
  - enforce model resolution logic and relationship validation.
- Ensure create/update paths preserve existing API responses and audits.

### Phase 3: Hardening (Recommended Next)
- Validate and enforce `model_id` check constraint after data backfill.
- Add reconciliation job to detect and repair `tasks_json` vs relation-table drift.
- Introduce domain-specific route handlers (optional) while preserving current contract.

## 6. Potential Conflicts and Dependencies
- **Master-data generic handler dependency**
  - Work package templates rely on shared generic infrastructure; changes can affect multiple entities.
- **Assembly model dependency**
  - `model_id` validity depends on `assembly_models` tenant/franchise scope.
- **Task template dependency**
  - selected tasks resolve against `task_templates`; tenant/franchise mismatch can block save.
- **UI feature-flag dependency**
  - standard adapter path and legacy path must both remain functional during transition.

## 7. Risk Assessment and Mitigation
- **Risk: breaking existing templates without model metadata**
  - Mitigation: additive fields, non-destructive writes, staged validation.
- **Risk: relation sync failures causing partial saves**
  - Mitigation: keep strict error propagation, audit records, verification logs.
- **Risk: constraint hardening blocks production updates**
  - Mitigation: run backfill + dry-run validation before `VALIDATE CONSTRAINT`.
- **Risk: user workflow disruption**
  - Mitigation: preserve existing endpoints, payload shape, and form UX.

## 8. Testing Requirements
- **Unit tests**
  - payload normalization for `model_id`/`aircraft_model`.
  - UUID validation on `model_id`.
  - tasks/scope JSON parsing.
- **Integration tests**
  - create template with selected tasks -> relation rows persisted.
  - update template task selection -> relation rows reconciled.
  - list/get payload includes `model_id` and `aircraft_model`.
- **UI regression tests**
  - feature-flag on/off path.
  - parity sections visible and editable.
  - update flow rehydrates model and selected tasks.
- **Data integrity checks**
  - relation-table count and task linkage consistency.
  - model foreign key consistency by tenant/franchise.

## 9. Step-by-Step Implementation Guideline
1. Update entity config fields and normalization in shared API layer.
2. Validate model/task references at API boundary.
3. Preserve create/update relationship sync behavior.
4. Add/update tests for payload contract and relation sync.
5. Backfill legacy rows for model linkage.
6. Validate DB constraints after backfill.
7. Execute UAT using Storybook parity scenarios and AMRO settings flows.

## 10. Success Criteria
- Work Package Templates accept and persist Storybook-standard fields, including model context.
- All three Storybook parity sections function without regression.
- Selected task links are consistent between UI and relation table.
- Existing workflows (create/update/delete/list/edit) remain stable.
- No tenant/franchise data integrity regressions.
