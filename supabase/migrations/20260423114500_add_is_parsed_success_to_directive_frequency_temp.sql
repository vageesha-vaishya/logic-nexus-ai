-- Add parsing status flag to directive_frequency_temp staging table
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

BEGIN;

ALTER TABLE IF EXISTS public.directive_frequency_temp
  ADD COLUMN IF NOT EXISTS is_parsed_success boolean NULL;

COMMENT ON COLUMN public.directive_frequency_temp.is_parsed_success IS
  'Parsing status flag for frequency token normalization workflow.';

COMMIT;
