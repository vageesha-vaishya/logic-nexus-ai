-- Add identity frequency_sequence column to flypal.flypal_configured_directives
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

ALTER TABLE IF EXISTS flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS frequency_sequence integer GENERATED ALWAYS AS IDENTITY;

ALTER TABLE IF EXISTS flypal.flypal_configured_directives
  ALTER COLUMN frequency_sequence SET NOT NULL;

COMMENT ON COLUMN flypal.flypal_configured_directives.frequency_sequence IS
  'Identity sequence used to uniquely order configured directive frequency parsing rows.';

COMMIT;
