BEGIN;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type text;

UPDATE public.tasks
SET task_type = COALESCE(NULLIF(btrim(task_type), ''), NULLIF(btrim(task_category), ''), 'general')
WHERE task_type IS NULL
   OR btrim(task_type) = '';

ALTER TABLE public.tasks
  ALTER COLUMN task_type SET DEFAULT 'general';

ALTER TABLE public.tasks
  ALTER COLUMN task_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type);

CREATE OR REPLACE FUNCTION public.sync_tasks_task_type_category()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.task_type := COALESCE(NULLIF(btrim(NEW.task_type), ''), NULLIF(btrim(NEW.task_category), ''), 'general');
  NEW.task_category := COALESCE(NULLIF(btrim(NEW.task_category), ''), NEW.task_type, 'general');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tasks_task_type_category ON public.tasks;
CREATE TRIGGER trg_sync_tasks_task_type_category
BEFORE INSERT OR UPDATE OF task_type, task_category ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_tasks_task_type_category();

COMMIT;
