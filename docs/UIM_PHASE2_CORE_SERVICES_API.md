# UIM Phase 2 Core Services API (Initial Implementation)

## Scope

This document tracks the initial Phase 2 implementation for:

- Item Master command flows
- Stock Ledger command flows
- Reservation Engine command flows
- Projection replay support

## Command Endpoint

- `POST /api/v2/uim/commands`

### Supported `command_type`

- `RECEIVE`
- `MOVE`
- `RESERVE`
- `CONSUME`

### Request Shape

```json
{
  "command_type": "RECEIVE",
  "idempotency_key": "optional-tenant-unique-key",
  "command_payload": {
    "catalog_item_id": "uuid",
    "quantity": 10
  }
}
```

### Response Shape

```json
{
  "version": "v2",
  "interface": "uim-command-handler",
  "output": {
    "command_id": "uuid",
    "command_type": "RECEIVE",
    "command_status": "applied",
    "applied_output": {}
  }
}
```

## Projection Endpoints

- `POST /api/v2/uim/projections/replay`
  - Rebuilds deterministic inventory snapshots from `uim_inventory_ledger` ordered by `(created_at, id)`.
- `GET /api/v2/uim/projections/items?limit=50&offset=0`
  - Returns projection snapshot rows for dense-grid consumption.

## Database Additions (Phase 2)

- `uim_inventory_commands`
- `uim_inventory_projection_snapshots`

Migration:

- `supabase/migrations/20260405101500_uim_phase2_core_services.sql`

## Test Coverage Added

- `src/pages/api/v2/uim/commands/index.test.ts`
- `src/pages/api/v2/uim/projections/replay.test.ts`
