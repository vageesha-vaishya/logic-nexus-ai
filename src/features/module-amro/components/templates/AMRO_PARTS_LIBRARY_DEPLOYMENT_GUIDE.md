# AMRO Parts Storybook Library Deployment Guide

This guide is intentionally implementation-focused. It is the minimum practical path to ship and maintain the AMRO->Parts Storybook component library.

## 1) Library Surface (Production-Ready)
- Core workspace UI:
  - `AmroPartsInventoryWorkbench`
  - `AmroInventoryDataGridTemplate`
- Data contracts:
  - `partsInventoryContracts.ts`
- Large-catalog state model:
  - `usePartsCatalogState`
- Storybook evaluation suites:
  - `AMRO/Inventory/Module Templates`
  - `AMRO/Module Layout v2.3/Comparative Prototypes`

## 2) Integration Pattern
- Backend adapter implements:
  - `PartsCatalogApi.listParts(query)`
- UI layer consumes adapter through:
  - `usePartsCatalogState({ api })`
- Keep backend calls outside visual template components.

## 3) Required Quality Gates
- Unit + interaction tests:
  - `AmroInventoryDataGridTemplate.test.tsx`
  - `AmroPartsInventoryWorkbench.test.tsx`
  - `usePartsCatalogState.test.tsx`
- Storybook visual validation:
  - loading/empty/error/populated
  - desktop/tablet/mobile variants
- Accessibility checks:
  - keyboard path through grid/detail/actions
  - ARIA labels for icon-only controls

## 4) Performance Baseline
- Use virtualization for large catalogs.
- Use `usePartsCatalogState` page loading for 10k+ records.
- Keep detail rendering bounded to selected record only.

## 5) CI/CD Deployment
- Workflow:
  - `.github/workflows/amro-parts-storybook.yml`
- Pipeline runs:
  - focused tests
  - Storybook build
- Publish build output to deployment target used by your environment.

## 6) Rollout Checklist
- Step 1: Merge component + tests.
- Step 2: Run Storybook review with product and operations users.
- Step 3: Connect real API adapter (`PartsCatalogApi`).
- Step 4: Enable environment rollout flag for target tenant/franchise.
- Step 5: Monitor event latency, CRUD error-rate, and checklist coverage KPIs.
