# AMRO Parts Navigation Figma Handoff Spec

## Purpose
This spec translates the implemented AMRO Parts navigation into a design-tool-ready structure for Figma so Design, Engineering, QA, and Product share one source of truth.

## Source Implementation
- Navigation shell: `src/features/module-amro/components/parts/AmroPartsNavigationShell.tsx`
- Navigation config: `src/features/module-amro/components/parts/partsNavigationConfig.ts`
- Module panels: `src/features/module-amro/components/parts/AmroPartsModulePanels.tsx`
- Workspace integration: `src/features/module-amro/components/AmroOwnedWorkspace.tsx`

## Figma File Structure
Create one Figma file with the following pages:
1. `00 Foundations`
2. `01 Navigation Components`
3. `02 Desktop Flows`
4. `03 Tablet Flows`
5. `04 Mobile Flows`
6. `05 Accessibility`
7. `06 Handoff Notes`

## Frame Naming Convention
Use exact names:
- `AMRO/Parts/Nav/Desktop/Overview`
- `AMRO/Parts/Nav/Desktop/Item Master`
- `AMRO/Parts/Nav/Desktop/Stock Ledger`
- `AMRO/Parts/Nav/Desktop/Reservations`
- `AMRO/Parts/Nav/Desktop/Issue & Consume`
- `AMRO/Parts/Nav/Desktop/Restock`
- `AMRO/Parts/Nav/Desktop/Locations`
- `AMRO/Parts/Nav/Desktop/Analytics`
- `AMRO/Parts/Nav/Tablet/*`
- `AMRO/Parts/Nav/Mobile/*`

## Breakpoints and Layout Specs
- Desktop: `>= 1024px`
- Tablet: `768px - 1023px`
- Mobile: `< 768px`

### Desktop Grid
- Canvas width: `1440`
- Content max width: `1280`
- Outer padding: `16`
- Main split: `280` nav rail + `auto` content
- Gutter: `12`

### Tablet Grid
- Canvas width: `1024`
- Reduced rail: `220` (collapsed behavior optional)
- Gutter: `12`

### Mobile Grid
- Canvas width: `390`
- Drawer-based module menu
- Content full width under top nav card

## Spacing and Sizing Tokens
- `space-1`: 4
- `space-2`: 8
- `space-3`: 12
- `space-4`: 16
- `space-6`: 24
- Card radius: 10
- Control radius: 8
- Chip radius: 999
- Menu button min height: 40
- Touch target min size: 44x44

## Typography
- Title: 14/600
- Body: 12/400 or 14/500 based on control type
- Helper text: 11/400
- Breadcrumb: 12/400
- Badge text: 10/600

## Component Inventory
Use component inventory from:
- `docs/amro-parts/PARTS_NAVIGATION_COMPONENT_INVENTORY.csv`

Required component sets in Figma:
- `Nav/Header`
- `Nav/Breadcrumb`
- `Nav/QuickShortcutChip`
- `Nav/GroupLabel`
- `Nav/ModuleButton`
- `Nav/ResponseBadge`
- `Nav/RoleBadge`
- `Nav/MobileDrawer`
- `Nav/ContentSurfaceShell`

## Interaction Model
Use interaction matrix from:
- `docs/amro-parts/PARTS_NAVIGATION_INTERACTION_MATRIX.csv`

Prototype interactions required:
- Module change from nav rail
- Module change from quick shortcuts
- Module change from mobile drawer
- Role swap preview (`technician`, `engineer`, `inspector`, `planner`, `management`)
- Active state transitions

## Role-Based Visibility Rules
Reflect visibility exactly as configured in `partsNavigationConfig.ts`.
- Technician does not see:
  - `Item Master`
  - `Analytics`
- Management sees all modules.

Add a design annotation block on each role frame:
- `Visible modules`
- `Hidden modules`
- `Reason`

## Accessibility Annotation Layer (WCAG 2.1 AA)
Create dedicated annotation layer in each key frame:
- Focus order index for all interactive controls
- Keyboard access notes:
  - tab to module buttons
  - enter/space activates module
- Contrast notes:
  - active/hover/default states meet AA
- ARIA notes:
  - breadcrumb navigation label
  - active module `aria-current="page"`
  - content region `aria-live="polite"`

## Performance Benchmark Annotation
Add annotation component `Perf/Navigation`:
- KPI: `Navigation response <= 200ms`
- Data source: runtime `Nav Response <N>ms` badge in UI
- Test condition:
  - normal dataset
  - no network throttling
  - desktop and mobile

## Usability Testing Attachment
Link this plan in Figma handoff:
- `docs/amro-parts/PARTS_NAVIGATION_USABILITY_TEST_PLAN.md`

Required prototype tasks:
1. Open `Stock Ledger` from Overview.
2. Return via breadcrumb context understanding.
3. Use quick shortcut to `Reservations`.
4. Open mobile drawer and navigate to `Locations`.
5. Validate missing unauthorized modules for technician role.

## Maintenance Procedure (Future Modules)
For each new module:
1. Add module in `partsNavigationConfig.ts`.
2. Add role matrix entry.
3. Add frame set for desktop/tablet/mobile in Figma.
4. Add module button variant in `Nav/ModuleButton`.
5. Update component inventory and interaction matrix CSV files.
6. Update this handoff spec version block.

## Versioning
- Spec version: `v1.0`
- Last updated: `2026-04-09`
- Owner: `AMRO Platform UX/Engineering`
