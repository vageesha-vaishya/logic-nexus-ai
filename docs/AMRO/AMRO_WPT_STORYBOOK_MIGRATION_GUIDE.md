# AMRO WPT Storybook Migration Guide

## Document Control
- Version: `v1.0`
- Status: `Implementation Guide`
- Owner: `AMRO FE Lead`
- Last Updated: `2026-04-06`

## Purpose
Provide concrete migration steps to implement Work Package Templates using Storybook-backed template patterns while preserving runtime parity and rollback safety.

## Recommended Story Baseline
- Primary implementation reference:
  - `WorkPackageTemplates_ProductionParity`
- Validation reference:
  - `WorkPackageTemplates_ProductionParity_ValidationError`

## Story-to-Module Mapping
| Story | Runtime Mapping | Use |
|---|---|---|
| `WorkPackageTemplates_ProductionParity` | Adapter ON path | Primary UI baseline |
| `WorkPackageTemplates_ProductionParity_ValidationError` | Adapter ON + errors | Validation parity |
| `WorkPackageTemplates_ProductionParity_Loading` | Loading state | Data loading UX |
| `WorkPackageTemplates_ProductionParity_FeatureFlagOffFallback` | Legacy path | Rollback/fallback verification |
| `DesktopOperations` | Main desktop operation mode | Enterprise reference |
| `TabletGlovedHandMode` | Tablet/large touch target mode | Responsive operation |
| `HighContrastLowLight` | Hangar/low-light visibility reference | Accessibility |
| `InternationalizationAndRTL` | RTL/i18n reference | Localization readiness |
| `OfflineSyncConflictState` | Offline conflict UX | Reliability scenarios |
| `ApprovalWorkflowAndAudit` | Approval/audit process UX | Compliance flow |

## Implementation Steps
1. Enable adapter path in QA:
   - `VITE_AMRO_WPT_STANDARD_TEMPLATE=true`
2. Validate baseline parity stories in Storybook.
3. Validate runtime parity in AMRO module:
   - create/update/delete
   - task row sort/filter/select-all
   - scope/tasks JSON persistence
4. Run CI play gates for parity and enterprise critical stories.
5. Gate to UAT only if parity and accessibility checks pass.

## Component Usage Example
```tsx
<AmroStandardFormTemplate
  moduleKey="work_package_templates"
  title="Work Package Templates"
  mode="edit"
  state="ready"
  fields={wptFields}
  sections={wptSections}
  renderField={renderWptField}
  formBodySlot={<LegacyLiveTaskAndScopeBlocks />}
/>
```

## Best Practices
- Keep handlers and payload generation in legacy logic until parity KPIs are stable.
- Migrate presentation first, handlers second.
- Keep feature flag rollback path active through Week-3 rollout.
- Maintain ON/OFF parity tests in release gate pipeline.

## Quick Rollback
- Set `VITE_AMRO_WPT_STANDARD_TEMPLATE=false`
- Restart runtime
- Confirm module uses legacy `WorkPackageTemplateCreateSection` path only

## Required Evidence for Sign-off
- Storybook parity screenshots (ready + validation)
- CI play gate pass report
- Runtime parity test results
- Accessibility check notes
