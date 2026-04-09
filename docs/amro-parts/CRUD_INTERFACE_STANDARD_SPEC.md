# AMRO Parts Standardized CRUD Interface Specification

## Objective
Enforce consistent CRUD iconography, placement, behavior, and accessibility across AMRO Parts modules.

## Standard CRUD Action Set
- `Create` -> icon `Plus`
- `Read` -> icon `Eye`
- `Update` -> icon `Pencil`
- `Delete` -> icon `Trash2`
- Optional extended actions by workflow:
  - `Save` -> `Save`
  - `Cancel` -> `X`

## Placement Rules
- Primary CRUD icon cluster must appear in the Record Detail action area.
- Supplemental domain actions (e.g., `Create Part`) may appear adjacent but visually secondary.
- Toolbar-level actions are permitted for module commands (refresh/export/reconcile) but should not replace detail CRUD cluster for entity-level actions.

## Visual Rules
- Icon CRUD buttons:
  - `size="icon"`
  - min visual target `32x32` (`h-8 w-8`)
  - default variant `outline`
- Delete action:
  - destructive color affordance on icon or hover treatment
  - confirmation dialog required before execution
- Hover/focus:
  - visible hover state and keyboard focus ring inherited from design system

## Behavior Rules
- Disable CRUD controls while async operation is in progress.
- Read/Update/Delete require selected record context.
- Delete always routes through confirmation dialog.
- Success and error feedback:
  - toast notifications for operation result
  - inline banner for module-level load or save failures

## Accessibility Rules
- Every icon button must include explicit `aria-label`.
- Tooltip text must describe action in plain language.
- Keyboard operability required for all controls.
- Preserve tab order from primary CRUD actions to secondary actions.

## Responsive Rules
- Action cluster must wrap cleanly on narrow widths (`flex-wrap`).
- Keep icon controls visible and tappable on touch layouts.

## Implementation Notes
- Reference implementation:
  - `AmroInventoryDataGridTemplate` detail action cluster
  - `AmroItemMasterCatalogPanel` standardized detail action cluster

## QA Checklist (Pass/Fail)
- [ ] CRUD icon set matches standard (`Plus`, `Eye`, `Pencil`, `Trash2`) where applicable.
- [ ] Action cluster appears in Record Detail area.
- [ ] Tooltips present for all icon CRUD actions.
- [ ] Delete path always uses confirmation dialog.
- [ ] Disabled state prevents repeated submits during loading.
- [ ] `aria-label` present for all icon CRUD controls.
