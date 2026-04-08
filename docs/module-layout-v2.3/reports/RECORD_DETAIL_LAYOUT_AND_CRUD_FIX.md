# Record Detail Layout and CRUD Icon Fix Report

Date: 2026-04-08  
Scope: AMRO -> Parts Storybook template (`AmroInventoryDataGridTemplate`)

## Issue 1: Record Detail Overlap with Grid Frame
### Root Cause
- The detail action bar previously used negative horizontal margins (`-mx-3`) in a sticky container, which allowed its visual box to extend across panel boundaries.
- Combined with split-pane separator proximity and sticky layering, action controls appeared to overlap the grid frame at some viewport sizes.

### Fix Implemented
File: [AmroInventoryDataGridTemplate.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/components/templates/AmroInventoryDataGridTemplate.tsx)

Specific layout changes:
- Removed overflow-prone sticky action bar from form body (eliminated negative margin behavior).
- Moved CRUD actions to the Record Detail top header (outside scrollable detail content).
- Added workspace container isolation + tighter gap:
  - `relative isolate grid gap-3` (was `relative grid gap-4`)
- Kept detail content inside:
  - `overflow-auto overflow-x-hidden` to prevent horizontal bleed.
- Preserved split pane separation by keeping dedicated separator element between grid and detail panels.
- Refined separator rendering to prevent visual bleed into Record Detail:
  - Increased workspace split gap (`gap-3` -> `gap-4`)
  - Replaced bordered separator block with isolated transparent hit-area + centered 1px guide line
  - Kept drag handle icon centered inside separator hit-area

### Responsive/Browser Verification
- Story viewport tested at:
  - Desktop 1366x768 (`Desktop1366Validation`)
  - Horizontal/Vertical/Stacked modes
- Storybook launch and compile verified clean after patch.

### Screenshots
- Before (provided by user in issue report): overlap visible in right-side action region.
- After (captured from Storybook):
  - [after-record-detail-layout-fix.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/after-record-detail-layout-fix.png)
  - [after-layout-chromium-1366x768.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/after-layout-chromium-1366x768.png)
  - [after-layout-webkit-1366x768.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/after-layout-webkit-1366x768.png)
  - [after-layout-separator-isolated-1366x768.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/after-layout-separator-isolated-1366x768.png)

### Cross-Browser Validation Notes
- Automated check artifact:
  - [layout-browser-check.json](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/layout-browser-check.json)
- Results summary at `1366x768`:
  - Chromium: pass (`Record Detail` rendered, no horizontal overflow)
  - WebKit: pass (`Record Detail` rendered, no horizontal overflow)
  - Firefox: unavailable in current local runtime (`browser context closed` during launch), flagged for CI/containerized follow-up verification

## Issue 2: Missing CRUD Icons and Behavior in Record Detail Header
### Implemented CRUD Header Icons
- Create (`Plus`)
- Read (`Eye`)
- Update (`Pencil`)
- Delete (`Trash2`)
- Save (`Save`)
- Cancel (`X`)

All actions are now placed in the top Record Detail section with:
- tooltips,
- ARIA labels,
- `aria-keyshortcuts`,
- hover/active states via design-system button variants.

### Permission-Based Disabled States
Added prop contract:
- `crudPermissions?: Partial<Record<'create'|'read'|'update'|'delete'|'save'|'cancel', boolean>>`

Behavior:
- Disabled when permission is false.
- Save/Cancel require edit mode.
- Read/Update/Delete require selected record.
- Create allowed without selected record.

### Keyboard Shortcuts
Implemented:
- `Alt+Shift+C` -> Create
- `Alt+Shift+R` -> Read
- `Alt+Shift+U` -> Update
- `Alt+Shift+D` -> Delete (opens confirmation)
- `Alt+Shift+S` -> Save
- `Esc` -> Cancel
- `Ctrl/Cmd+Shift+E` -> Restore collapsed panels

