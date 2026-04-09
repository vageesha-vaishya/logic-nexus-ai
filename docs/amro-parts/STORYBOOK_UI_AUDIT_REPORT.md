# AMRO Parts Storybook UI Audit Report

## Audit Date
- 2026-04-09

## Scope
- Storybook configuration review
- AMRO Parts module UI pattern consistency across:
  - Inventory Core: Overview, Item Master, Stock Ledger
  - Operations: Reservations, Issue & Consume, Restock, Locations
  - Insights: Analytics

## Current Findings (Before Standardization Pass)
- Storybook addon stack was present, including `@storybook/addon-designs`, `a11y`, and docs.
- Storybook story coverage for AMRO Parts components was missing.
- Module-level UI patterns were partially standardized but had:
  - mixed card/header spacing
  - inconsistent KPI summary blocks
  - divergent toolbar behavior (search/filter/action placement)
  - inconsistent module surface labeling and state badges
- Navigation shell supported role filtering and responsive behavior but lacked full design-system documentation integration.

## Standardization Actions Completed
- Added standardized module surface primitive and toolbar/KPI primitives:
  - `AmroPartsUiStandards.tsx`
- Applied unified module shell style to Operations/Insights module panels.
- Added Storybook stories for:
  - UI standards primitives
  - navigation shell
  - operations/insights panel set
- Linked design references in stories via `parameters.design`.
- Added handoff and mapping docs to align Figma and Storybook.

## Remaining Gaps (Next Pass)
- Expand standardized primitives into Item Master and Stock Ledger internals.
- Add standardized table/form wrappers for all CRUD dialogs.
- Add story-level accessibility test notes per module and automated visual-regression tags.
- Add MDX docs pages with embedded code snippets and do/don't usage callouts.

## UX Consistency Scorecard (Post Pass)
- Navigation consistency: Improved (High)
- Surface/header consistency: Improved (Medium-High)
- Toolbar consistency: Improved (Medium)
- Table/form consistency: Partial (Medium)
- Storybook coverage for AMRO Parts: Improved (Medium)

## Recommendation
- Proceed with a second adoption pass focused on:
  - data-table primitives
  - form and modal interaction patterns
  - WCAG annotation overlays in Storybook docs pages.
