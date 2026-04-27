# AMRO Schema Refactor Analysis: Template Categories (Work Package -> Work Order)

## Scope
- Date: `2026-04-25`
- Requested rename:
  - `public.amro_work_order_template_categories` -> `public.amro_work_order_template_categories`
- Environment note: development stage with dummy/sample data.

## Migration Delivered
- `supabase/migrations/20260425162000_amro_rename_wp_template_categories_to_wo.sql`

### Refactor Operations Included
1. Renames table to `public.amro_work_order_template_categories`.
2. Renames table-associated constraints using work-order naming normalization.
3. Renames table indexes from `idx_template_categories_*` to `idx_work_order_template_categories_*`.
4. Renames associated RLS policies:
   - `amro_platform_admin_access_template_categories` -> `amro_platform_admin_access_work_order_template_categories`
   - `amro_tenant_franchise_scope_template_categories_read` -> `amro_tenant_franchise_scope_work_order_template_categories_read`
5. Updates table comment to work-order terminology.

## Data Integrity and Compatibility
- Migration is idempotent via `to_regclass(...)` and catalog-based existence checks.
- Partial-state safe:
  - no-op if already renamed,
  - applies remaining renames when constraints/indexes/policies still use legacy names.
- No destructive data operations; existing rows remain in-place.

## Exhaustive Impact Analysis Summary

### Runtime code paths (`src`, `services`, API routes, edge functions)
- No direct runtime references found for `amro_work_order_template_categories`.
- Refactor impact is schema/docs oriented in current repository state.

### Foreign key dependency check (`...template_categories.id`)
- Repository-wide SQL/code scan found **no table columns/constraints** referencing:
  - `public.amro_work_order_template_categories(id)`
  - `public.amro_work_order_template_categories(id)`
- Added defensive migration to remediate live-environment residual FKs if present:
  - `supabase/migrations/20260425170000_amro_fix_template_category_fk_targets.sql`

### Database objects and SQL
- Legacy name references are present in the historical creation migration:
  - `supabase/migrations/20260412100000_amro_work_order_enhanced_schema.sql`
- Canonical forward refactor captured in:
  - `supabase/migrations/20260425162000_amro_rename_wp_template_categories_to_wo.sql`

### Documentation/Test/Config updates completed
- Updated docs:
  - `AMRO_WORK_PACKAGE_IMPLEMENTATION_ROADMAP.md`
  - `AMRO_WORK_PACKAGE_ENHANCEMENT_SUMMARY.md`
  - `AMRO_WORK_PACKAGE_ENHANCEMENT_STRATEGY.md`
  - `AMRO_WORK_PACKAGE_API_IMPLEMENTATION.md`
  - `AMRO_WORK_PACKAGE_TEMPLATE_AUDIT.md`
  - `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md` (added table contract for `public.amro_work_order_template_categories`)
- No explicit test-case source files referenced the old table directly in active test code.

## Verification Checklist
1. Apply migrations:
   - `npx supabase db push --include-all`
2. Validate table rename:
   - `select to_regclass('public.amro_work_order_template_categories');`
   - `select to_regclass('public.amro_work_order_template_categories');` (expected null)
3. Validate constraints/indexes/policies:
   - inspect `pg_constraint` for `uq_work_order_template_category_code` and any renamed PK/check constraints.
   - inspect `pg_indexes` for `idx_work_order_template_categories_tenant`, `idx_work_order_template_categories_type`.
   - inspect `pg_policies` for work-order policy identifiers.
4. Optional FK verification query:
   - `select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype = 'f' and pg_get_constraintdef(oid) ilike '%amro_work%template_categories%';`
