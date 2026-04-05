# UIM-AMRO Deccan Seed Verification Report

## Objective
- Confirm Deccan tenant has complete AMRO-aligned UIM seeded inventory data.
- Confirm data is visible through SQL and integration API interfaces.

## Execution Steps
1. Apply latest migrations.
2. Run Deccan-specific seed refresh script.
3. Run Deccan verification SQL report.
4. Probe AMRO/UIM integration API endpoints with Deccan tenant headers.

## Commands
```bash
supabase db push
psql "$DATABASE_URL" -f scripts/sql/seed_uim_amro_deccan.sql
psql "$DATABASE_URL" -f scripts/sql/verify_uim_amro_deccan_seed.sql
```

## API Probe Commands
```bash
curl -sS "http://localhost:3000/api/v2/amro/inventory/sync?interface=status" \
  -H "X-Tenant-Id: <DECCAN_TENANT_UUID>" \
  -H "Authorization: Bearer <TOKEN>"

curl -sS "http://localhost:3000/api/v2/amro/inventory/sync?interface=asset-movements&limit=25" \
  -H "X-Tenant-Id: <DECCAN_TENANT_UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

## Verification Criteria
- `categories_count >= 2`
- `locations_count >= 3`
- `suppliers_count >= 2`
- `valuation_methods_count >= 2`
- `catalog_count >= 2`
- `inventory_count >= 2`
- `reservations_count >= 1`
- `ledger_count >= 2`
- `sync_events_count >= 1`
- Key records exist:
  - `DECCAN-AMRO-PUMP-001`
  - `DECCAN-AMRO-FLTR-010`
  - `deccan-amro-reservation-001`

## Result Summary
- Status: `PENDING_EXECUTION`
- Notes:
  - Update to `PASS` after SQL and API probes satisfy criteria.
