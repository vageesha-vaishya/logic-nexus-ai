# AMRO Parts Navigation Implementation Guide

## Scope
This guide defines the navigation architecture for AMRO Parts Inventory Management covering:
- Overview
- Item Master
- Stock Ledger
- Reservations
- Issue & Consume
- Restock
- Locations
- Analytics

## Architecture
- Navigation shell component:
  - `src/features/module-amro/components/parts/AmroPartsNavigationShell.tsx`
- Module configuration and role matrix:
  - `src/features/module-amro/components/parts/partsNavigationConfig.ts`
- Supplemental module surfaces:
  - `src/features/module-amro/components/parts/AmroPartsModulePanels.tsx`
- Workspace integration:
  - `src/features/module-amro/components/AmroOwnedWorkspace.tsx`

## UX Pattern
- Hierarchical grouped menu:
  - Inventory Core
  - Operations
  - Insights
- Breadcrumb trail:
  - `AMRO > Parts Inventory > Active Module`
- Quick-access shortcuts:
  - first four authorized modules shown as top action chips
- Responsive pattern:
  - desktop left navigation rail
  - mobile sheet drawer with same menu model
- Active-state indicators:
  - highlighted card state
  - `aria-current="page"`
  - shortcut badge

## Role-Based Visibility
Role filtering is centralized in `partsNavigationConfig.ts`.
- Technician: operational modules only.
- Engineer/Planner/Management: full planning and control surface.
- Inspector: ledger and analytics visibility for governance use cases.

## Performance Benchmark
- Target: module navigation switch <= `200ms`.
- Runtime indicator:
  - `Nav Response <N>ms` badge in navigation header.
- Measurement method:
  - module switch start timestamp
  - first animation frame completion timestamp
  - latency displayed in UI

## Accessibility (WCAG 2.1 AA)
- Keyboard support:
  - all nav options are native buttons
  - visible focus styles inherited from design system controls
- Semantic structure:
  - `nav` landmarks and breadcrumb `aria-label`
  - `aria-current` on active module
- Color and contrast:
  - active/hover states based on existing theme tokens
- Screen reader support:
  - status updates exposed with `aria-live="polite"` content region
- Mobile accessibility:
  - sheet/drawer controls use accessible dialog primitives

## Maintenance Procedure
To add a new module:
1. Add module entry in `partsNavigationConfig.ts`.
2. Define role access in `allowedRoles`.
3. Implement or map module surface in `AmroOwnedWorkspace.tsx` render callback.
4. Add test coverage in `AmroPartsNavigationShell.test.tsx`.
5. Update wireframes/docs and prototype.

## Testing Checklist
- Role filtering validation per module.
- Module switching and active-state indicator.
- Mobile drawer navigation parity with desktop.
- Breadcrumb updates on switch.
- Response-time badge below threshold for standard interactions.

## Figma Handoff Pack
- Handoff spec:
  - `docs/amro-parts/PARTS_NAVIGATION_FIGMA_HANDOFF_SPEC.md`
- Component inventory:
  - `docs/amro-parts/PARTS_NAVIGATION_COMPONENT_INVENTORY.csv`
- Interaction matrix:
  - `docs/amro-parts/PARTS_NAVIGATION_INTERACTION_MATRIX.csv`
- Wireframes:
  - `docs/amro-parts/PARTS_NAVIGATION_WIREFRAMES.md`
- Interactive prototype:
  - `docs/amro-parts/prototypes/amro-parts-navigation-prototype.html`

## Storybook Standardization References
- UI audit report:
  - `docs/amro-parts/STORYBOOK_UI_AUDIT_REPORT.md`
- AMRO Parts style guide:
  - `docs/amro-parts/AMRO_PARTS_STYLE_GUIDE.md`
- Storybook implementation guidelines:
  - `docs/amro-parts/STORYBOOK_STANDARDIZATION_IMPLEMENTATION_GUIDELINES.md`
