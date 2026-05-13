# AMRO Parts Enterprise Storybook Template

This template defines the production-ready standard for AMRO->Parts Storybook stories and operational component documentation.

## Purpose
- Provide a single enterprise baseline for look-and-feel, governance, accessibility, and release controls.
- Keep AMRO Parts stories inventory-focused and aligned with module permissions and audit policy.

## Template Assets
- Story template helper:
  - `src/features/module-amro/components/parts/storybook/amroPartsEnterpriseStoryTemplate.tsx`
- Baseline story using the template:
  - `src/features/module-amro/components/parts/AmroPartsInventoryWorkbench.stories.tsx`
  - `src/features/module-amro/components/templates/AmroInventoryDataGridTemplate.stories.tsx`
  - `src/features/module-amro/components/templates/AmroInventoryModuleTemplates.stories.tsx`
  - `src/features/module-amro/components/templates/AmroModuleLayoutV23Prototypes.stories.tsx`
  - `src/features/module-amro/components/templates/AmroStandardFormTemplate.stories.tsx`
  - `src/features/module-amro/components/templates/AmroWorkOrderTemplateAdapter.stories.tsx`
  - `src/features/module-amro/components/templates/AmroWorkOrderTemplatesEnterprise.stories.tsx`

## Required Governance Metadata
Each production story must declare:
- `componentId`
- `ownerTeam`
- `releaseRing` (`staging`, `uat`, `production`)
- `dataClassification` (`public`, `internal`, `restricted`)
- `approvalPolicy`
- `auditReference`

## Enterprise Controls Included
- Story shell decorator for consistent enterprise visual framing.
- WCAG 2.1 A/AA a11y gate configuration at story parameter level.
- Structured arg-type categories for state/layout/performance.
- Docs description generation with governance and audit metadata.

## Operational Quality Gates
- Must pass:
  - unit tests for AMRO Parts components
  - Storybook build
  - visual checks (Chromatic)
  - accessibility checks (Storybook a11y)
- Must include:
  - loading, ready, empty, error states
  - responsive and split-layout states
  - interaction callbacks for retry/refresh/create/select

## Security and Release Expectations
- No sensitive data in stories or mock payloads.
- Keep mock data deterministic and sanitized.
- Enforce reviewer approval before publishing production ring stories.
- Preserve release traceability with `auditReference`.

## Multi-Team Usage Pattern
1. Create story with enterprise template imports.
2. Attach governance metadata in docs description.
3. Keep controls and state stories aligned with AMRO operational workflows.
4. Use the same template for all new AMRO Parts stories to avoid style and policy drift.
