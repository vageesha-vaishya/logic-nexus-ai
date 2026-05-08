-- Migration: support for flypal_configured_directives_create_tasks edge function
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: not-required-no-create-table
--
-- Context:
--   The id_match step reuses is_row_processed_success for directive matching.
--   The create_tasks step also updates is_row_processed_success.
--   To avoid ambiguity, we add a dedicated is_task_created_success flag and
--   ensure processed_on is timestamptz (already altered in 20260507113000).

BEGIN;

DO $$
BEGIN
  IF to_regclass('flypal.flypal_configured_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_configured_directives does not exist.';
  END IF;
END $$;

-- Dedicated flag for task creation outcome (separate from id_match outcome)
-- Default false so all existing rows are considered pending
ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS is_task_created_success boolean NOT NULL DEFAULT false;

-- Backfill: rows that already have a created_task_id are considered succeeded
UPDATE flypal.flypal_configured_directives
SET is_task_created_success = true
WHERE created_task_id IS NOT NULL
  AND is_task_created_success = false;

-- Dedicated failure reason column for task creation (separate from generic failure_reason)
ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS task_created_failure_reason text NULL;

COMMENT ON COLUMN flypal.flypal_configured_directives.is_task_created_success IS
  'true = task created successfully. false (default) = not yet created or failed.
   Never process rows where this is true.';

COMMENT ON COLUMN flypal.flypal_configured_directives.task_created_failure_reason IS
  'Populated with the error reason when flypal_configured_directives_create_tasks
   fails to create a task for this row. Null on success.';

-- Index to efficiently fetch rows pending task creation:
--   directive matched (is_row_processed_success=true) + task not yet created
CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_pending_task_creation
  ON flypal.flypal_configured_directives (tenant_id, frequency_sequence)
  WHERE directive_id IS NOT NULL
    AND is_row_processed_success = true
    AND is_task_created_success = false;

COMMIT;
