BEGIN;

DO $migration$
DECLARE
  deleted_count bigint := 0;
BEGIN
  IF to_regclass('public.work_order_template_task_templates') IS NULL THEN
    RAISE EXCEPTION 'Table public.work_order_template_task_templates does not exist';
  END IF;

  WITH ranked_rows AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          tenant_id,
          COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
          model_id
        ORDER BY
          updated_at DESC NULLS LAST,
          created_at DESC NULLS LAST,
          id DESC
      ) AS row_rank
    FROM public.work_order_template_task_templates
  ),
  duplicate_rows AS (
    SELECT id
    FROM ranked_rows
    WHERE row_rank > 1
  )
  DELETE FROM public.work_order_template_task_templates t
  USING duplicate_rows d
  WHERE t.id = d.id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Removed % duplicate work_order_template_task_templates rows before unique index rebuild', deleted_count;
END
$migration$;

DROP INDEX IF EXISTS public.uq_wpt_task_temlates_tenant_franchise_model_task_template;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wpt_task_temlates_tenant_franchise_model_task_template
ON public.work_order_template_task_templates
USING btree (
  tenant_id,
  COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid),
  model_id
)
TABLESPACE pg_default;

COMMIT;
