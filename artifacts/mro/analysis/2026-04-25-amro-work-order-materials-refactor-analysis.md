# AMRO Schema Refactor Analysis: `work_package_materials` -> `amro_work_order_materials`

## Scope
- Date: `2026-04-25`
- Requested refactor:
  - Column rename: `public.work_package_materials.work_package_id` -> `work_order_id`
  - Table rename: `public.work_package_materials` -> `public.amro_work_order_materials`
  - Repoint inbound FKs from `work_package_materials.id` to `amro_work_order_materials.id`
- Environment: development with dummy/sample data.

## Migration Delivered
- `supabase/migrations/20260425173000_amro_rename_work_package_materials_to_work_order_materials.sql`

### Migration capabilities
1. Renames legacy column to `work_order_id`.
2. Renames legacy table to `amro_work_order_materials`.
3. Renames constraints, indexes, and RLS policy names to work-order naming.
4. Repoints inbound FK constraints from legacy target table to canonical target table in residual/partial states.
5. Updates table comment for work-order terminology.

## FK Dependency Analysis (`work_package_materials.id`)
- Repository-wide scans found no explicit FK DDL lines referencing:
  - `public.work_package_materials(id)`
  - `work_package_materials(id)`
- Despite zero static hits, migration includes defensive inbound-FK repoint logic for live DB drift handling.

## Runtime/App Impact Updates
- Updated runtime reads to canonical table/column:
  - `src/pages/api/v2/amro/work-package-persistence-db.ts`
- Updated table fallback registries:
  - `src/pages/api/v2/amro/overview-kpi.ts`
  - `services/amro-api/src/app.ts`
- Updated anti-corruption ownership mapping:
  - `src/pages/api/v2/amro/anti-corruption-adapter.ts`
- Updated seed/verification automation:
  - `scripts/amro-remote-seed-and-verify.mjs`

## Documentation/Test Impact Updates
- `tests/integration/amro-schema.test.ts` updated to verify `amro_work_order_materials`.
- `docs/AMRO/AMRO_LOW_LEVEL_DESIGN.md` updated table and column/index naming.
- `docs/AMRO/AMRO_QUICK_REFERENCE_GUIDE.md` updated quick reference tuple.
- `Doc/Strategy/03_High_Level_Design.md` updated operational table list.
- `docs/plans/2026-03-19-amro-plugin-implementation-reference.md` updated section heading.
- `docs/plans/2026-03-19-amro-plugin-implementation.md` updated table/index/RLS examples.

## Verification Queries
1. Existence checks:
   - `select to_regclass('public.amro_work_order_materials');`
   - `select to_regclass('public.work_package_materials');` (expected null after migration)
2. Column check:
   - `select column_name from information_schema.columns where table_schema='public' and table_name='amro_work_order_materials' and column_name in ('work_order_id','work_package_id');`
3. FK check:
   - `select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype='f' and (pg_get_constraintdef(oid) ilike '%work_package_materials%' or pg_get_constraintdef(oid) ilike '%amro_work_order_materials%');`
