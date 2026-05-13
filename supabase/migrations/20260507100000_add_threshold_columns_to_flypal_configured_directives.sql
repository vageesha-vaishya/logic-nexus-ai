-- Add threshold and frequency parsing columns to flypal.flypal_configured_directives
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

ALTER TABLE IF EXISTS flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS threshold_hours interval NULL,
  ADD COLUMN IF NOT EXISTS threshold_cycles integer NULL,
  ADD COLUMN IF NOT EXISTS threshold_calendar integer NULL,
  ADD COLUMN IF NOT EXISTS threshold_landings integer NULL,
  ADD COLUMN IF NOT EXISTS calendar_unit public.calendar_unit NULL,
  ADD COLUMN IF NOT EXISTS threshold_rins integer NULL,
  ADD COLUMN IF NOT EXISTS threshold_hobbs integer NULL,
  ADD COLUMN IF NOT EXISTS is_frequency_parsed_success boolean NULL;

COMMENT ON COLUMN flypal.flypal_configured_directives.threshold_hours IS
  'Threshold in interval format for configured directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.threshold_cycles IS
  'Cycle threshold for configured directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.threshold_calendar IS
  'Calendar threshold value for configured directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.threshold_landings IS
  'Landing threshold for configured directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.calendar_unit IS
  'Calendar threshold unit for configured directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.threshold_rins IS
  'RINS threshold for configured directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.threshold_hobbs IS
  'HOBBS threshold for configured directive frequency.';
COMMENT ON COLUMN flypal.flypal_configured_directives.is_frequency_parsed_success IS
  'Whether directive frequency parsing completed successfully for the row.';

COMMIT;
