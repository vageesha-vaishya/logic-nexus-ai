# AMRO Work Package Templates QA Runbook Checklist

## Document Control
- Version: `v1.0`
- Status: `QA Execution Checklist`
- Owner: `QA Lead (AMRO)`
- Last Updated: `2026-04-06`

## Pre-Flight (Before QA Session)
- Confirm Storybook is running (`http://localhost:6006`).
- Confirm AMRO feature flag for QA:
  - `VITE_AMRO_WPT_STANDARD_TEMPLATE=true`
- Confirm test data is available for create/update/delete and task rows.
- Confirm fallback behavior can be tested with flag OFF.

## Mandatory Storybook Sign-off Sequence
1. Open `WorkOrderTemplates_ProductionParity`
2. Open `WorkOrderTemplates_ProductionParity_ValidationError`
3. Read and execute checklist from story docs (`State Switch Guide` + visual sign-off checklist)

### Baseline Visual Sign-off (`WorkOrderTemplates_ProductionParity`)
- Verify standardized fields:
  - `Template Code (Standard)`
  - `Template Name (Standard)`
  - `Version (Standard)`
  - `Maintenance Type (Standard)`
  - `Policy Snapshot ID (Standard)`
  - `Active (Standard)`
- Verify legacy parity blocks:
  - `Work Package Details`
  - `Selected Tasks`
  - `Scope Definition`

### Validation Sign-off (`WorkOrderTemplates_ProductionParity_ValidationError`)
- Verify summary title: `Validation Errors`
- Verify messages:
  - `Template Code (Standard) is required.`
  - `Version (Standard) must be greater than zero.`
- Verify layout parity:
  - same fields and blocks as baseline (only validation state differs)

## Enterprise Story CI Gate Checklist
- `InternationalizationAndRTL`
  - RTL wrapper active
  - localized title visible
  - i18n/RTL badges visible
- `HighContrastLowLight`
  - high-contrast badge visible
  - contrast guidance note visible
- `ApprovalWorkflowAndAudit`
  - workflow steps visible (`Draft`, `Review`, `Approval`, `Release`)
  - audit panel details visible
- `OfflineSyncConflictState`
  - offline/sync badges visible
  - conflict warning messages visible
  - offline guidance note visible

## Functional Parity Checks (App Runtime)
- Create WPT with valid required fields.
- Update existing WPT and verify persisted values.
- Delete WPT and verify row removal.
- Task interactions:
  - select/unselect rows
  - select all
  - sort by key columns
  - apply/clear filters
- Scope and tasks JSON edits persist correctly.

## Feature Flag ON/OFF Parity
- ON (`true`): adapter-template path visible.
- OFF (`false`): legacy `WorkOrderTemplateCreateSection` path visible.
- Confirm payload parity:
  - create/update request structure unchanged
  - no unexpected field omissions/additions

## Accessibility Checks (WCAG 2.1 Baseline)
- Keyboard path reaches all key controls and actions.
- Error summary is visible and understandable.
- Field-level errors align with invalid controls.
- Table interaction controls are keyboard operable.

## Exit Criteria (Week-1 QA Gate)
- Storybook baseline + validation sign-off complete.
- Enterprise story CI gates pass.
- Functional parity checks pass.
- ON/OFF feature-flag parity verified.
- No Sev-1/Sev-2 open defects.
- QA sign-off documented in release notes.

## Rollback Procedure
- If any critical parity regression:
  - set `VITE_AMRO_WPT_STANDARD_TEMPLATE=false`
  - restart runtime
  - re-run smoke tests on legacy path
