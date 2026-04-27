BEGIN;

CREATE INDEX IF NOT EXISTS idx_work_order_template_task_templates_template
  ON public.work_order_template_task_templates(work_order_template_id);

COMMIT;
