DO $migration$
BEGIN
  EXECUTE $sql$
    DROP INDEX IF EXISTS public.idx_wpttt_deleted_at
  $sql$;

  EXECUTE $sql$
    DROP INDEX IF EXISTS public.idx_wpttt_updated_by
  $sql$;

  EXECUTE $sql$
    DROP INDEX IF EXISTS public.idx_wpttt_created_by
  $sql$;

  EXECUTE $sql$
    ALTER TABLE public.work_order_template_task_templates
      DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS updated_by,
      DROP COLUMN IF EXISTS created_by
  $sql$;
END
$migration$;
