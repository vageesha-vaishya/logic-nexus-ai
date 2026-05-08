-- DB-VERIFICATION: flypal-configured-directives-current-parsing-columns-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

DO $$
BEGIN
  IF to_regclass('flypal.flypal_configured_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_configured_directives does not exist.';
  END IF;
END $$;

ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS current_2_aircraft_current_flight_hours interval NULL,
  ADD COLUMN IF NOT EXISTS current_2_aircraft_current_landings integer NULL,
  ADD COLUMN IF NOT EXISTS current_2_aircraft_current_reading_date date NULL;

COMMENT ON COLUMN flypal.flypal_configured_directives.current_2_aircraft_current_flight_hours IS
  'Parsed aircraft current flight hours from flypal_configured_directives.current.';
COMMENT ON COLUMN flypal.flypal_configured_directives.current_2_aircraft_current_landings IS
  'Parsed aircraft current landings from flypal_configured_directives.current.';
COMMENT ON COLUMN flypal.flypal_configured_directives.current_2_aircraft_current_reading_date IS
  'Parsed aircraft current reading date from flypal_configured_directives.current.';

COMMIT;
