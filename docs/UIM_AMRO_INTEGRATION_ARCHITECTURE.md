# UIM x AMRO Integration Architecture

## Scope
- Integrate AMRO Inventory domain with UIM Inventory services for:
  - item master synchronization
  - stock position synchronization
  - reservation synchronization
  - asset movement visibility
- Preserve tenant/franchise isolation and auditability.

## Integration Endpoint
- API: `/api/v2/amro/inventory/sync`
- File: `src/pages/api/v2/amro/inventory/sync.ts`
- Supported interfaces:
  - `status` (GET)
  - `sync-catalog-and-stock` (POST)
  - `sync-reservations` (POST)
  - `asset-movements` (GET)

## Security Model
- HTTPS enforced.
- Rate limiting enforced.
- Auth required via shared API auth middleware.
- Permission gate: `dashboards.view`.
- AMRO domain access gate via AMRO domain policy.
- Tenant/franchise scope resolved and applied before data operations.

## Data Synchronization Protocol
- Direction: primary flow `AMRO -> UIM` for part master/stock + reservation writes.
- Bidirectional visibility:
  - AMRO writes UIM reservations and stock updates.
  - UIM ledger queried by AMRO for asset movement views.
- Idempotency and data integrity:
  - Catalog upsert uses `tenant_id, sku`.
  - Reservation upsert uses `tenant_id, reservation_token`.
  - Sync event log persisted in `amro_uim_inventory_sync_events`.

## Seeded Master Data Extensions
- New reference entities:
  - `uim_inventory_categories`
  - `uim_inventory_locations`
  - `uim_inventory_suppliers`
  - `uim_inventory_valuation_methods`
- Sync audit entity:
  - `amro_uim_inventory_sync_events`
- Migration:
  - `supabase/migrations/20260406142000_uim_amro_integration_seed.sql`

## Real-time Tracking
- Source-of-truth movement view from `uim_inventory_ledger`.
- AMRO integration reads latest movement records through `asset-movements` interface.
- Integration latency reported per call via `latency_ms` payload field.

## Error Handling and Observability
- API error responses standardized through shared error handler.
- Sync event rows capture:
  - operation
  - records processed/success/failed
  - partial error summary
  - correlation id in metadata
- Application log events:
  - endpoint failure (`amro-uim-sync-endpoint-failed`)
  - sync-event persistence warning

## Performance Considerations
- Bounded row batch size (`max_rows`, capped to 500).
- Limited output rows for movement reads (`limit`, capped to 500).
- Upsert-based writes minimize duplicate lookup overhead.
- Designed for retry-safe sync operations with explicit status outputs.
