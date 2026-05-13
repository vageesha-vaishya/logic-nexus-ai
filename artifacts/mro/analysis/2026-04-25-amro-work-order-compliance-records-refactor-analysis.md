# AMRO Schema Refactor Analysis: `amro_work_order_compliance_records` -> `amro_work_order_compliance_records`

## Scope
- Date: `2026-04-25`
- Requested refactor:
  - Column rename: `public.amro_work_order_compliance_records.work_order_id` -> `work_order_id`
  - Table rename: `public.amro_work_order_compliance_records` -> `public.amro_work_order_compliance_records`
  - Repoint inbound FKs from `amro_work_order_compliance_records(id)` to `amro_work_order_compliance_records(id)`
- Environment: development with dummy/sample data.

## Migration Delivered
- `supabase/migrations/20260425174000_amro_rename_wp_compliance_records_to_wo.sql`

### Migration coverage
1. Renames legacy FK column to `work_order_id`.
2. Renames table to `amro_work_order_compliance_records`.
3. Renames constraints/indexes to work-order naming conventions (`wo_compliance_records`).
4. Renames RLS policy identifiers:
   - `amro_platform_admin_access_wp_compliance_records` -> `amro_platform_admin_access_wo_compliance_records`
   - `amro_tenant_franchise_scope_wp_compliance_records_read` -> `amro_tenant_franchise_scope_wo_compliance_records_read`
5. Repoints any residual inbound FK constraints still referencing the old table id.
6. Preserves data with in-place `ALTER ... RENAME` operations and idempotent guards for partial rollout states.

## FK Dependency Analysis (`...compliance_records.id`)
- Repository-wide scan found no static FK DDL directly targeting:
  - `public.amro_work_order_compliance_records(id)`
  - `amro_work_order_compliance_records(id)`
- Defensive runtime migration logic was still added to repoint inbound FKs in live DB drift scenarios.

## Runtime and API Impact Updates
- Updated compliance API to use canonical table/column:
  - `src/pages/api/v2/amro/work-orders/[id]/compliance-records.ts`
- Added transition-safe fallback logic to legacy table/column while environments converge.

## Documentation Impact Updates
- `AMRO_WORK_PACKAGE_IMPLEMENTATION_ROADMAP.md`
- `AMRO_WORK_PACKAGE_ENHANCEMENT_SUMMARY.md`
- `AMRO_WORK_PACKAGE_ENHANCEMENT_STRATEGY.md`
- `AMRO_WORK_PACKAGE_API_IMPLEMENTATION.md`
- `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md` (Plugins and Modules Documentation Contract updated)

## Verification Queries
1. Existence checks:
   - `select to_regclass('public.amro_work_order_compliance_records');`
   - `select to_regclass('public.amro_work_order_compliance_records');` (expected null after migration)
2. Column check:
   - `select column_name from information_schema.columns where table_schema='public' and table_name='amro_work_order_compliance_records' and column_name in ('work_order_id','work_order_id');`
3. FK check:
   - `select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype='f' and (pg_get_constraintdef(oid) ilike '%amro_work_order_compliance_records%' or pg_get_constraintdef(oid) ilike '%amro_work_order_compliance_records%');`
