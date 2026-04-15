BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_template_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tasks_task_template_id'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT fk_tasks_task_template_id
      FOREIGN KEY (task_template_id)
      REFERENCES public.task_templates(id)
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tasks_task_template_id
  ON public.tasks(task_template_id);

ALTER TABLE public.work_packages
  ADD COLUMN IF NOT EXISTS work_package_template_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_work_packages_work_package_template_id'
      AND conrelid = 'public.work_packages'::regclass
  ) THEN
    ALTER TABLE public.work_packages
      ADD CONSTRAINT fk_work_packages_work_package_template_id
      FOREIGN KEY (work_package_template_id)
      REFERENCES public.work_package_templates(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_work_packages_work_package_template_id
  ON public.work_packages(work_package_template_id);

COMMIT;
