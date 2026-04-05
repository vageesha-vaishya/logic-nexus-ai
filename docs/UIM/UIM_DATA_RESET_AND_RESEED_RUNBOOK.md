# UIM Data Reset and Reseed Runbook

## Purpose
- Truncate all UIM data tables while preserving schema, constraints, and indexes.
- Seed a realistic aviation MRO baseline dataset for verification and integration testing.
- Provide auditable before/after row counts.

## Scope
- Data-only reset for UIM tables (no DDL drops).
- Preserves referential integrity by using `TRUNCATE ... CASCADE` in a controlled statement.
- Seed script populates 900 catalog-linked aviation inventory records with reservations, ledger events, and projection snapshots.

## Files
- Cleanup SQL: `scripts/sql/uim_cleanup_truncate_with_audit.sql`
- Seed SQL: `scripts/sql/uim_seed_aviation_mro_dataset.sql`
- Orchestration script: `scripts/uim-reset-and-seed.sh`

## Pre-check
1. Confirm target DB:
   - `SUPABASE_DB_URL` points to the intended environment.
2. Take backup/snapshot before cleanup.
3. Confirm no critical write jobs are running.

## Execute
```bash
./scripts/uim-reset-and-seed.sh
```

## What the cleanup does
- Captures `before_count` and `after_count` for each UIM table.
- Truncates UIM datasets with `RESTART IDENTITY CASCADE`.
- Emits a tabular audit result:
  - `table_name`
  - `before_count`
  - `after_count`

## Verification SQL
```sql
select count(*) as catalog_items from public.uim_catalog_items;
select count(*) as inventory_items from public.uim_inventory_items;
select count(*) as mro_profiles from public.uim_mro_item_profiles;
select count(*) as reservations from public.uim_inventory_reservations;
select count(*) as ledger_events from public.uim_inventory_ledger;
select count(*) as projection_snapshots from public.uim_inventory_projection_snapshots;
select count(*) as form_records from public.uim_form_records;
```

Expected baseline after seed:
- Catalog items: ~900
- Inventory items: ~900
- MRO profiles: ~900
- Reservations: ~300
- Ledger events: ~1200
- Projection snapshots: ~900

## Rollback
- Restore database snapshot taken before the reset.
- Do not re-run cleanup without snapshot confirmation in production.

## Notes
- The seed dataset is aviation-focused for AMRO integration verification but uses generic UIM tables.
- UIM remains reusable for non-aviation domains by replacing domain attributes and integration mappings.
