-- Add railway_terminal to location_type check constraint
-- This migration updates the check constraint on ports_locations.location_type to include 'railway_terminal'

DO $$
BEGIN
  -- Drop the constraint if it exists (standard naming convention)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ports_locations_location_type_check') THEN
    ALTER TABLE public.ports_locations DROP CONSTRAINT ports_locations_location_type_check;
  END IF;
END $$;

-- Add the constraint back with the new type
ALTER TABLE public.ports_locations
  ADD CONSTRAINT ports_locations_location_type_check
  CHECK (location_type IN ('seaport', 'airport', 'inland_port', 'warehouse', 'terminal', 'railway_terminal'));
