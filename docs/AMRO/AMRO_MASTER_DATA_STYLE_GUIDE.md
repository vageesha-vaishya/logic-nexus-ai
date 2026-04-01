# AMRO Master Data Design System Style Guide

## Scope

This guide defines the standardized visual system for all AMRO Master Data Management forms rendered through:

- `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`
- `src/features/module-amro/settings/pages/AmroMasterDataEntityPages.tsx`

It is based on the provided template screenshot and aligned with AMRO UI governance references:

- `docs/AMRO_DOCUMENTATION_INDEX.md`
- `docs/AMRO_COMPREHENSIVE_DESIGN_SPECIFICATION.md`
- `docs/AMRO_QUICK_REFERENCE_GUIDE.md`
- `docs/AMRO_LOW_LEVEL_DESIGN.md`

## Visual Specification Extract

- Layout shell uses compact enterprise density with reduced line-height and tight vertical rhythm.
- Panels use white surfaces with teal structural framing to match the screenshot’s module card treatment.
- Form sections use a five-column responsive grid at XL breakpoint, collapsing by breakpoint for smaller viewports.
- Labels are small and medium-weight; values/inputs are compact and uniform in height.
- Tabs are compact pills with muted inactive state and soft-teal active state.
- Form inputs use light borders, soft background, and explicit red invalid state.

## Design Tokens

All tokens are defined in `src/index.css`.

### Color Tokens

- `--mdm-template-canvas: 186 84% 41%`
- `--mdm-template-surface: 0 0% 100%`
- `--mdm-template-border: 210 16% 90%`
- `--mdm-template-border-strong: 186 84% 41%`
- `--mdm-template-heading: 215 28% 17%`
- `--mdm-template-body: 215 22% 28%`
- `--mdm-template-muted: 215 14% 47%`
- `--mdm-template-field-bg: 210 20% 98%`
- `--mdm-template-field-border: 214 24% 86%`
- `--mdm-template-required: 0 84% 60%`
- `--mdm-template-focus: 188 91% 42%`

### Typography Tokens

- Primary font stack: existing platform sans (`font-sans`)
- Body size: `13px`
- Label size: `12px`
- Modal title size: `15px`
- Section title size: `14px`
- Global compact line-height: `--mdm-template-line-height: 1.15`

### Spacing and Sizing

- Input height: `h-9`
- Label-to-field stack: `space-y-1`
- Section spacing: `space-y-6`
- Dialog content inset: `px-6 pb-6 pt-4`
- Panel header/body density:
  - Header: `px-4 py-3`
  - Body: `px-4 pb-4 pt-0`

## Grid System

- Core class: `mdm-template-form-grid`
- Breakpoints:
  - `grid-cols-1` (mobile)
  - `md:grid-cols-2` (tablet)
  - `lg:grid-cols-3` (small desktop)
  - `xl:grid-cols-5` (full desktop template fidelity)
- Full-width field span class for textarea/json:
  - `md:col-span-2 lg:col-span-3 xl:col-span-5`

## Reusable Styling Components

Standardized reusable classes are available in `src/index.css`:

- Page shell: `mdm-template-page`
- Panel shell: `mdm-template-panel`
- Panel header/body/title:
  - `mdm-template-panel-head`
  - `mdm-template-panel-body`
  - `mdm-template-panel-title`
- Form grid and fields:
  - `mdm-template-form-grid`
  - `mdm-template-form-field`
  - `mdm-template-form-field-full`
- Field primitives:
  - `mdm-template-label`
  - `mdm-template-input`
  - `mdm-template-readonly`
  - `mdm-template-danger`
- Navigation tabs:
  - `mdm-template-tab-rail`
  - `mdm-template-tab`
- Modal shell:
  - `mdm-template-dialog`

## Implementation Contract for Master Data Forms

- Every editable field in Basic and Configuration tabs must render through the shared field renderer in `AmroSettingsMasterDataPage.tsx`.
- The five-column grid class must remain the canonical layout for all entity form tabs.
- All labels, input controls, select triggers, textarea controls, and read-only system fields must use `mdm-template-*` classes.
- New Master Data entities must be added only by extending entity definitions; layout and style classes must remain unchanged.

