# AMRO Work Package Templates Module Analysis and Storybook Reference

## Document Control
- Version: `v1.0`
- Status: `Architecture + UX Reference`
- Owner: `AMRO Product + FE Architecture`
- Last Updated: `2026-04-06`
- Scope: Existing `work_order_templates` module analysis and enterprise Storybook reference design

## Executive Summary
The current AMRO Work Package Templates module is functionally strong and data-rich, with complete CRUD support, task-template selection, sorting/filtering, scope/task JSON editing, and model-aware behavior. The key challenge is UI complexity and maintainability as the module scales. The recommended direction is adapter-first standardization via `AmroStandardFormTemplate`, preserving legacy handlers while progressively migrating presentation blocks and interaction patterns.

## Existing Module Functional Analysis
### Core Functional Coverage
- CRUD authoring mode with update-specific model lock behavior.
- Required identity fields: `template_code`, `template_name`, `version`, `maintenance_type`.
- Aircraft model integration with dynamic option loading and error states.
- Task row management with:
  - row select + select all
  - column sort toggles
  - per-column filters
  - selected-row summary
- Scope and tasks JSON sections with validation wiring.

### Layout and Section Structure
- Top shell: registry header/status strip.
- Section 1: `Work Package Details`.
- Section 2: `Selected Tasks` (table-heavy interaction area).
- Section 3: `Scope Definition` and `Tasks JSON` side-by-side.

### Field and Validation Patterns
- Validation style is consistent (`mdm-template-danger`, `aria-invalid`).
- Required field errors handled inline per field and now summarized in template path.
- Update mode protects certain data (`model_id` selection disabled).

## Workflow and Interaction Analysis
### User Workflow (Current)
1. Open create/update modal from master-data list.
2. Fill identity fields and select aircraft model.
3. Review task template rows; filter/sort/select required tasks.
4. Confirm scope and serialized tasks payload.
5. Save/update/delete template.

### Interaction Patterns
- Dense table interactions optimized for keyboard + pointer use.
- Immediate visual feedback for selected rows and aggregate count.
- Inline model/task loading and error messaging.

## Visual Design and UX Findings
### Current Strengths
- Clear section boundaries and practical maintenance-focused labels.
- Compact form controls suitable for data-entry-heavy workflows.
- Strong task table discoverability (sortable headers + filter row).

### Current UX Risks
- Cognitive load is high in single-view editing.
- Legacy block and modernized fields can diverge visually without a strict template contract.
- Validation discoverability improves with summary but still requires consistent placement across states.

## Accessibility (WCAG 2.1) Assessment
### Implemented Baseline
- Label bindings for inputs.
- `aria-invalid` on error fields.
- semantic alert usage in template path.
- keyboard-selectable row controls (checkbox and buttons).

### Required Improvements
- Ensure visible focus ring consistency for all sortable header buttons.
- Add explicit ARIA context for table action groupings.
- Add keyboard instruction text for task-row reorder interactions.

## Performance and Scalability Findings
### Current Performance Characteristics
- Client-side table filtering/sorting on task rows can become expensive with larger datasets.
- JSON serialization display in row cells increases render payload.
- Multiple controlled inputs in one modal increase rerender sensitivity.

### Recommended Metrics to Track
- P95 modal open-to-interactive time.
- P95 task filter latency.
- Save mutation latency delta vs legacy baseline.
- Error-rate delta with feature-flag ON vs OFF.

## Enterprise Storybook Reference Architecture
### Primary Template
- Component: `AmroStandardFormTemplate`
- Responsibilities:
  - standardized shell
  - state handling (`ready/loading/error/success`)
  - validation summary
  - sectioned field rendering
  - slot-based extension (`formBodySlot`, `listSlot`, `sidePanelSlot`, `footerSlot`)

### Adapter Pattern
- `AmroWorkOrderTemplateAdapter` wraps legacy section logic and injects standardized fields.
- Feature flag controls rollout:
  - `VITE_AMRO_WPT_STANDARD_TEMPLATE`

## Storybook Reference Coverage
### Existing WPT Parity Stories
- `WorkOrderTemplates_ProductionParity`
- `WorkOrderTemplates_ProductionParity_ValidationError`
- `WorkOrderTemplates_ProductionParity_Loading`
- `WorkOrderTemplates_ProductionParity_FeatureFlagOffFallback`

### New Enterprise Option Stories
- `DesktopOperations`
- `TabletGlovedHandMode`
- `HighContrastLowLight`
- `InternationalizationAndRTL`
- `OfflineSyncConflictState`
- `ApprovalWorkflowAndAudit`

File:
- [AmroWorkOrderTemplatesEnterprise.stories.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/components/templates/AmroWorkOrderTemplatesEnterprise.stories.tsx)

## Implementation Guidelines
### Component Variations
- Keep `Work Package Details` always in standardized sections.
- Keep `Selected Tasks` and `Scope Definition` visible in all parity and fallback states.
- Use badge-based state indicators (`Feature Flag ON/OFF`, `Offline`, `Approval`).

### Usage Example (Adapter-First)
```tsx
<AmroStandardFormTemplate
  moduleKey="work_order_templates"
  title="Work Package Templates"
  mode="edit"
  state="ready"
  fields={wptFields}
  sections={wptSections}
  renderField={renderWptField}
  formBodySlot={<LegacyTaskAndScopeBlocks />}>
```

### Best Practices
- Preserve handler ownership in legacy logic until parity KPIs are green.
- Use Storybook play assertions as CI gate before promoting rollout.
- Keep ON/OFF feature-flag parity tests mandatory for release.
- Avoid payload-shape changes during presentation migration phases.

## Future Development Options
- Option 1 (recommended): hybrid migration (presentation first, handlers later).
- Option 2: full template-only rewrite (higher risk, lower short-term confidence).
- Option 3: no migration (maintainability debt grows with feature expansion).

## Recommended Path
- Continue with Option 1.
- Prioritize task-row presentational standardization in next sprint.
- Keep rollback immediate via feature flag and legacy fallback path.
