# AMRO FK Remediation Analysis: work_package_templates.id -> work_order_templates.id

## Scope
- Date: `2026-04-25`
- Repository: `logic-nexus-ai`
- Goal: identify all table-level foreign key dependencies on `work_package_templates.id` and repoint to `work_order_templates.id`.

## FK Dependency Findings

The codebase analysis identified the following table/column relationships as the active or potential FK touchpoints for this migration family:

1. `public.work_packages.work_package_template_id`
2. `public.amro_work_package_template_versions.template_id`
3. `public.work_package_template_task_templates.work_package_template_id`
4. `public.work_package_template_task_temlates.work_package_template_id` (legacy typo table name retained in older migrations)
5. `amro_ops.work_package.work_package_template_id` (Flyway-managed schema path)

Historical migration definitions still contain legacy FK statements (`REFERENCES public.work_package_templates(id)`), but canonical runtime must now target `public.work_order_templates(id)`.

## Schema Actions Executed

Added migration:
- `supabase/migrations/20260425140000_amro_work_order_template_fk_repoint_and_dependency_recompile.sql`

What it does:
- Ensures physical rename fallback: `public.work_package_templates` table -> `public.work_order_templates` when needed.
- Recreates `public.work_package_templates` as compatibility view mapped to `public.work_order_templates`.
- Drops/recreates FK constraints for the discovered columns so they explicitly reference `public.work_order_templates(id)`.
- Performs generic FK remediation pass for any residual constraints still bound to a physical legacy table.
- Recompiles SQL/PLpgSQL functions in `public` and `amro_ops` schemas containing `work_package_templates` token so `public.work_order_templates` becomes canonical.

## Impact Analysis (Codebase-Wide)

### Application + API
- `src`: `55` legacy-token matches across `12` files (mostly compatibility entity keys/routes/tests).
- `services`: `9` legacy-token matches across `3` files (legacy route aliases and compatibility normalization).

### Database Objects and SQL
- `supabase`: `158` legacy-token matches across `24` files (historical migrations, seeds, and function definitions).
- Exact historical FK-reference lines to legacy table: `5` matches across `5` files.

### Flyway/Java SQL Path
- `src/main/resources/db/migration/V2024.06.15.003__work_package_template_task_generation.sql` contains legacy checks/FK references and function logic.
- New Supabase remediation migration includes `amro_ops.work_package` FK repoint handling to cover environments where this schema path is active.

## Documentation Alignment
- Updated `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md`:
  - canonical table inventory entry switched to `public.work_order_templates`;
  - detailed section renamed to `public.work_order_templates`;
  - compatibility-view behavior documented.

## Residual Compatibility Notes
- Legacy entity tokens/route aliases remain in selected UI/API compatibility paths by design during transition.
- Compatibility view (`public.work_package_templates`) is intentionally preserved to avoid runtime breakage while old callers are phased out.
