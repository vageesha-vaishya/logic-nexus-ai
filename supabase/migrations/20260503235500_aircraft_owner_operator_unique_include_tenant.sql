-- DB-VERIFICATION: tenant-scoped-unique-constraints-reviewed-for-aircraft-owners-and-operators
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Safety checks: ensure target tables/columns exist before applying constraint changes.
DO $$
BEGIN
  IF to_regclass('public.aircraft_operators') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft_operators does not exist.';
  END IF;

  IF to_regclass('public.aircraft_owners') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft_owners does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft_operators'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'Column public.aircraft_operators.tenant_id does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft_owners'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'Column public.aircraft_owners.tenant_id does not exist.';
  END IF;
END
$$;

-- Drop legacy global unique constraints (if present).
ALTER TABLE public.aircraft_operators
  DROP CONSTRAINT IF EXISTS aircraft_operators_operator_code_uk;

ALTER TABLE public.aircraft_owners
  DROP CONSTRAINT IF EXISTS aircraft_owners_owner_code_uk;

-- Recreate constraints as tenant-scoped uniques.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft_operators'
      AND c.conname = 'aircraft_operators_operator_code_uk'
  ) THEN
    ALTER TABLE public.aircraft_operators
      ADD CONSTRAINT aircraft_operators_operator_code_uk UNIQUE (tenant_id, operator_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft_owners'
      AND c.conname = 'aircraft_owners_owner_code_uk'
  ) THEN
    ALTER TABLE public.aircraft_owners
      ADD CONSTRAINT aircraft_owners_owner_code_uk UNIQUE (tenant_id, owner_code);
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
      AND t.relname = 'aircraft_operators'
      AND c.conname = 'aircraft_operators_operator_code_uk'
  ) AS aircraft_operators_unique_present,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft_owners'
      AND c.conname = 'aircraft_owners_owner_code_uk'
  ) AS aircraft_owners_unique_present;

COMMIT;
