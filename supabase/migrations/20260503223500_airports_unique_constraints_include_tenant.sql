-- DB-VERIFICATION: airports-unique-constraints-reviewed-for-tenant-scope
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Ensure required table/columns exist before attempting constraint updates.
DO $$
BEGIN
  IF to_regclass('public.airports') IS NULL THEN
    RAISE EXCEPTION 'Table public.airports does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'airports'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'Column public.airports.tenant_id does not exist.';
  END IF;
END
$$;

-- Drop legacy single-column unique constraints if present.
ALTER TABLE public.airports
  DROP CONSTRAINT IF EXISTS airports_iata_code_key,
  DROP CONSTRAINT IF EXISTS airports_icao_code_key;

-- Recreate unique constraints including tenant_id (idempotent via catalog checks).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'airports'
      AND c.conname = 'airports_iata_code_key'
  ) THEN
    ALTER TABLE public.airports
      ADD CONSTRAINT airports_iata_code_key UNIQUE (tenant_id, iata_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'airports'
      AND c.conname = 'airports_icao_code_key'
  ) THEN
    ALTER TABLE public.airports
      ADD CONSTRAINT airports_icao_code_key UNIQUE (tenant_id, icao_code);
  END IF;
END
$$;

-- Validation output for migration logs.
SELECT
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'airports'
      AND c.conname = 'airports_iata_code_key'
  ) AS airports_iata_constraint_exists,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'airports'
      AND c.conname = 'airports_icao_code_key'
  ) AS airports_icao_constraint_exists;

COMMIT;
