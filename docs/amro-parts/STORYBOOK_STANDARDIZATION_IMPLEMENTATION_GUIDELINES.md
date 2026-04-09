# Storybook Standardization Implementation Guidelines

## Objective
Ensure sustained UI consistency in AMRO Parts by requiring Storybook-first documentation for shared visual/interaction patterns.

## Required Story Categories
- `AMRO/Parts/UI Standards`
- `AMRO/Parts/Navigation Shell`
- `AMRO/Parts/Table Standards`
- `AMRO/Parts/Operational Panels`
- `AMRO/Parts/WCAG Checklists`

## Mandatory Story Metadata
- `parameters.layout`
- `parameters.design` (Figma reference)
- viewport validation notes (desktop/tablet/mobile)
- accessibility notes for keyboard and focus behavior

## Standard Story Template
1. Overview variant
2. Role variation (where applicable)
3. Interaction/state variations
4. Edge/empty-state example

## Module Adoption Checklist
For each AMRO module:
1. Wrap module in standardized surface primitive.
2. Use standardized toolbar/search/filter row where applicable.
3. Use KPI grid for summary cards.
4. Add/update Storybook story.
5. Validate color/spacing/typography against style guide.
6. Add accessibility notes.

## Accessibility Storybook References
- Per-module checklist stories:
  - `src/features/module-amro/components/parts/AmroPartsWcagChecklist.stories.tsx`
- Standardized primitives stories:
  - `src/features/module-amro/components/parts/AmroPartsUiStandards.stories.tsx`
- Table consistency benchmark story:
  - `src/features/module-amro/components/parts/AmroTableStandards.stories.tsx`

## QA Benchmarking
- Navigation switch response target: `<= 200ms`
- Run Storybook local with:
  - `npm run storybook`
- Build docs bundle:
  - `npm run build-storybook`

## Chromatic Release Gate (Pass/Fail)
- Scope benchmark story:
  - `AMRO/Parts/Table Standards`
- Required checkpoints before release approval:
  - [ ] No default-density row-height drift vs approved baseline snapshot.
  - [ ] No compact-density row-height drift vs approved baseline snapshot.
  - [ ] Header/cell alignment unchanged from baseline snapshots.
  - [ ] Sticky headers remain pinned in scrollable table variants.
  - [ ] Loading and empty states retain spacing, borders, and typography treatment.
  - [ ] No unexpected overflow/clipping at desktop/tablet/mobile baseline widths.
- Failure policy:
  - Any checkpoint failure blocks release until accepted by Design + QA or fixed with a new approved baseline.

## Usability Testing Procedure
- Follow:
  - `docs/amro-parts/PARTS_NAVIGATION_USABILITY_TEST_PLAN.md`
- Capture:
  - task success rate
  - misclick/error count
  - qualitative feedback by role

## Contribution Rules
- No new AMRO Parts UI component merges without:
  - story coverage
  - design reference link
  - implementation notes in docs.

## GRID/Record Detail Governance
- Investigation report:
  - `docs/amro-parts/AMRO_PARTS_GRID_RECORD_DETAIL_INVESTIGATION_REPORT.md`
- Refactor rollout plan:
  - `docs/amro-parts/AMRO_PARTS_GRID_RECORD_DETAIL_REFACTOR_PLAN.md`
