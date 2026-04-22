-- Add maintenance_hanger to amro_facilities_locations facility_type allowed values

BEGIN;

ALTER TABLE public.amro_facilities_locations
  DROP CONSTRAINT IF EXISTS amro_facilities_locations_type_check;

ALTER TABLE public.amro_facilities_locations
  ADD CONSTRAINT amro_facilities_locations_type_check
  CHECK (
    facility_type IS NULL
    OR facility_type = ANY (
      ARRAY[
        'hangar'::text,
        'line_station'::text,
        'component_shop'::text,
        'engine_shop'::text,
        'parts_warehouse'::text,
        'tool_room'::text,
        'avionics_shop'::text,
        'battery_shop'::text,
        'calibration_shop'::text,
        'fuel_shop'::text,
        'ndt_shop'::text,
        'paint_shop'::text,
        'wheel_and_break_shop'::text,
        'overhaul_shop'::text,
        'other_shop'::text,
        'operation'::text,
        'other'::text,
        'maintenance_hanger'::text
      ]
    )
  );

COMMIT;
