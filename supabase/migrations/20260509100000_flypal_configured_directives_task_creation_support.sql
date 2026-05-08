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
ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS is_task_created_success boolean NULL;

COMMENT ON COLUMN flypal.flypal_configured_directives.is_task_created_success IS
  'Set to true when flypal_configured_directives_create_tasks edge function
   successfully creates a public.tasks row for this directive. NULL = not yet
   attempted. false = attempted and failed (see failure_reason).';

-- Index to efficiently fetch rows pending task creation
CREATE INDEX IF NOT EXISTS idx_flypal_cfg_dir_pending_task_creation
  ON flypal.flypal_configured_directives (tenant_id, frequency_sequence)
  WHERE is_frequency_parsed_success = true
    AND directive_id IS NOT NULL
    AND created_task_id IS NULL;

COMMIT;
