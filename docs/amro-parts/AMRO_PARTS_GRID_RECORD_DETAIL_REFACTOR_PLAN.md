# AMRO Parts Unified GRID + Record Detail Refactor Plan

## Objective
Replace module-specific GRID and Record Detail variations with a unified Storybook-aligned system that delivers:
- identical CRUD workflows
- consistent validation and messaging
- standardized layout/spacing/interaction patterns
- responsive behavior parity across modules

## Standardized Architecture
### Core building blocks
- `AmroUnifiedGridRecordDetailShell.tsx`
- `AmroInventoryDataGridTemplate.tsx`
- `AmroModuleSurface`, `AmroStandardToolbar`, `AmroKpiGrid`
- `amroTableStandards.tsx`
- `AmroCrudPrimitives.tsx`

### Mandatory behavior standards
- CRUD action order: `Create -> Read -> Update -> Delete -> Confirm`.
- Confirmation required for destructive actions.
- Uniform success/error feedback (toast + optional inline banner).
- Standard loading state labels and empty-state row treatment.
- Consistent toolbar arrangement and action grouping.

---

## Phased Migration Strategy
## Phase 0 (Completed)
- Introduced table standards and CRUD primitives.
- Migrated Item Master and Stock Ledger table styles.
- Added visual benchmark Storybook story + Chromatic gate checklist.

## Phase 1 (Current)
- Apply unified GRID/Record Detail shell to Overview path.
- Consolidate Item Master and Stock Ledger dialog action/footer patterns.
- Standardize error banner and state messaging.

## Phase 2
- Migrate Operations/Insights panels to shared GRID wrappers where records are tabular.
- Introduce shared record-detail form field composition helpers.
- Remove residual hard-coded width classes where responsive alternatives exist.

## Phase 3
- Convert remaining module-specific CRUD routines to shared hooks/utilities.
- Enforce lint/static checks for disallowed layout drift patterns.
- Finalize release quality gates and baseline snapshots.

---

## Migration Timeline (recommended)
| Window | Scope | Owner | Exit Criteria |
|---|---|---|---|
| Week 1 | Inventory Core hardening | Frontend + QA | No visual drift in Overview/Item Master/Stock Ledger |
| Week 2 | Operations panel normalization | Frontend + UX | Shared table primitives used where tabular |
| Week 3 | Insights + cross-module QA | Frontend + QA | Chromatic + manual browser QA green |
| Week 4 | Governance and freeze | Platform | Lint/docs/Storybook gates enforced |

---

## Backward Compatibility
- Keep API contracts unchanged during UI migration.
- Preserve existing route names and module IDs.
- Retain fallback rendering paths while new wrappers are rolled out.

## Data Migration Requirements
- None for UI-only layout standardization.
- No schema/data transformation required.

---

## QA and Regression Strategy
### Functional tests
- Existing targeted module test suites must pass.
- Add/expand tests around:
  - delete confirmation
  - dialog save/cancel behavior
  - loading/empty rendering

### Visual regression
- Required Storybook reference stories:
  - `AMRO/Parts/Table Standards`
  - `AMRO/Parts/UI Standards`
  - `AMRO/Parts/Navigation Shell`
  - `AMRO/Parts/WCAG Checklists`
- Chromatic pass/fail checkpoints from implementation guidelines are mandatory release gate.

### Manual cross-browser matrix
- Chrome, Firefox, Safari, Edge
- Viewports:
  - 360x800 (mobile)
  - 768x1024 (tablet)
  - 1280x800 (desktop)
  - 1536x960 (large desktop)

---

## Rollback Procedures
1. Revert module-specific migration commits by phase boundary.
2. Restore prior story baselines if needed.
3. Keep shared primitives in repo but disable usage in affected modules.
4. Re-run targeted test suite and Chromatic baseline before redeploy.

---

## Success Criteria
- `100%` module coverage using standardized GRID/Record Detail wrappers where applicable.
- `100%` CRUD flow parity validation against standard workflow definition.
- `0` critical visual regression findings in Chromatic gate.
- `0` blocking responsive defects across required breakpoints.
- Performance equal or better than baseline:
  - no increase in interaction latency for primary CRUD actions.

---

## Quality Checklist for New Work
- Uses standardized module surface + toolbar primitives.
- Uses shared table classes and message rows for tabular content.
- Uses shared CRUD footer and messaging primitives.
- Includes Storybook story updates and accessibility notes.
- Passes Chromatic and targeted tests before merge.
