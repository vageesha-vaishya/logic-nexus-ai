ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS engine_install_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS thrust_rating_change_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS on_wing_lifecycle_records jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.aircraft
  ADD CONSTRAINT aircraft_engine_install_history_array
  CHECK (jsonb_typeof(engine_install_history) = 'array') NOT VALID;

ALTER TABLE public.aircraft
  ADD CONSTRAINT aircraft_thrust_rating_change_log_array
  CHECK (jsonb_typeof(thrust_rating_change_log) = 'array') NOT VALID;

ALTER TABLE public.aircraft
  ADD CONSTRAINT aircraft_on_wing_lifecycle_records_array
  CHECK (jsonb_typeof(on_wing_lifecycle_records) = 'array') NOT VALID;

ALTER TABLE public.aircraft
  VALIDATE CONSTRAINT aircraft_engine_install_history_array;

ALTER TABLE public.aircraft
  VALIDATE CONSTRAINT aircraft_thrust_rating_change_log_array;

ALTER TABLE public.aircraft
  VALIDATE CONSTRAINT aircraft_on_wing_lifecycle_records_array;
