# Work Packages -> Work Orders: Impact Analysis

Date: 2026-04-25  
Scope: AMRO database, APIs, frontend, service layer

## Rename Plan

- Table rename: `public.work_orders` -> `public.work_orders`
- Supporting table rename: `public.work_orders_title` -> `public.work_order_titles`
- Column rename (schema-wide in `public`):
  - `work_order_template_id` -> `work_order_template_id`
  - `work_order_title_id` -> `work_order_title_id`
- Domain rename:
  - `public.work_order_status` -> `public.work_order_status`
- Backward compatibility:
  - Compatibility domain alias recreated: `public.work_order_status`
  - Compatibility views created:
    - `public.work_orders` (maps old column aliases to `work_orders`)
    - `public.work_orders_title` (maps to `work_order_titles`)

## Impact Inventory Summary

- DB schema migrations:
  - New forward migration: `supabase/migrations/20260425160000_amro_rename_work_orders_to_work_orders.sql`
  - New rollback script: `scripts/sql/rollback_20260425160000_work_orders_to_work_orders.sql`
- API layer updates:
  - `src/pages/api/v2/amro/**`
  - `services/amro-api/src/**`
- Frontend updates:
  - `src/features/module-amro/components/work-orders/**`
  - `src/features/module-amro/hooks/useAmroOverviewKpi.ts`
- Test updates:
  - `src/pages/api/v2/amro/**/*.test.ts`
  - `services/amro-api/tests/**`

## High-Risk Areas Checked

- Dynamic SQL and RPC integration for work order creation/persistence.
- FK-based joins from `tasks`, `maintenance_events`, reservations, and emergency work order APIs.
- Work-order template linking flow using renamed template/title identifiers.
- Dashboard KPI and module catalog metadata that references primary AMRO tables.

## Migration Validation Checks

- Forward migration assertions:
  - `public.work_orders` exists.
  - `public.work_orders.work_order_template_id` exists.
  - `public.work_orders.work_order_title_id` exists.
- Rename loops cover all `public` tables with legacy column names.
- Constraint/index rename pass covers old name patterns.

## Rollback Procedure

1. Run `scripts/sql/rollback_20260425160000_work_orders_to_work_orders.sql`.
2. Re-run smoke tests against:
   - Work-order list/create/update APIs
   - Emergency work order endpoint
   - Dashboard KPI endpoint
3. Verify old compatibility object names no longer needed after rollback.

## Post-Deploy Verification Checklist

1. Confirm schema:
   - `select to_regclass('public.work_orders');`
   - `select column_name from information_schema.columns where table_schema='public' and table_name='work_orders' and column_name in ('work_order_template_id','work_order_title_id');`
2. Confirm compatibility objects:
   - `select to_regclass('public.work_orders');`
   - `select to_regclass('public.work_orders_title');`
3. Run API smoke tests:
   - create work order
   - list work orders
   - attach template/title mapping
4. Run frontend smoke:
   - open AMRO Work Orders page
   - create from wizard
   - verify list/detail renders

