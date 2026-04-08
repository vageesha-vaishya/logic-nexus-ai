# AMRO Parts Inventory Workbench

## Component
- `AmroPartsInventoryWorkbench`
- Storybook: `AMRO/Parts/AmroPartsInventoryWorkbench`

## Purpose
Provide a production-oriented parts inventory management workbench for AMRO with:
- operational KPI cards,
- status and criticality distribution visualizations,
- filter controls,
- multi-layout grid-detail navigation,
- explicit loading/empty/error/ready states.

## Data Model
- Source shape: `PartInventoryRecord` from `mockPartsInventoryData.ts`.
- Supports text, numeric, date, boolean-like state badges, and nested metadata objects.

## Key Props
- `state`: `loading | empty | ready | error`
- `records`: inventory records dataset
- `viewMode`: `horizontal-split | vertical-split | stacked-auto`
- `density`: `compact | normal | comfortable`
- `scrollBehavior`: `virtualization | pagination | infinite-scroll`
- `onRecordSelectionChange`, `onScrollPositionChange`, `onViewModeChange`
- `onRetry`, `onRefresh`, `onCreatePart`

## Accessibility
- Labeled controls for filters and mode switches.
- Keyboard-accessible grid/detail interactions inherited from template.
- ARIA labels and live region behavior in base template.
- Works with high-contrast mode switch in underlying grid template.

## Performance Notes
- Uses memoized column definitions and metric calculations.
- Uses virtualized/paginated/infinite-scroll data navigation.
- Debounced scroll event propagation from base template.

## Storybook Scenarios
- `Populated`
- `Loading`
- `Empty`
- `ErrorState`
- `VerticalWorkflow`
- `ResponsiveStacked`

## Mock Data Utilities
- `generatePartInventoryRecords(options)`
- `computePartInventoryMetrics(records)`
