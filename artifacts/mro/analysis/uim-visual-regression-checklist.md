# UIM Visual Regression Checklist (AMRO Template Parity)

Date: `2026-04-04`  
Scope: `UIM route-by-route UI parity against AMRO Aircraft List template`  
Reference Template:
- `src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftUnifiedLayout.tsx`
- `src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftListingControls.tsx`
- `src/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftDataTableFrame.tsx`

## Route Coverage Matrix
| Route | Module | Layout Parity | Controls Parity | Data Table Parity | CRUD Buttons Parity | Validation/Feedback Parity | Responsive Parity | Status | QA Evidence |
|---|---|---|---|---|---|---|---|---|---|
| `/dashboard/uim` | Overview | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-overview-empty-320.png`, `uim-overview-populated-1280.png`, `uim-overview-validation-768.png`, `uim-overview-crud-flow.mp4` |
| `/dashboard/uim/item-master` | Item Master | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-item-master-empty-320.png`, `uim-item-master-populated-1280.png`, `uim-item-master-validation-768.png`, `uim-item-master-crud-flow.mp4` |
| `/dashboard/uim/stock-ledger` | Stock Ledger | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-stock-ledger-empty-320.png`, `uim-stock-ledger-populated-1280.png`, `uim-stock-ledger-validation-768.png`, `uim-stock-ledger-crud-flow.mp4` |
| `/dashboard/uim/reservations` | Reservations | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-reservations-empty-320.png`, `uim-reservations-populated-1280.png`, `uim-reservations-validation-768.png`, `uim-reservations-crud-flow.mp4` |
| `/dashboard/uim/issue-consume` | Issue & Consume | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-issue-consume-empty-320.png`, `uim-issue-consume-populated-1280.png`, `uim-issue-consume-validation-768.png`, `uim-issue-consume-crud-flow.mp4` |
| `/dashboard/uim/restock` | Restock | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-restock-empty-320.png`, `uim-restock-populated-1280.png`, `uim-restock-validation-768.png`, `uim-restock-crud-flow.mp4` |
| `/dashboard/uim/locations` | Locations | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-locations-empty-320.png`, `uim-locations-populated-1280.png`, `uim-locations-validation-768.png`, `uim-locations-crud-flow.mp4` |
| `/dashboard/uim/analytics` | Analytics | ☑ | ☑ | ☑ | ☑ | ☑ | ☑ | Code Pass / Capture Pending | `uim-analytics-empty-320.png`, `uim-analytics-populated-1280.png`, `uim-analytics-validation-768.png`, `uim-analytics-crud-flow.mp4` |

## Checkpoint Definitions
- `Layout Parity`: Card framing, panel spacing, section hierarchy, header density match AMRO template.
- `Controls Parity`: Search bar, status filter, clear filter action, create action alignment and sizing.
- `Data Table Parity`: Table frame border, row hover/active behavior, scroll frame, typography and spacing.
- `CRUD Buttons Parity`: Add/Create/Update/Delete/Cancel/Reset order, variants, and icon treatment.
- `Validation/Feedback Parity`: Inline errors, summary alert block, loading/progress behavior, success/error toasts.
- `Responsive Parity`: Breakpoint behavior at `>=320px`, tablet, desktop with no overlap or clipped controls.

## Execution Notes
- Matrix is pre-filled from a code-level parity review against the AMRO Aircraft master-data pattern; runtime screenshots and recordings remain to be attached with the filenames listed above.
- Validate in light and dark themes.
- Capture evidence at three viewport widths:
- `320px` (mobile baseline)
- `768px` (tablet)
- `1280px` (desktop)
- For every route, include:
- empty-state screenshot
- populated records screenshot
- create/edit/delete interaction recording
- validation error screenshot

## QA Sign-off
| Role | Name | Date | Signature/Initials | Notes |
|---|---|---|---|---|
| Frontend Engineer |  |  |  |  |
| QA Engineer |  |  |  |  |
| Product Owner |  |  |  |  |
