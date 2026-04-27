DO $migration$
BEGIN
  EXECUTE $sql$
    DROP TRIGGER IF EXISTS trg_amro_sync_wpt_task_template_relationships
    ON public.work_order_templates
  $sql$;

  EXECUTE $sql$
    DROP FUNCTION IF EXISTS public.amro_sync_wpt_task_template_relationships()
  $sql$;
END
$migration$;
