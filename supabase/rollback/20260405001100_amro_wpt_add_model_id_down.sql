DO $migration$
BEGIN
  EXECUTE $sql$
    ALTER TABLE public.work_order_templates
      ALTER COLUMN model_id DROP NOT NULL
  $sql$;

  EXECUTE $sql$
    ALTER TABLE public.work_order_templates
      DROP CONSTRAINT IF EXISTS fk_work_order_templates_model_id
  $sql$;

  EXECUTE $sql$
    DROP INDEX IF EXISTS public.idx_work_order_templates_model_id
  $sql$;

  EXECUTE $sql$
    ALTER TABLE public.work_order_templates
      DROP COLUMN IF EXISTS model_id
  $sql$;
END
$migration$;
