# AMRO Schema Refactor Analysis: `amro_work_package_template_versions` -> `amro_work_order_template_versions`

## Scope
- Date: `2026-04-25`
- Requested refactor:
  - Table rename: `public.amro_work_package_template_versions` -> `public.amro_work_order_template_versions`
  - Rename associated constraints/indexes/policies to work-order naming conventions
  - Repoint inbound FKs from `amro_work_package_template_versions(id)` to `amro_work_order_template_versions(id)`
- Environment: development with dummy/sample data.

## Migration Delivered
- `supabase/migrations/20260425181000_amro_rename_wp_template_versions_to_wo.sql`

### Migration coverage
1. Renames table to `amro_work_order_template_versions`.
2. Renames constraints and indexes to work-order template version naming.
3. Renames policy identifiers:
   - `amro_platform_admin_access_template_versions` -> `amro_platform_admin_access_work_order_template_versions`
   - `amro_tenant_franchise_scope_template_versions_read` -> `amro_tenant_franchise_scope_work_order_template_versions_read`
4. Repoints residual inbound FK constraints targeting old table id.
5. Updates table comment to canonical work-order terminology.

## FK Dependency Analysis (`...template_versions.id`)
- Repository-wide scan found no static FK DDL targeting:
  - `public.amro_work_package_template_versions(id)`
  - `amro_work_package_template_versions(id)`
- Defensive inbound-FK repoint logic is still included in migration for live DB drift/partial states.

## Runtime/API Impact Updates
- Updated API route handlers to use canonical table name:
  - `src/pages/api/v2/amro/work-package-template-versions/index.ts`
  - `src/pages/api/v2/amro/work-package-template-versions/[id].ts`
  - `src/pages/api/v2/amro/work-package-template-versions/[id]/submit.ts`
  - `src/pages/api/v2/amro/work-package-template-versions/[id]/approve.ts`
  - `services/amro-api/src/app.ts`

## Documentation and SQL Utility Impact Updates
- Updated affected documents and utilities:
  - `AMRO_WORK_PACKAGE_API_IMPLEMENTATION.md`
  - `AMRO_WORK_PACKAGE_ENHANCEMENT_STRATEGY.md`
  - `AMRO_WORK_PACKAGE_ENHANCEMENT_SUMMARY.md`
  - `AMRO_WORK_PACKAGE_IMPLEMENTATION_ROADMAP.md`
  - `AMRO_WORK_PACKAGE_TEMPLATE_AUDIT.md`
  - `AMRO_WORK_PACKAGE_TEMPLATES_MODULE.md`
  - `fix_wpt_columns.sql`
  - `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md` (Plugins and Modules Documentation Contract)

## Verification Queries
1. Existence checks:
   - `select to_regclass('public.amro_work_order_template_versions');`
   - `select to_regclass('public.amro_work_package_template_versions');` (expected null after migration)
2. Constraint/index/policy checks:
   - `select conname from pg_constraint where conrelid = 'public.amro_work_order_template_versions'::regclass;`
   - `select indexname from pg_indexes where schemaname='public' and tablename='amro_work_order_template_versions';`
   - `select policyname from pg_policies where schemaname='public' and tablename='amro_work_order_template_versions';`
3. FK target check:
   - `select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype='f' and (pg_get_constraintdef(oid) ilike '%amro_work_package_template_versions%' or pg_get_constraintdef(oid) ilike '%amro_work_order_template_versions%');`
