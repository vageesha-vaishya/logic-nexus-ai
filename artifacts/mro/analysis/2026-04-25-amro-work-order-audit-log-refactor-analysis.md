# AMRO Schema Refactor Analysis: `amro_work_package_audit_log` -> `amro_work_order_audit_log`

## Scope
- Date: `2026-04-25`
- Requested refactor:
  - Table rename: `public.amro_work_package_audit_log` -> `public.amro_work_order_audit_log`
  - Rename associated constraints/indexes/policies to work-order naming
  - Repoint inbound FKs from `amro_work_package_audit_log(id)` to `amro_work_order_audit_log(id)`
- Environment: development with dummy/sample data.

## Migration Delivered
- `supabase/migrations/20260425183000_amro_rename_wp_audit_log_to_wo.sql`

### Migration coverage
1. Renames physical table to `amro_work_order_audit_log`.
2. Renames constraints and indexes from work-package to work-order naming.
3. Renames policy identifiers:
   - `amro_platform_admin_access_audit_log` -> `amro_platform_admin_access_work_order_audit_log`
   - `amro_tenant_franchise_scope_audit_log_insert` -> `amro_tenant_franchise_scope_work_order_audit_log_insert`
   - `amro_tenant_franchise_scope_audit_log_read` -> `amro_tenant_franchise_scope_work_order_audit_log_read`
4. Repoints residual inbound FK constraints still targeting old table id.
5. Updates canonical table comment.

## FK Dependency Analysis (`...audit_log.id`)
- Repository-wide static scan found no FK DDL definitions referencing:
  - `public.amro_work_package_audit_log(id)`
  - `amro_work_package_audit_log(id)`
- Migration still includes defensive inbound-FK repoint logic for live DB drift scenarios.

## Runtime/API Impact Updates
- No active runtime/API/edge-function direct references were found in `src`, `services`, or `tests`.

## Documentation Impact Updates
- Updated references to new canonical table name in:
  - `AMRO_WORK_PACKAGE_IMPLEMENTATION_ROADMAP.md`
  - `AMRO_WORK_PACKAGE_ENHANCEMENT_SUMMARY.md`
  - `AMRO_WORK_PACKAGE_ENHANCEMENT_STRATEGY.md`
  - `AMRO_WORK_PACKAGE_API_IMPLEMENTATION.md`
  - `AMRO_WORK_PACKAGE_TEMPLATE_AUDIT.md`
  - `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md` (Plugins and Modules Documentation Contract)

## Verification Queries
1. Existence checks:
   - `select to_regclass('public.amro_work_order_audit_log');`
   - `select to_regclass('public.amro_work_package_audit_log');` (expected null after migration)
2. Constraint/index/policy checks:
   - `select conname from pg_constraint where conrelid='public.amro_work_order_audit_log'::regclass;`
   - `select indexname from pg_indexes where schemaname='public' and tablename='amro_work_order_audit_log';`
   - `select policyname from pg_policies where schemaname='public' and tablename='amro_work_order_audit_log';`
3. FK target check:
   - `select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype='f' and (pg_get_constraintdef(oid) ilike '%amro_work_package_audit_log%' or pg_get_constraintdef(oid) ilike '%amro_work_order_audit_log%');`