### Destructive Confirmation
Delete now requires explicit confirmation via `AlertDialog` before executing callback.

## Role-Based Validation
Storybook role scenarios added:
- `ReadOnlyRole`
- `EditorRole`

File:
- [AmroInventoryDataGridTemplate.stories.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/components/templates/AmroInventoryDataGridTemplate.stories.tsx)

## API Endpoint Mapping (Icon -> Service Contract)
Current UI contract uses callbacks, enabling backend adapters:
- Create icon -> `onCreateRecord` -> intended `POST /api/v2/amro/master-data/parts_inventory`
- Read icon -> `onReadRecord` -> intended `GET /api/v2/amro/master-data/parts_inventory/:id`
- Update icon -> `onUpdateRecord` (enter edit mode) and `onSaveRecord` -> intended `PUT /api/v2/amro/master-data/parts_inventory/:id`
- Delete icon -> `onDeleteRecord` (after confirmation) -> intended `DELETE /api/v2/amro/master-data/parts_inventory/:id`

## Tests Updated
- CRUD callback interaction test coverage updated in:
  - [AmroInventoryDataGridTemplate.test.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/components/templates/AmroInventoryDataGridTemplate.test.tsx)

## Issue 3: Missing Right-Side Border in Record Detail Box
### Root Cause
- The Record Detail container lives inside a split workspace with `overflow-hidden`.
- At some viewport/zoom combinations, the right border stroke is rendered on a clipped edge and can become visually faint/invisible due to subpixel anti-aliasing.
- The issue is amplified by fractional pixel rendering at browser zoom factors (75%, 125%, 150%), making a 1px edge stroke intermittently disappear.

### Fix Implemented
File: [AmroInventoryDataGridTemplate.tsx](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/src/features/module-amro/components/templates/AmroInventoryDataGridTemplate.tsx)

Added an explicit internal right-border rail inside the Record Detail container:
- HTML:
  - `<span data-testid="record-detail-right-border" ... />`
- CSS classes:
  - `absolute inset-y-0 right-0 w-px bg-border z-20 pointer-events-none`
- Additional hardening:
  - Added `inset -1px` right-edge box shadow on the detail panel container:
    - `style={{ boxShadow: 'inset -1px 0 0 hsl(var(--border))' }}`
  - This creates a second deterministic right-edge paint path independent of border-edge clipping.

Why this works:
- The right-border rail is painted inside the panel box, not on an outer clipped edge.
- It remains visible regardless of content length and responsive layout changes.

### Verification Matrix
- Resolutions:
  - 1366x768
  - 1024x768
  - 390x844
- Zoom checks:
  - 75%
  - 100%
  - 125%
  - 150%
- Browser notes:
  - Chromium: pass across all listed resolutions/zoom levels.
  - WebKit (Safari engine): pass across all listed resolutions/zoom levels.
  - Firefox: browser unavailable in this local runtime (`context closed` on launch), marked for CI/environment follow-up.
  - Edge: browser binary unavailable in current environment (`msedge` not installed), marked for CI/Windows runner follow-up.

Artifacts:
- [right-border-validation.json](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/right-border-validation.json)
- [right-border-chromium-desktop-1366-75.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-chromium-desktop-1366-75.png)
- [right-border-chromium-desktop-1366-100.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-chromium-desktop-1366-100.png)
- [right-border-chromium-desktop-1366-125.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-chromium-desktop-1366-125.png)
- [right-border-chromium-desktop-1366-150.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-chromium-desktop-1366-150.png)
- [right-border-webkit-desktop-1366-75.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-webkit-desktop-1366-75.png)
- [right-border-webkit-desktop-1366-100.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-webkit-desktop-1366-100.png)
- [right-border-webkit-desktop-1366-125.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-webkit-desktop-1366-125.png)
- [right-border-webkit-desktop-1366-150.png](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/module-layout-v2.3/reports/screenshots/right-border-webkit-desktop-1366-150.png)
