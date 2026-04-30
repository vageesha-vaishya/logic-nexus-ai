-- DB-VERIFICATION: tasks-status-and-configuration-alignment-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- 1) Add configuration tracking column (default false / "N")
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_configured boolean;

ALTER TABLE public.tasks
  ALTER COLUMN is_configured SET DEFAULT false;

UPDATE public.tasks
SET is_configured = false
WHERE is_configured IS NULL;

-- 2) Normalize status storage to text and migrate legacy values
--    This safely handles historical domain-backed status columns (task_status).
ALTER TABLE public.tasks
  ALTER COLUMN status TYPE text USING status::text;

UPDATE public.tasks
SET status = CASE lower(trim(COALESCE(status, '')))
  WHEN 'unconfigured' THEN 'unconfigured'
  WHEN 'pending' THEN 'pending'
  WHEN 'not_started' THEN 'not_started'
  WHEN 'in_progress' THEN 'in_progress'
  WHEN 'on_hold' THEN 'on_hold'
  WHEN 'completed' THEN 'completed'
  WHEN 'deleted' THEN 'deleted'
  WHEN 'cancelled' THEN 'deleted'
  WHEN 'rework_required' THEN 'pending'
  ELSE 'unconfigured'
END;

-- Keep boolean and status aligned for existing data.
UPDATE public.tasks
SET is_configured = (status <> 'unconfigured')
WHERE is_configured IS DISTINCT FROM (status <> 'unconfigured');

-- 3) Replace any existing status-related check constraints with the new canonical set.
DO $$
DECLARE
  status_check record;
BEGIN
  FOR status_check IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS %I', status_check.conname);
  END LOOP;
END $$;

ALTER TABLE public.tasks
  ADD CONSTRAINT ck_tasks_status_allowed
  CHECK (
    status IN (
      'unconfigured',
      'pending',
      'not_started',
      'in_progress',
      'on_hold',
      'completed',
      'deleted'
    )
  );

ALTER TABLE public.tasks
  ALTER COLUMN status SET DEFAULT 'unconfigured',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN is_configured SET NOT NULL;

COMMENT ON COLUMN public.tasks.is_configured IS
  'Tracks whether task configuration has been completed (false = not configured, true = configured).';

COMMENT ON COLUMN public.tasks.status IS
  'Allowed values: unconfigured, pending, not_started, in_progress, on_hold, completed, deleted.';

COMMIT;

-- =============================================================================
-- Rollback Procedure (manual)
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS ck_tasks_status_allowed;
-- ALTER TABLE public.tasks
--   ADD CONSTRAINT ck_tasks_status_allowed_legacy
--   CHECK (status IN ('pending', 'not_started', 'in_progress', 'on_hold', 'completed', 'rework_required', 'cancelled'));
-- ALTER TABLE public.tasks
--   ALTER COLUMN status SET DEFAULT 'pending';
-- UPDATE public.tasks
-- SET status = CASE
--   WHEN status = 'unconfigured' THEN 'pending'
--   WHEN status = 'deleted' THEN 'cancelled'
--   ELSE status
-- END;
-- ALTER TABLE public.tasks
--   ALTER COLUMN status TYPE public.task_status USING status::public.task_status;
-- ALTER TABLE public.tasks
--   DROP COLUMN IF EXISTS is_configured;
-- COMMIT;

-- =============================================================================
-- Verification Queries (post-migration)
-- =============================================================================
-- 1) Verify is_configured column exists and default is false.
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'tasks'
--   AND column_name = 'is_configured';
--
-- 2) Verify status default is unconfigured.
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'tasks'
--   AND column_name = 'status';
--
-- 3) Verify status check constraint values.
-- SELECT conname, pg_get_constraintdef(c.oid) AS definition
-- FROM pg_constraint c
-- JOIN pg_class t ON t.oid = c.conrelid
-- JOIN pg_namespace n ON n.oid = t.relnamespace
-- WHERE n.nspname = 'public'
--   AND t.relname = 'tasks'
--   AND conname = 'ck_tasks_status_allowed';
