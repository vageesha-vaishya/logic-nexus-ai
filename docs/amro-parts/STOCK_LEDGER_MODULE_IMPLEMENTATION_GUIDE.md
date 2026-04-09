# AMRO Stock Ledger Module Implementation Guide

## Scope Delivered (Phase 1)
- Real-time inventory transaction logging integrated with `parts_inventory`
- Stock movement ledger with valuation fields (`fifo`, `lifo`, `weighted_average`)
- Negative stock prevention on mutation paths
- Batch posting endpoint for high-volume ingestion
- Reconciliation run API with variance capture
- Standard reports:
  - stock balance
  - transaction history
  - valuation summary
- UI panel with:
  - search
  - movement-type filter
  - reconciliation action
  - CSV export for reports

## Database Artifacts
Migration:
- `supabase/migrations/20260408224500_amro_stock_ledger_module_foundation.sql`

Tables:
- `public.amro_stock_ledger_transactions`
- `public.amro_stock_valuation_layers`
- `public.amro_stock_reconciliation_runs`
- `public.amro_stock_reconciliation_items`

Views:
- `public.amro_stock_balance_summary`
- `public.amro_stock_valuation_summary`

## API Contracts (AMRO API)
Routes implemented in:
- `services/amro-api/src/routes/stock-ledger.routes.ts`

Endpoints:
- `GET /api/v2/amro/stock-ledger`
- `GET /api/v2/amro/stock-ledger/:id`
- `POST /api/v2/amro/stock-ledger`
- `POST /api/v2/amro/stock-ledger/batch`
- `POST /api/v2/amro/stock-ledger/reconcile`
- `GET /api/v2/amro/stock-ledger/reports/stock-balance`
- `GET /api/v2/amro/stock-ledger/reports/transaction-history`
- `GET /api/v2/amro/stock-ledger/reports/valuation-summary`

## Validation and RBAC
- Negative stock prevention enforced before ledger posting.
- Batch payload limit: 500 entries.
- Optional strict role checks via env:
  - `AMRO_STOCK_LEDGER_STRICT_RBAC=true`
- Mutation role allow-list:
  - `platform_admin`
  - `tenant_admin`
  - `maintenance_manager`
  - `inventory_controller`
  - `storekeeper`

## UI Components
- `src/features/module-amro/components/parts/AmroStockLedgerPanel.tsx`
- Integrated in:
  - `src/features/module-amro/components/AmroOwnedWorkspace.tsx`

## Frontend API Adapter
- `src/features/module-amro/components/parts/stockLedgerApi.ts`

Features:
- list transactions
- create single transaction
- create batch transactions
- run reconciliation
- export reports as CSV

## Testing
Backend:
- `services/amro-api/tests/stock-ledger.routes.test.ts`

Frontend:
- `src/features/module-amro/components/parts/stockLedgerApi.test.ts`

Run:
```bash
# frontend root
npm run test -- src/features/module-amro/components/parts/stockLedgerApi.test.ts

# amro api service
cd services/amro-api
npm run test -- stock-ledger.routes.test.ts
```

## UAT Checklist
Personas:
- Storekeeper
- Inventory Controller
- Maintenance Manager
- Finance Analyst

Scenarios:
1. Create receipt transaction and verify stock increment.
2. Attempt issue causing negative stock and verify rejection.
3. Post batch of 50 mixed transactions and verify counts.
4. Run reconciliation and verify run summary + variance items.
5. Export all 3 reports and validate CSV columns.
6. Validate role restrictions when strict RBAC is enabled.
7. Validate UI responsiveness and filtering under large dataset.

Signoff criteria:
- No critical defects.
- Reconciliation output is deterministic.
- CSV exports match API response counts.
- Negative stock prevention works for single and batch paths.

## Deployment Steps
1. Apply migration:
```bash
npx supabase db push --include-all
```
2. Restart AMRO API:
```bash
cd services/amro-api && npm run dev
```
3. Restart frontend:
```bash
npm run dev
```
4. Smoke test:
- `GET /api/v2/amro/stock-ledger`
- Create one transaction from UI
- Run one reconciliation

## Phase 2 Additions
- True valuation engine behavior:
  - FIFO/LIFO consumption from valuation layers on outbound transactions
  - weighted-average layer recalculation on inbound posting
  - valuation consumption trace table for auditability
- Period close controls:
  - open period
  - close period
  - reopen request and approved reopen execution
  - posting lock for closed periods with approval queue fallback
- Approval and audit:
  - approval queue endpoints and decision workflow
  - immutable audit timeline with SHA-256 hash
  - audit export endpoint

Migration:
- `supabase/migrations/20260408233000_amro_stock_ledger_phase2_valuation_and_period_controls.sql`

Additional API endpoints:
- `GET /api/v2/amro/stock-ledger/periods`
- `POST /api/v2/amro/stock-ledger/periods/open`
- `POST /api/v2/amro/stock-ledger/periods/:id/close`
- `POST /api/v2/amro/stock-ledger/periods/:id/reopen-request`
- `POST /api/v2/amro/stock-ledger/periods/:id/reopen`
- `GET /api/v2/amro/stock-ledger/approvals`
- `POST /api/v2/amro/stock-ledger/approvals/:id/decision`
- `GET /api/v2/amro/stock-ledger/audit`
- `GET /api/v2/amro/stock-ledger/audit/export`
