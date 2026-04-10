# Stock Ledger P1 Increment 1

## Scope Completed
- Source integration contract hardening for stock movement posting.
- Server-driven filter/sort/pagination enhancements for ledger list API.
- New operational dashboard KPI endpoint for Stock Ledger.

## Implemented Changes
- `src/pages/api/v2/amro/stock-ledger/shared.ts`
  - Added strict source-module validation (`procurement`, `sales`, `warehouse`, `maintenance`, etc.).
  - Enforced `source_reference` for non-UI source modules.
  - Added list filter parser for movement type, part, source module, valuation, effective date range, sort.
- `src/pages/api/v2/amro/stock-ledger/index.ts`
  - Added applied filter support in `GET /stock-ledger`.
  - Included `applied_filters` in response output for traceability.
- `src/pages/api/v2/amro/stock-ledger/dashboard/kpis.ts`
  - Added `GET /api/v2/amro/stock-ledger/dashboard/kpis` returning:
    - pending approvals count
    - latest reconciliation run snapshot
    - total inventory value

## Test Coverage (Increment 1)
- `src/pages/api/v2/amro/stock-ledger/index.test.ts`
- `src/pages/api/v2/amro/stock-ledger/dashboard/kpis.test.ts`
- Regression:
  - `src/pages/api/v2/amro/stock-ledger/[id].test.ts`
  - `src/features/module-amro/components/parts/stockLedgerApi.test.ts`

All targeted tests pass.

## Next P1 Items
- Add scheduled reconciliation policy and execution service.
- Add dashboard KPI UI widgets in `AmroStockLedgerPanel`.
- Add advanced source-reference integrity checks against domain entities.
