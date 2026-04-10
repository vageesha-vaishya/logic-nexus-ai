# Low-Stock Alerts and Multi-Warehouse Editing Specification

## Objective
Provide scalable, record-accurate editing workflows for card-based data views where each card may represent multiple records.

## Scope
- `Automated Low-Stock Alerts` card section in `AmroPartsInventoryWorkbench`.
- `Warehouse Status - Multi-Warehouse` card section in `AmroPartsInventoryWorkbench`.

## Problem Summary
- Prior behavior allowed card-level actions but did not provide robust per-record selection and batch-edit orchestration for multi-record cards.
- High-volume card datasets required search/filter and progressive loading to remain usable.

## Implemented UX Model

### 1) Low-Stock Alerts (Multi-record cards)
- Records are grouped by warehouse location into alert cards.
- Each card now includes:
  - explicit editable-field indicator
  - per-record selection row
  - checkboxes for batch selection
  - individual `Edit` and `Delete` actions bound to selected record
  - `Batch Edit` trigger for selected record set
  - progressive loading (`Load More`) for large record lists
  - search filtering across card records
- Validation guardrails:
  - prevents edit/delete when selected record fails warehouse integrity rules.

### 2) Warehouse Status - Multi-Warehouse (High-volume cards)
- Each warehouse card now includes:
  - search-aware record list inside card
  - per-record single-selection for direct edit
  - checkbox multi-selection for batch edit queue
  - visible selected-count indicator
  - `Load More` progressive record reveal
  - editable fields guidance
- Validation guardrails:
  - quantity consistency checks before enabling edit/delete.

## Validation Rules (Warehouse-specific)
- `quantity_available >= 0`
- `quantity_available <= quantity_on_hand`
- `reorder_level >= min_serviceable_qty`

If a rule fails:
- card displays validation warning
- direct edit and delete for selected record are disabled

## Individual vs Batch Edit Strategy
- **Individual edit**:
  - user selects a single record
  - `Edit` opens existing update workflow (`onUpdateRecord`)
- **Batch edit**:
  - user checks multiple records
  - `Batch Edit` initiates sequential edit flow
  - first record opens immediately; user completes each in sequence
  - status notice clarifies queued behavior

Rationale:
- current callback contracts are record-oriented.
- sequential queue provides safe incremental updates without requiring immediate backend batch API changes.

## Data Synchronization Strategy
- selection state is keyed by logical card/group (`location` or alert group key).
- when source records refresh:
  - keep selection if selected record still exists
  - otherwise fall back to first available record
- progressive loading state is preserved per group.
- periodic refresh remains active via existing 30-second sync.

## Concurrent Edit/Error Handling
- stale selection protection:
  - if selected ID no longer exists after refresh, automatic fallback occurs.
- operation-level failures continue to surface through existing module error and toast pathways.
- card-level validation blocks risky edits before update callbacks run.

## Performance and Scalability Controls
- in-card search limits visible rows to relevant records.
- progressive loading avoids rendering full large lists at once.
- batch operations are queued sequentially to reduce UI lock and conflict risk.

## Test Criteria

### Functional
- Select/edit single record within a multi-record alert card.
- Select/edit single record within multi-warehouse card.
- Select multiple records and trigger batch edit queue notice.
- Ensure edit/delete disabled for validation-failing selected record.

### Data Volume
- **10 records/card**: no clipping, direct edit and batch selection behave correctly.
- **50 records/card**: search + load-more remain responsive.
- **100+ records/card**: no major interaction lag, progressive loading maintains usability.

### Consistency
- All card edit controls use consistent labeling and interaction patterns.
- Search and selected-count indicators remain accurate after refresh.

### Accessibility
- Checkbox and selection controls are keyboard reachable.
- Status notice uses `aria-live="polite"` for batch queue feedback.
