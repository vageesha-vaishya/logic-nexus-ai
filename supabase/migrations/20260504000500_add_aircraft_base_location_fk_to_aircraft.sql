-- DB-VERIFICATION: aircraft-base-location-fk-reviewed-for-airport-reference
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Safety checks to avoid partial/invalid migration execution.
DO $$
BEGIN
  IF to_regclass('public.aircraft') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft does not exist.';
  END IF;

  IF to_regclass('public.airports') IS NULL THEN
    RAISE EXCEPTION 'Table public.airports does not exist.';
  END IF;
END
$$;

-- 1) Add nullable UUID column for aircraft base location if not already present.
ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS aircraft_base_location_id uuid NULL;

-- 2) Add FK constraint (idempotent) with ON DELETE SET NULL behavior.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_airports_id_fkey'
  ) THEN
    ALTER TABLE public.aircraft
      ADD CONSTRAINT aircraft_airports_id_fkey
      FOREIGN KEY (aircraft_base_location_id)
      REFERENCES public.airports (id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- 3) Validation output for migration logs.
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'aircraft_base_location_id'
  ) AS aircraft_base_location_column_exists,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_airports_id_fkey'
  ) AS aircraft_airports_fk_exists;

COMMIT;
