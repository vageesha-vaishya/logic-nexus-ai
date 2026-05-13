-- DB-VERIFICATION: tasks-status-default-pending-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Normalize existing records to the new default semantic.
UPDATE public.tasks
SET status = 'pending'
WHERE status = 'unconfigured';

-- Enforce requested column definition.
ALTER TABLE public.tasks
  ALTER COLUMN status TYPE text USING status::text,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending'::text;

COMMIT;

-- =============================================================================
-- Verification Queries (manual)
-- =============================================================================
-- 1) Confirm default + nullability:
-- SELECT column_name, is_nullable, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'tasks'
--   AND column_name = 'status';
--
-- 2) Confirm no legacy unconfigured records remain:
-- SELECT status, COUNT(*) AS row_count
-- FROM public.tasks
-- GROUP BY status
-- ORDER BY status;
