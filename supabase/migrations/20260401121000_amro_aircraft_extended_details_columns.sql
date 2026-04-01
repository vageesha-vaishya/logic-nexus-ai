BEGIN;

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS engine_1_serial text,
  ADD COLUMN IF NOT EXISTS engine_2_serial text,
  ADD COLUMN IF NOT EXISTS apu_serial text,
  ADD COLUMN IF NOT EXISTS current_apu_hours decimal(15, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_low_utilization boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_heavy_check_date date,
  ADD COLUMN IF NOT EXISTS last_heavy_check_hours decimal(15, 2),
  ADD COLUMN IF NOT EXISTS airworthiness_status text DEFAULT 'airworthy',
  ADD COLUMN IF NOT EXISTS last_flight_log_date timestamptz,
  ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

UPDATE public.aircraft
SET
  current_apu_hours = COALESCE(current_apu_hours, 0),
  is_low_utilization = COALESCE(is_low_utilization, false),
  airworthiness_status = COALESCE(NULLIF(btrim(airworthiness_status), ''), 'airworthy'),
  is_template = COALESCE(is_template, false)
WHERE current_apu_hours IS NULL
   OR is_low_utilization IS NULL
   OR airworthiness_status IS NULL
   OR btrim(airworthiness_status) = ''
   OR is_template IS NULL;

ALTER TABLE public.aircraft
  ALTER COLUMN current_apu_hours SET DEFAULT 0,
  ALTER COLUMN current_apu_hours SET NOT NULL,
  ALTER COLUMN is_low_utilization SET DEFAULT false,
  ALTER COLUMN is_low_utilization SET NOT NULL,
  ALTER COLUMN airworthiness_status SET DEFAULT 'airworthy',
  ALTER COLUMN airworthiness_status SET NOT NULL,
  ALTER COLUMN is_template SET DEFAULT false,
  ALTER COLUMN is_template SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'aircraft_airworthiness_status_check'
      AND conrelid = 'public.aircraft'::regclass
  ) THEN
    ALTER TABLE public.aircraft
      ADD CONSTRAINT aircraft_airworthiness_status_check
      CHECK (airworthiness_status IN ('airworthy', 'grounded'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_aircraft_airworthiness_status
  ON public.aircraft(airworthiness_status);

CREATE INDEX IF NOT EXISTS idx_aircraft_last_flight_log_date
  ON public.aircraft(last_flight_log_date);

COMMIT;
