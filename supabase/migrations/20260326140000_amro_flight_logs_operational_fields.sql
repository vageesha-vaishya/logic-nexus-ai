-- DB-VERIFICATION: flight-logs-operational-fields-reviewed
-- DB-ARCH-APPROVAL: required-before-merge

BEGIN;

ALTER TABLE public.flight_logs
  ADD COLUMN IF NOT EXISTS log_selection_no text,
  ADD COLUMN IF NOT EXISTS log_page_no text,
  ADD COLUMN IF NOT EXISTS time_out timestamptz,
  ADD COLUMN IF NOT EXISTS time_off timestamptz,
  ADD COLUMN IF NOT EXISTS time_on timestamptz,
  ADD COLUMN IF NOT EXISTS time_in timestamptz,
  ADD COLUMN IF NOT EXISTS landings integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS flight_type text DEFAULT 'Scheduled',
  ADD COLUMN IF NOT EXISTS delay_code text,
  ADD COLUMN IF NOT EXISTS total_airframe_hours_at_landing numeric(12, 2),
  ADD COLUMN IF NOT EXISTS total_cycles_at_landing integer;

COMMENT ON COLUMN public.flight_logs.time_off IS 'Actual Take-off time in UTC';
COMMENT ON COLUMN public.flight_logs.time_on IS 'Actual Landing time in UTC';

UPDATE public.flight_logs fl
SET departure_airport = a.id::text
FROM public.airports a
WHERE fl.departure_airport IS NOT NULL
  AND a.tenant_id = fl.tenant_id
  AND (
    upper(trim(fl.departure_airport)) = upper(trim(a.iata_code))
    OR upper(trim(fl.departure_airport)) = upper(trim(a.icao_code))
  );

UPDATE public.flight_logs fl
SET arrival_airport = a.id::text
FROM public.airports a
WHERE fl.arrival_airport IS NOT NULL
  AND a.tenant_id = fl.tenant_id
  AND (
    upper(trim(fl.arrival_airport)) = upper(trim(a.iata_code))
    OR upper(trim(fl.arrival_airport)) = upper(trim(a.icao_code))
  );

ALTER TABLE public.flight_logs
  ALTER COLUMN departure_airport TYPE uuid
  USING (
    CASE
      WHEN departure_airport ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN departure_airport::uuid
      ELSE NULL
    END
  ),
  ALTER COLUMN arrival_airport TYPE uuid
  USING (
    CASE
      WHEN arrival_airport ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN arrival_airport::uuid
      ELSE NULL
    END
  );

ALTER TABLE public.flight_logs
  ADD CONSTRAINT flight_logs_time_sequence_check
  CHECK (time_in > time_out);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'flight_logs'
      AND c.conname = 'flight_logs_departure_airport_fkey'
  ) THEN
    ALTER TABLE public.flight_logs
      ADD CONSTRAINT flight_logs_departure_airport_fkey
      FOREIGN KEY (departure_airport) REFERENCES public.airports(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'flight_logs'
      AND c.conname = 'flight_logs_arrival_airport_fkey'
  ) THEN
    ALTER TABLE public.flight_logs
      ADD CONSTRAINT flight_logs_arrival_airport_fkey
      FOREIGN KEY (arrival_airport) REFERENCES public.airports(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
