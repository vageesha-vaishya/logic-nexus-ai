# Stock Ledger P0 API Specification

## Endpoints
- `GET /api/v2/amro/stock-ledger`
  - paginated ledger transactions (`page`, `page_size|limit`)
- `POST /api/v2/amro/stock-ledger`
  - post stock movement with validation and idempotency
- `GET /api/v2/amro/stock-ledger/:id`
  - read transaction detail
- `PATCH /api/v2/amro/stock-ledger/:id`
  - update mutable fields (`notes`, `source_reference`, `metadata`)
- `DELETE /api/v2/amro/stock-ledger/:id`
  - void transaction via compensating reversal
- `GET /api/v2/amro/stock-ledger/balance`
  - current stock balances
- `GET /api/v2/amro/stock-ledger/reports/stock-balance`
- `GET /api/v2/amro/stock-ledger/reports/transaction-history`
- `GET /api/v2/amro/stock-ledger/reports/valuation-summary`

## Validation and Error Scenarios
- Invalid SKU / `part_inventory_id` -> rejected.
- `quantity_delta = 0` -> rejected.
- Invalid movement type -> rejected.
- Insufficient stock or negative available balance -> rejected.
- Duplicate idempotency key -> existing transaction is returned (idempotent behavior).

## Concurrency/Locking
- Posting and voiding are executed through SQL functions:
  - `amro_stock_ledger_post_transaction`
  - `amro_stock_ledger_void_transaction`
- Functions lock `parts_inventory` rows with `FOR UPDATE` to prevent race conditions.

## Audit Trail
- Each posted/voided event writes immutable evidence into `amro_stock_audit_timeline`.
- Transaction table stores `idempotency_key`, `is_voided`, `voided_at`, `voided_by`, `void_reason`.

## Performance Baseline Targets (P0)
- p95 `POST /stock-ledger` <= 250ms for single movement under normal load.
- p95 `GET /stock-ledger` <= 500ms for page size 50.
- p95 `GET /stock-ledger/balance` <= 400ms.

## Testing
- Unit/API route tests:
  - `src/pages/api/v2/amro/stock-ledger/index.test.ts`
  - `src/pages/api/v2/amro/stock-ledger/[id].test.ts`
- Existing adapter tests:
  - `src/features/module-amro/components/parts/stockLedgerApi.test.ts`
