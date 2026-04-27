DO $migration$
BEGIN
  EXECUTE $sql$
    ALTER TABLE public.work_order_template_task_templates
      ADD COLUMN IF NOT EXISTS created_by uuid,
      ADD COLUMN IF NOT EXISTS updated_by uuid,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz
  $sql$;

  EXECUTE $sql$
    COMMENT ON COLUMN public.work_order_template_task_templates.created_by
      IS 'User ID who created the relationship record'
  $sql$;

  EXECUTE $sql$
    COMMENT ON COLUMN public.work_order_template_task_templates.updated_by
      IS 'User ID who last updated the relationship record'
  $sql$;

  EXECUTE $sql$
    COMMENT ON COLUMN public.work_order_template_task_templates.deleted_at
      IS 'Soft-delete timestamp for relationship record'
  $sql$;

  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS idx_wpttt_created_by
      ON public.work_order_template_task_templates(created_by)
  $sql$;

  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS idx_wpttt_updated_by
      ON public.work_order_template_task_templates(updated_by)
  $sql$;

  EXECUTE $sql$
    CREATE INDEX IF NOT EXISTS idx_wpttt_deleted_at
      ON public.work_order_template_task_templates(deleted_at)
  $sql$;
END
$migration$;
