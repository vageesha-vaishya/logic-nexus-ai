BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'LogType'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public."LogType" AS ENUM ('Journey', 'Maintenance Log', 'VOID Log');
  END IF;
END $$;

ALTER TABLE public.flight_logs
  DROP CONSTRAINT IF EXISTS flight_logs_time_sequence_check,
  ADD CONSTRAINT flight_logs_time_sequence_check
  CHECK (time_out <= time_off AND time_off < time_on AND time_on <= time_in);

ALTER TABLE public.flight_logs
  ADD COLUMN IF NOT EXISTS service_check_performed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS engineer_sign_off_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS fuel_unit text DEFAULT 'KG' CHECK (fuel_unit IN ('KG', 'LBS', 'LTR', 'GAL')),
  ADD COLUMN IF NOT EXISTS flight_log_type public."LogType";

COMMIT;
