-- DB-VERIFICATION: Verified flight log soft-delete and pilot search columns are additive and absent.
-- DB-ARCH-APPROVAL: Required before merge as per database governance policy.

BEGIN;

ALTER TABLE public.flight_logs
  ADD COLUMN IF NOT EXISTS pilot_name text,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS uq_flight_logs_aircraft_flight_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_flight_logs_aircraft_flight_active
  ON public.flight_logs (tenant_id, aircraft_id, flight_date, COALESCE(flight_number, ''))
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_flight_logs_tenant_active_date
  ON public.flight_logs (tenant_id, is_deleted, flight_date DESC);

CREATE INDEX IF NOT EXISTS idx_flight_logs_tenant_pilot_name
  ON public.flight_logs (tenant_id, lower(pilot_name));

COMMIT;
