BEGIN;

CREATE INDEX IF NOT EXISTS idx_work_package_template_task_templates_template
  ON public.work_package_template_task_templates(work_package_template_id);

COMMIT;
