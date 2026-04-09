# AMRO Parts GRID + Record Detail Investigation Report

## Scope
Modules reviewed:
- Inventory Core: Overview, Item Master, Stock Ledger
- Operations: Reservations, Issue & Consume, Restock, Locations
- Insights: Analytics

Primary implementation files:
- `src/features/module-amro/components/parts/AmroPartsInventoryWorkbench.tsx`
- `src/features/module-amro/components/templates/AmroInventoryDataGridTemplate.tsx`
- `src/features/module-amro/components/parts/AmroItemMasterCatalogPanel.tsx`
- `src/features/module-amro/components/parts/AmroStockLedgerPanel.tsx`
- `src/features/module-amro/components/parts/AmroPartsModulePanels.tsx`
- `src/features/module-amro/components/parts/AmroPartsNavigationShell.tsx`

---

## 1) CSS / Styling Implementation Audit
### Findings
- No dedicated CSS/SCSS files exist in the AMRO Parts module path; styling is utility-class and component-token driven.
- `!important` usage: none detected in AMRO Parts implementation.
- Inline styles detected in key layout template:
  - `AmroInventoryDataGridTemplate.tsx`
  - dynamic width/transform/grid-template sizing and panel shadows.
- Hard-coded bracket pixel classes exist and are concentrated in layout controls and badges:
  - examples: `w-[180px]`, `w-[140px]`, `max-h-[260px]`, `max-h-[220px]`, `min-h-[240px]`, `text-[10px]`, `text-[11px]`.

### Risk
- Dynamic inline style + hard-coded widths increases cross-module drift and layout brittleness.
- Inconsistent use of fixed-width controls contributes to visual clutter on smaller widths.

---

## 2) Layout System Conflict Analysis
### Layout systems in use
- Flexbox: toolbar/action rows and many card sections.
- CSS Grid: KPI layouts, form field arrangements, module shell split structures.
- Absolute/sticky positioning: virtualized grid rows and sticky headers in template/table helpers.

### Conflict Matrix (high-level)
| Component | Primary System | Secondary System | Conflict Type | Impact |
|---|---|---|---|---|
| `AmroInventoryDataGridTemplate` | Grid + Flex | Absolute + Inline sizing | Mixed dynamic layout control paths | Medium |
| `AmroStockLedgerPanel` | Grid + Flex | Table + compact nested tables | Dense concurrent sections on one canvas | High |
| `AmroItemMasterCatalogPanel` | Grid + Flex | Tabs + modal forms | Action clustering + modal density | Medium |
| `AmroPartsNavigationShell` | Grid + Flex | Drawer/sheet mobile layout | Orientation mode + collapse state complexity | Medium |

### Nested overlap hotspots
- `Stock Ledger`: transaction grid + period controls + approvals co-located before refactor; now split via tabs.
- `InventoryDataGridTemplate`: grid panel split percentage + virtualization transforms + sticky headers.

---

## 3) Responsive Breakpoint Verification
Target breakpoints:
- Mobile: 320–767
- Tablet: 768–1023
- Desktop: 1024–1439
- Large desktop: 1440+

### Verification status
- Code-level and Storybook pattern verification completed.
- Automated visual snapshot process is defined via Storybook + Chromatic gate.
- Manual browser/device sweep is required as final QA step (see checklist in implementation plan).

### Identified breakpoint sensitivity areas
- Fixed-width filter selects (`w-[140px]`, `w-[180px]`) in Item Master / Stock Ledger.
- Dense action rows in Stock Ledger toolbar at tablet widths.
- Virtualized template split behavior relies on dynamic percentages; needs baseline snapshots per viewport.

---

## 4) Component Hierarchy + Spacing Analysis
### Component hierarchy (simplified)
#### Overview
`AmroOwnedWorkspace -> AmroModuleSurface -> AmroStandardToolbar -> AmroKpiGrid -> AmroPartsInventoryWorkbench -> AmroUnifiedGridRecordDetailShell -> AmroInventoryDataGridTemplate`

#### Item Master
`AmroItemMasterCatalogPanel -> AmroModuleSurface -> AmroStandardToolbar -> AmroKpiGrid -> standardized table -> CRUD dialog (tabs) -> CRUD footer`

#### Stock Ledger
`AmroStockLedgerPanel -> AmroModuleSurface -> AmroStandardToolbar -> AmroKpiGrid -> standardized table -> ops tabs (periods/approvals) -> CRUD dialog`

### Spacing/token compliance notes
- Standardized spacing now largely uses `gap-2/3/4`, `p-2/3`, `rounded-md`.
- Remaining non-tokenized values are mostly compact text sizes and fixed widths (`text-[10px]`, `w-[140px]`).
- Wrapper depth improved in Stock Ledger by moving ops content behind tabbed sections.

---

## 5) Visual Documentation + Problem Mapping
### Captured/available artifacts
- Storybook benchmark stories:
  - `AMRO/Parts/Table Standards`
  - `AMRO/Parts/UI Standards`
  - `AMRO/Parts/Navigation Shell`
  - `AMRO/Parts/WCAG Checklists`
- Chromatic release gate checklist added in Storybook guidelines.

### Browser/device capture note
- High-resolution multi-browser screenshot capture should be executed in QA pipeline:
  - Chrome, Firefox, Safari, Edge
  - mobile/tablet/desktop baselines
- Use `AMRO/Parts/Table Standards` and module stories as canonical capture points.

---

## 6) Problem-to-Root-Cause Mapping
| Symptom | Root Cause | Module(s) | Fix Status |
|---|---|---|---|
| Visual clutter from multiple control sections | Concurrent dense control blocks in single view | Stock Ledger | Fixed (tabbed ops sections) |
| Inconsistent table spacing/header style | Module-level ad hoc table classes | Item Master, Stock Ledger | Fixed (shared table standards) |
| Inconsistent CRUD footer and messaging | Per-module dialog footer/error implementation | Item Master, Stock Ledger | Fixed (CRUD primitives) |
| GRID/Detail behavior divergence risk | Direct template usage without unified shell constraints | Overview grid path | Fixed (unified shell wrapper introduced) |
| Potential responsiveness drift | Fixed width utility classes and dynamic inline styles | Multiple | Mitigated + tracked |

---

## 7) Remediation Summary Implemented
- Introduced unified GRID/Record Detail shell:
  - `AmroUnifiedGridRecordDetailShell.tsx`
- Standardized table density/header/empty/loading:
  - `amroTableStandards.tsx`
- Standardized CRUD messaging/footer/section blocks:
  - `AmroCrudPrimitives.tsx`
- Applied cleanup to:
  - `AmroPartsInventoryWorkbench.tsx`
  - `AmroItemMasterCatalogPanel.tsx`
  - `AmroStockLedgerPanel.tsx`
- Added/updated Storybook visual governance:
  - `AmroTableStandards.stories.tsx`
  - Visual regression gate checklist in docs.
