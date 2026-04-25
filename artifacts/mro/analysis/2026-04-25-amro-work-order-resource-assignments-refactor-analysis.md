# AMRO Schema Refactor Analysis: Resource Assignments (Work Package -> Work Order)

## Scope
- Date: `2026-04-25`
- Request: rename
  - `public.amro_work_package_resource_assignments.work_package_id` -> `work_order_id`
  - `public.amro_work_package_resource_assignments` -> `public.amro_work_order_resource_assignments`
- Environment note: development phase with dummy/sample data.

## Migration Delivered
- `supabase/migrations/20260425153000_amro_rename_wp_resource_assignments_to_wo.sql`

### Operations Performed
1. Renames column `work_package_id` -> `work_order_id` when needed.
2. Renames table `amro_work_package_resource_assignments` -> `amro_work_order_resource_assignments` when needed.
3. Renames constraints on the table to work-order naming patterns.
4. Renames indexes on the table to work-order naming patterns.
5. Renames RLS policies:
   - `amro_platform_admin_access_wp_resource_assignments` -> `amro_platform_admin_access_wo_resource_assignments`
   - `amro_tenant_franchise_scope_wp_resource_assignments_read` -> `amro_tenant_franchise_scope_wo_resource_assignments_read`
6. Updates table comment to work-order terminology.

### Safety Characteristics
- Idempotent checks via `to_regclass(...)` and catalog lookups.
- Handles partial migration states (already renamed table or column).
- Avoids destructive data operations (no data copy/truncate/drop-data behavior).

## Impact Analysis Summary

### Direct table-name references
- Runtime application/API code (`src`, `services`): no direct references found to `amro_work_package_resource_assignments`.
- Historical schema migration reference remains in:
  - `supabase/migrations/20260412100000_amro_work_package_enhanced_schema.sql` (original creation migration).
- Refactor migration references:
  - `supabase/migrations/20260425153000_amro_rename_wp_resource_assignments_to_wo.sql`.

### Documentation updates completed
- `AMRO_WORK_PACKAGE_IMPLEMENTATION_ROADMAP.md`
- `AMRO_WORK_PACKAGE_ENHANCEMENT_SUMMARY.md`
- `AMRO_WORK_PACKAGE_ENHANCEMENT_STRATEGY.md`
- `AMRO_WORK_PACKAGE_API_IMPLEMENTATION.md`
- `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md` (added formal table contract entry for `public.amro_work_order_resource_assignments`)

### Constraints/Indexes/Policies and Dependent Objects
- Constraint names: normalized via dynamic catalog-driven rename.
- Index names: normalized via `pg_indexes` rename loop.
- RLS policies: explicit rename for the two known policy identifiers.
- Foreign key relationship target remains `public.work_packages(id)` (column rename only; no relationship target change requested).

## Residual Legacy References (Intentional)
- Original naming remains in older migration files as immutable historical record of prior schema state.
- This is acceptable because the new migration applies the canonical rename in forward migration flow.

## Verification Guidance
1. Run:
   - `npx supabase db push --include-all`
2. Validate in SQL editor:
   - `select to_regclass('public.amro_work_order_resource_assignments');`
   - `select to_regclass('public.amro_work_package_resource_assignments');` (should be null after successful rename)
   - Inspect columns for `public.amro_work_order_resource_assignments` and confirm `work_order_id` exists.
3. Verify policy/index names via:
   - `pg_policies` for `amro_platform_admin_access_wo_resource_assignments`, `amro_tenant_franchise_scope_wo_resource_assignments_read`
   - `pg_indexes` entries prefixed `idx_wo_resource_assignments_...`
