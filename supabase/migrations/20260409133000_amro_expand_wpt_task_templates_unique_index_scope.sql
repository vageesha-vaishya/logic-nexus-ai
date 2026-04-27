BEGIN;

DO $migration$
BEGIN
  IF to_regclass('public.work_order_template_task_templates') IS NULL THEN
    RAISE EXCEPTION 'Table public.work_order_template_task_templates does not exist';
  END IF;
END
$migration$;

DROP INDEX IF EXISTS public.uq_wpt_task_temlates_tenant_franchise_model_task_template;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wpt_task_temlates_tenant_franchise_model_task_template
ON public.work_order_template_task_templates
USING btree (
  tenant_id,
  COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
  model_id,
  work_order_template_id,
  task_template_id
)
TABLESPACE pg_default;

COMMIT;
