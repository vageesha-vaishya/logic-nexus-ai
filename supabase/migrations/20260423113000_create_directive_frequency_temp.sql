-- Create staging table for directive frequency imports
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review
-- Extension assessment:
--   Existing public.directives is a production master entity and should not be used
--   as a transient staging surface for frequency-load operations.

BEGIN;

CREATE TABLE IF NOT EXISTS public.directive_frequency_temp (
  frequency_sequence integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  frequency text NULL,
  threshold_hours interval NULL,
  threshold_cycles integer NULL,
  threshold_calendar integer NULL,
  threshold_landings integer NULL,
  calendar_unit public.calendar_unit NULL,
  threshold_rins integer NULL,
  threshold_hobbs integer NULL
);

COMMENT ON TABLE public.directive_frequency_temp IS
  'Temporary staging table for directive frequency threshold payloads.';

COMMIT;
