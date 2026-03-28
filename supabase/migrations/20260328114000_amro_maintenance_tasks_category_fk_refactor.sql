BEGIN;

ALTER TABLE public.maintenance_tasks
  DROP CONSTRAINT IF EXISTS fk_maintenance_tasks_category_code;

ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS category_id uuid;

UPDATE public.maintenance_tasks mt
SET category_id = tc.id
FROM public.task_categories tc
WHERE mt.category_id IS NULL
  AND mt.tenant_id = tc.tenant_id
  AND mt.category_code = tc.code;

ALTER TABLE public.maintenance_tasks
  DROP CONSTRAINT IF EXISTS fk_maintenance_tasks_category_id;

ALTER TABLE public.maintenance_tasks
  ADD CONSTRAINT fk_maintenance_tasks_category_id
  FOREIGN KEY (category_id)
  REFERENCES public.task_categories(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_maintenance_tasks_category_id
  ON public.maintenance_tasks(category_id);

COMMIT;