## Responsive and Browser Consistency Baseline

- Responsive behavior is validated by breakpoint-based class contract (`1/2/3/5` column flow).
- Cross-browser baseline is supported by utility-class rendering and standards-based CSS variables.
- Regression checks should include:
  - `npm run test -- src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.test.tsx`
  - `npm run lint`
  - `npm run typecheck`

## Traceability

- UX reference mapping: `UX-AMRO-004` and `UX-AMRO-005` implementation surfaces.
- Form layout standardization is additive and backward-compatible; CRUD behavior, API payloads, and route contracts remain unchanged.

## Aircraft Header Button System

- Surface: `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`
- Shared renderer: `src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftActionPalette.tsx`
- Toolbar accessibility contract:
  - Container uses `role="toolbar"` with `aria-label="Aircraft header actions"`.
  - Header navigation buttons expose `aria-pressed` for active state.
  - Every button has explicit `aria-label`.

### Button Order Contract

The Aircraft module header navigation buttons must render in this exact order:

1. Aircraft List
2. Templates
3. Engine
4. Components
5. Documents
6. AD/SB
7. Operations

### Action Configuration and Behavior

- Aircraft List / Templates / Engine / Components / Documents / AD/SB / Operations:
  - Navigate to aircraft sub-module routes through the shared header toolbar.
  - Preserve route behavior and query context through existing navigation helpers.
  - Active module uses `aria-pressed="true"` and primary visual emphasis.
- Legacy controls retained for future use but hidden from UI:
  - List, New, Template, Grid, Card, Pipeline, Analytics, Import/Export.

### Visual and Interaction Standards

- Icon set uses `lucide-react` only; all icons use `h-4 w-4`.
- Buttons use compact header sizing (`h-9 px-3`) and shared hover/focus behavior from the existing design system.
- Active state uses default button variant plus focus ring for non-default variants.
- Loading state uses spinner replacement with action-level disable protection.

## Aircraft Unified Layout System

- Surface:
  - `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`
  - `src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftUnifiedLayout.tsx`
- Coverage modules:
  - Aircraft List
  - Templates
  - Engine
  - Components
  - Documents
  - AD/SB
  - Operations

### Unified Technical Contract

- `AircraftUnifiedLayout` is the canonical shell for module rail, search, status filter, locale selector, actions, and content body.
- `filterUnifiedModuleRows` is the canonical reusable helper for query + status filtering behavior across module datasets.
- Localization contract:
  - Locale selector values: `en`, `es`, `fr`
  - Label dictionaries are resolved in `AmroSettingsMasterDataPage.tsx` and passed into `AircraftUnifiedLayout` via `labels`.
- Performance contract:
  - Search input uses deferred search value to avoid unnecessary heavy re-renders for large datasets.
  - Result summary (`visible/total`) is displayed for active module context.
- Access control contract:
  - Action rendering is RBAC-aware through `hasPermission` and per-action `permission` keys.
- Error and loading contract:
  - Unified shell displays standardized loading and error states before module-specific content.

### User Training Material

- Navigation:
  - Use the top module rail or header navigation to move between Aircraft List, Templates, Engine, Components, Documents, AD/SB, and Operations.
- Search and status filtering:
  - Use `Unified module search` for keyword filtering in the current module.
  - Use `Unified module status filter` for status-based filtering.
- Locale selector, dynamic filter fields, inline action buttons, and `Clear filters` are hidden in the unified search row for the AMRO-Aircraft module.
- Validation expectations:
  - Save/update actions enforce required field rules and return inline or toast feedback on validation failures.

### Maintenance Plan

- Quarterly review:
  - Validate module rail paths and label dictionaries for newly introduced sub-modules.
  - Confirm RBAC permission mapping remains aligned with `src/config/permissions.ts`.
- Monthly regression:
  - Run unit coverage for `AircraftUnifiedLayout` and `filterUnifiedModuleRows`.
  - Run end-to-end coverage for module rail navigation and unified controls.
- Performance checkpoint:
  - Verify search/filter interactions remain responsive for high-volume records.
  - Monitor and optimize expensive table rendering paths when record volumes increase.
- Change governance:
  - All layout contract changes must include test updates and style guide updates in the same change set.
