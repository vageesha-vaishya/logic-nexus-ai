# AMRO Task Templates `tt_sequence` Migration

## Purpose

This change renames `public.task_templates.task_template_id` to `public.task_templates.tt_sequence` to clarify that the field is a human-readable sequence and not the UUID primary key (`id`).

## Migration Artifacts

- Up migration: `supabase/migrations/20260409100000_amro_rename_task_templates_task_template_id_to_tt_sequence.sql`
- Rollback migration: `supabase/migrations/rollback/20260409100000_amro_rename_task_templates_task_template_id_to_tt_sequence.down.sql`

## Database Changes

- Rename column:
  - `task_templates.task_template_id` -> `task_templates.tt_sequence`
- Preserve identity and nullability constraints:
  - `GENERATED ALWAYS AS IDENTITY`
  - `NOT NULL`
- Rename sequence and unique constraint names when present:
  - `task_templates_task_template_id_seq` -> `task_templates_tt_sequence_seq`
  - `task_templates_task_template_id_key` -> `task_templates_tt_sequence_key`

## Impact Analysis Summary

Updated references where `task_templates.task_template_id` was used as the sequence column:

- API query layer:
  - `src/pages/api/v2/amro/work-order-templates/task-template-options.ts`
  - `src/pages/api/v2/amro/master-data/[entity].ts`
- AMRO API service layer:
  - `services/amro-api/src/routes/work-order-template.routes.ts`
- Tests:
  - `src/pages/api/v2/amro/work-order-templates/task-template-options.test.ts`
  - `services/amro-api/tests/work-order-template.routes.test.ts`

Reviewed and intentionally kept unchanged references that point to UUID foreign keys in `work_order_template_task_templates.task_template_id` and request payload keys `task_template_id`.

## Deployment Checklist

- Confirm no pending duplicate or incompatible schema changes in the same release.
- Apply migration in staging.
- Verify column metadata:
  - `tt_sequence` exists on `task_templates`
  - identity and not-null properties are preserved
- Verify API behavior:
  - task template options endpoint returns expected sequence values
  - work package template create/update flows still store UUID `task_templates.id` in link table
- Run application test suite and smoke tests on AMRO work package flows.
- Apply migration to production during low-traffic window.
- Post-deploy verify:
  - create work package template
  - edit work package template
  - selected task templates persist correctly

## Rollback Procedure

- Execute rollback migration:
  - `supabase/migrations/rollback/20260409100000_amro_rename_task_templates_task_template_id_to_tt_sequence.down.sql`
- Re-run post-rollback smoke tests for work package template create/update/read flows.
- If rollback is partial or blocked by unexpected schema drift, stop writes to affected AMRO flows and reconcile schema manually before resuming traffic.
