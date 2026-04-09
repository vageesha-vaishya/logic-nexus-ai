# AMRO Parts CRUD Interface Comparison Matrix

## Scope
- `Parts Inventory` (`AmroPartsInventoryWorkbench` + `AmroInventoryDataGridTemplate`)
- `Item Master` (`AmroItemMasterCatalogPanel`)
- `Stock Ledger` (`AmroStockLedgerPanel`)
- Operations/Insights panels (`AmroPartsModulePanels`) where CRUD is minimal or read-focused

## Current Variation Matrix
| Module | CRUD Entry Pattern | Iconography | Button Placement | Tooltip/Help | Disabled State Handling | Accessibility Notes |
|---|---|---|---|---|---|---|
| Parts Inventory | Dedicated icon cluster in Record Detail | `Plus`, `Eye`, `Pencil`, `Trash2`, `Save`, `X` | Top-right of detail panel | Full tooltips + keyboard shortcut labels | Driven by `crudPermissions`, record selection, edit mode | `aria-label`, `aria-keyshortcuts`, keyboard shortcuts |
| Item Master (before standardization) | Mixed text and icon actions | `Plus`, text `Edit`, `Trash2` | Split between toolbar and detail text buttons | No action-level tooltip cluster in detail | Partial disabled handling | Basic aria via native button labeling |
| Item Master (after standardization) | Icon cluster aligned with Parts Inventory + supporting action | `Plus`, `Eye`, `Pencil`, `Trash2` (+ optional `Create Part`) | Detail panel action row | Tooltip labels per action | Consistent disabled state via `dialogLoading` | Explicit `aria-label` per icon action |
| Stock Ledger | Toolbar command-heavy CRUD + transaction dialog | `Plus`, `Download`, `Refresh`, etc. | Toolbar + dialog footer | Limited action-level tooltips | Dialog/operation-specific disabling | Accessible labels on controls, no icon CRUD cluster |
| Operations/Insights panels | Mostly read/list interactions | Varies (`Badge`, actionless cards) | Within panel content | Minimal | N/A in read-focused panels | Table/list semantics and selection patterns |

## Item Master vs Parts Inventory: Specific Differences Addressed
- **Icon set parity**: Item Master now uses the same core CRUD icon language (`Create`, `Read`, `Update`, `Delete`) as Parts Inventory.
- **Action placement**: Item Master actions moved into a dedicated detail action cluster rather than mixed text buttons.
- **Tooltip behavior**: Added consistent hover tooltip cues to match Parts Inventory discoverability.
- **Disabled behavior**: Item Master CRUD icon actions now share explicit disabled gating during loading.
- **Accessibility**: Added explicit `aria-label` for each CRUD icon button in Item Master.

## Remaining Intentional Differences
- Parts Inventory includes `Save`/`Cancel` icon controls in an in-place editable detail workflow.
- Item Master uses modal form editing with save/cancel in dialog footer; this is functionally different by domain requirement.
