-- DB-VERIFICATION: tasks-add-dependency-and-reading-columns-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

-- =============================================
-- UP
-- =============================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Table public.tasks does not exist.';
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS linked_previous_task_id uuid NULL,
  ADD COLUMN IF NOT EXISTS is_latest_task boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS date_of_last_reading date NULL,
  ADD COLUMN IF NOT EXISTS hour_at_last_reading interval NULL,
  ADD COLUMN IF NOT EXISTS hour_at_task_complete interval NULL,
  ADD COLUMN IF NOT EXISTS hour_at_due_date interval NULL,
  ADD COLUMN IF NOT EXISTS date_on_task_complete interval NULL,
  ADD COLUMN IF NOT EXISTS task_due_date date NULL,
  ADD COLUMN IF NOT EXISTS task_extension_date date NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.conname = 'tasks_linked_previous_task_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_linked_previous_task_id_fkey
      FOREIGN KEY (linked_previous_task_id)
      REFERENCES public.tasks(id)
      ON DELETE SET NULL
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.conname = 'ck_tasks_not_self_linked_previous_task'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT ck_tasks_not_self_linked_previous_task
      CHECK (linked_previous_task_id IS NULL OR linked_previous_task_id <> id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.conname = 'ck_tasks_extension_date_not_before_due_date'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT ck_tasks_extension_date_not_before_due_date
      CHECK (
        task_extension_date IS NULL
        OR task_due_date IS NULL
        OR task_extension_date >= task_due_date
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.conname = 'ck_tasks_hour_at_last_reading_non_negative'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT ck_tasks_hour_at_last_reading_non_negative
      CHECK (
        hour_at_last_reading IS NULL
        OR hour_at_last_reading >= interval '0'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.conname = 'ck_tasks_hour_at_task_complete_non_negative'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT ck_tasks_hour_at_task_complete_non_negative
      CHECK (
        hour_at_task_complete IS NULL
        OR hour_at_task_complete >= interval '0'
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_linked_previous_task_id
  ON public.tasks(linked_previous_task_id);

CREATE INDEX IF NOT EXISTS idx_tasks_is_latest_task
  ON public.tasks(is_latest_task);

CREATE INDEX IF NOT EXISTS idx_tasks_task_due_date
  ON public.tasks(task_due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_task_extension_date
  ON public.tasks(task_extension_date);

CREATE INDEX IF NOT EXISTS idx_tasks_is_latest_task_due_date
  ON public.tasks(is_latest_task, task_due_date);

COMMENT ON COLUMN public.tasks.linked_previous_task_id IS
  'Optional self-reference to the previous task version/dependency.';
COMMENT ON COLUMN public.tasks.is_latest_task IS
  'True when this row represents the latest task version for its lineage.';
COMMENT ON COLUMN public.tasks.date_of_last_reading IS
  'Calendar date of the latest reading/access event for the task.';
COMMENT ON COLUMN public.tasks.hour_at_last_reading IS
  'Accumulated operating-time interval captured at last reading.';
COMMENT ON COLUMN public.tasks.hour_at_task_complete IS
  'Accumulated operating-time interval at the moment of completion.';
COMMENT ON COLUMN public.tasks.hour_at_due_date IS
  'Operating-time interval target associated with the due threshold.';
COMMENT ON COLUMN public.tasks.date_on_task_complete IS
  'Interval representation captured for task completion date metadata.';
COMMENT ON COLUMN public.tasks.task_due_date IS
  'Scheduled due date for the task.';
COMMENT ON COLUMN public.tasks.task_extension_date IS
  'Extended due date when an extension is granted.';

COMMIT;

-- =============================================
-- DOWN (manual rollback)
-- =============================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_tasks_is_latest_task_due_date;
-- DROP INDEX IF EXISTS idx_tasks_task_extension_date;
-- DROP INDEX IF EXISTS idx_tasks_task_due_date;
-- DROP INDEX IF EXISTS idx_tasks_is_latest_task;
-- DROP INDEX IF EXISTS idx_tasks_linked_previous_task_id;
--
-- ALTER TABLE public.tasks
--   DROP CONSTRAINT IF EXISTS ck_tasks_hour_at_task_complete_non_negative,
--   DROP CONSTRAINT IF EXISTS ck_tasks_hour_at_last_reading_non_negative,
--   DROP CONSTRAINT IF EXISTS ck_tasks_extension_date_not_before_due_date,
--   DROP CONSTRAINT IF EXISTS ck_tasks_not_self_linked_previous_task,
--   DROP CONSTRAINT IF EXISTS tasks_linked_previous_task_id_fkey;
--
-- ALTER TABLE public.tasks
--   DROP COLUMN IF EXISTS task_extension_date,
--   DROP COLUMN IF EXISTS task_due_date,
--   DROP COLUMN IF EXISTS date_on_task_complete,
--   DROP COLUMN IF EXISTS hour_at_due_date,
--   DROP COLUMN IF EXISTS hour_at_task_complete,
--   DROP COLUMN IF EXISTS hour_at_last_reading,
--   DROP COLUMN IF EXISTS date_of_last_reading,
--   DROP COLUMN IF EXISTS is_latest_task,
--   DROP COLUMN IF EXISTS linked_previous_task_id;
-- COMMIT;
