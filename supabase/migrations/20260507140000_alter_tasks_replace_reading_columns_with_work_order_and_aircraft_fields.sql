-- DB-VERIFICATION: tasks-column-replacement-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Table public.tasks does not exist.';
  END IF;
END $$;

-- Remove constraints/indexes tied to columns that will be dropped.
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_extension_date_not_before_due_date,
  DROP CONSTRAINT IF EXISTS ck_tasks_hour_at_last_reading_non_negative,
  DROP CONSTRAINT IF EXISTS ck_tasks_hour_at_task_complete_non_negative;

DROP INDEX IF EXISTS public.idx_tasks_task_due_date;
DROP INDEX IF EXISTS public.idx_tasks_task_extension_date;
DROP INDEX IF EXISTS public.idx_tasks_is_latest_task_due_date;
DROP INDEX IF EXISTS public.idx_tasks_assembly_id;

-- Remove requested legacy columns.
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS date_of_last_reading,
  DROP COLUMN IF EXISTS hour_at_last_reading,
  DROP COLUMN IF EXISTS hour_at_task_complete,
  DROP COLUMN IF EXISTS hour_at_due_date,
  DROP COLUMN IF EXISTS date_on_task_complete,
  DROP COLUMN IF EXISTS task_due_date,
  DROP COLUMN IF EXISTS task_extension_date,
  DROP COLUMN IF EXISTS assembly_id;

-- Add requested new columns.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS work_order_number text,
  ADD COLUMN IF NOT EXISTS actual_work_hours interval NULL,
  ADD COLUMN IF NOT EXISTS task_extension_days numeric NULL,
  ADD COLUMN IF NOT EXISTS task_extension_hours interval NULL,
  ADD COLUMN IF NOT EXISTS task_completion_date date NULL,
  ADD COLUMN IF NOT EXISTS task_completion_hour interval NULL,
  ADD COLUMN IF NOT EXISTS aircraft_id uuid NULL;

-- Backfill work_order_number from linked work order when available.
UPDATE public.tasks t
SET work_order_number = wo.work_order_number
FROM public.work_orders wo
WHERE t.work_order_id = wo.id
  AND (t.work_order_number IS NULL OR btrim(t.work_order_number) = '');

-- Ensure not-null compliance even when work_order_id/work_order mapping is missing.
UPDATE public.tasks
SET work_order_number = 'WO-UNASSIGNED-' || left(id::text, 8)
WHERE work_order_number IS NULL OR btrim(work_order_number) = '';

ALTER TABLE public.tasks
  ALTER COLUMN work_order_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.conname = 'tasks_aircraft_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_aircraft_id_fkey
      FOREIGN KEY (aircraft_id)
      REFERENCES public.aircraft(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_aircraft_id
  ON public.tasks(aircraft_id);

CREATE INDEX IF NOT EXISTS idx_tasks_work_order_number
  ON public.tasks(work_order_number);

COMMENT ON COLUMN public.tasks.actual_work_hours IS
  'Actual work duration logged for task execution.';
COMMENT ON COLUMN public.tasks.task_extension_days IS
  'Task extension value in days.';
COMMENT ON COLUMN public.tasks.task_extension_hours IS
  'Task extension value in interval hours.';
COMMENT ON COLUMN public.tasks.task_completion_date IS
  'Calendar date when the task was completed.';
COMMENT ON COLUMN public.tasks.task_completion_hour IS
  'Aircraft hour interval recorded at task completion.';
COMMENT ON COLUMN public.tasks.aircraft_id IS
  'Optional aircraft reference for direct task-to-aircraft linkage.';

COMMIT;
