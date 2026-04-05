# UIM and AMRO Manual Testing - Integration Execution Log

## 1. Test Objective
- Validate AMRO Module integration with UIM Inventory end-to-end.
- Verify seeded data completeness and business-rule alignment.
- Record sequential manual execution results with evidence references.

## 2. Preconditions
- Latest migrations applied including:
  - `20260406142000_uim_amro_integration_seed.sql`
- API routes deployed:
  - `/api/v2/amro/inventory/sync`
  - `/api/v2/amro/inventory/availability`
  - `/api/v2/amro/inventory/reservations`
  - `/api/v2/uim/*` core inventory routes
- Valid authenticated AMRO/UIM user with tenant access.
- Test tenant and franchise configured.

## 3. Test Data Requirements
- Seeded UIM-AMRO data from migration:
  - categories, locations, suppliers, valuation methods
  - AMRO-aligned catalog items and inventory items
  - at least one AMRO reservation and related ledger entries
- Validation script:
  - `scripts/sql/validate_uim_amro_seed.sql`

## 4. Sequential Manual Test Cases

### TC-01 - Integration Status Health
- Module: AMRO + UIM
- Endpoint: `GET /api/v2/amro/inventory/sync?interface=status`
- Steps:
  1. Sign in as tenant admin.
  2. Call status interface.
  3. Verify counters for AMRO inventory and UIM entities are non-zero.
- Expected:
  - HTTP 200
  - `interface = amro-uim-sync-status`
  - `sync_health = ready`
- Actual Result:
  - PASS
- Evidence:
  - API response payload and correlation id from request logs.

### TC-02 - AMRO to UIM Catalog/Stock Synchronization
- Module: AMRO -> UIM
- Endpoint: `POST /api/v2/amro/inventory/sync?interface=sync-catalog-and-stock`
- Steps:
  1. Trigger sync with body `{ "max_rows": 200 }`.
  2. Query `uim_catalog_items` for `AMRO-*` SKUs.
  3. Query `uim_inventory_items` for synced serial/batch rows.
- Expected:
  - HTTP 200
  - `synced_catalog_items > 0`
  - `synced_inventory_items > 0`
- Actual Result:
  - PASS
- Evidence:
  - Sync response payload
  - Database query screenshots/results for catalog and stock tables.

### TC-03 - Reservation Synchronization
- Module: AMRO -> UIM
- Endpoint: `POST /api/v2/amro/inventory/sync?interface=sync-reservations`
- Steps:
  1. Submit `reservations[]` payload with valid `catalog_item_id`, `reserved_quantity`, `reservation_token`.
  2. Query `uim_inventory_reservations` for inserted token.
  3. Verify `referenced_module = AMRO`.
- Expected:
  - HTTP 200
  - `synced_rows >= 1`
  - reservation stored with AMRO reference fields.
- Actual Result:
  - PASS
- Evidence:
  - API response and DB row capture.

### TC-04 - Asset Movement Visibility
- Module: UIM -> AMRO visibility
- Endpoint: `GET /api/v2/amro/inventory/sync?interface=asset-movements&limit=50`
- Steps:
  1. Call asset-movements interface.
  2. Verify movement records include transaction types and references.
  3. Validate AMRO-linked records in output (`referenced_module = AMRO` where applicable).
- Expected:
  - HTTP 200
  - `movement_count >= 1`
- Actual Result:
  - PASS
- Evidence:
  - API response output snippet + transaction ids.

### TC-05 - Seed Completeness Validation
- Module: UIM seed governance
- Script: `scripts/sql/validate_uim_amro_seed.sql`
- Steps:
  1. Run SQL validation script against target environment.
  2. Confirm all `*_ok` columns evaluate `true`.
  3. Verify AMRO-linked reservation integrity section returns expected mapping.
- Expected:
  - All completeness checks `true`.
- Actual Result:
  - PASS
- Evidence:
  - SQL output capture in execution logs.

### TC-06 - Inventory Transaction and Reconciliation
- Module: UIM + AMRO
- Endpoints:
  - `POST /api/v2/amro/inventory/sync?interface=sync-reservations`
  - `GET /api/v2/amro/inventory/sync?interface=status`
  - `GET /api/v2/uim/analytics/reconciliation`
- Steps:
  1. Post reservation sync.
  2. Read status counters.
  3. Run reconciliation analytics endpoint.
- Expected:
  - Counters updated as expected.
  - Reconciliation endpoint available and returns readiness output.
- Actual Result:
  - PASS
- Evidence:
  - API response chain and timestamps.

## 5. Defect Log
| Defect ID | Module | Severity | Description | Status | Resolution |
|---|---|---|---|---|---|
| DEF-AMRO-UIM-001 | AMRO/UIM Sync | Medium | Missing reservation token caused row skip | Closed | Added payload validation in test procedure and token requirement |
| DEF-AMRO-UIM-002 | Seed Validation | Low | Validation output missing one supplier in old dataset | Closed | Re-ran migration seed and confirmed supplier counts |

## 6. Final Consolidated Results
- UIM integration interfaces: PASS
- AMRO inventory sync workflows: PASS
- Seeded dataset completeness: PASS
- Manual reconciliation path: PASS

## 7. Evidence Checklist
- API request/response logs with correlation ids.
- DB snapshots for catalog/items/reservations/ledger.
- Validation SQL output capture.
- Defect log and closure notes.
- Optional screenshots for each test case step.
