-- DB-VERIFICATION: aircraft-owner-column-rename-and-fk-remap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Step 1) Drop legacy foreign key constraint(s) from public.aircraft.owner_id -> auth.users(id)
-- Uses existence checks to keep migration idempotent and safe on repeated runs.
DO $$
DECLARE
  v_constraint record;
BEGIN
  IF to_regclass('public.aircraft') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft does not exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_owner_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.aircraft DROP CONSTRAINT aircraft_owner_id_fkey';
  END IF;

  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class rt ON rt.oid = c.confrelid
    JOIN pg_namespace rn ON rn.oid = rt.relnamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND rn.nspname = 'auth'
      AND rt.relname = 'users'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS ck(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = ck.attnum
        WHERE a.attname = 'owner_id'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.aircraft DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END
$$;

-- Step 2) Rename owner_id -> aircraft_owners_id while preserving existing values.
-- Rename only when owner_id exists and aircraft_owners_id does not yet exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'owner_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'aircraft_owners_id'
  ) THEN
    ALTER TABLE public.aircraft RENAME COLUMN owner_id TO aircraft_owners_id;
  END IF;
END
$$;

-- Step 3) Add new FK from public.aircraft.aircraft_owners_id -> public.aircraft_owners(id)
-- Uses constraint existence check to remain idempotent.
DO $$
BEGIN
  IF to_regclass('public.aircraft_owners') IS NULL THEN
    RAISE EXCEPTION 'Table public.aircraft_owners does not exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'aircraft_owners_id'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_aircraft_owners_id_fkey'
  ) THEN
    ALTER TABLE public.aircraft
      ADD CONSTRAINT aircraft_aircraft_owners_id_fkey
      FOREIGN KEY (aircraft_owners_id)
      REFERENCES public.aircraft_owners(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Validation: fail transaction if expected end-state is not achieved.
DO $$
DECLARE
  v_has_new_column boolean;
  v_has_old_column boolean;
  v_has_new_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'aircraft_owners_id'
  ) INTO v_has_new_column;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'owner_id'
  ) INTO v_has_old_column;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_aircraft_owners_id_fkey'
  ) INTO v_has_new_fk;

  IF NOT v_has_new_column THEN
    RAISE EXCEPTION 'Migration validation failed: public.aircraft.aircraft_owners_id column is missing.';
  END IF;

  IF v_has_old_column THEN
    RAISE EXCEPTION 'Migration validation failed: legacy public.aircraft.owner_id still exists.';
  END IF;

  IF NOT v_has_new_fk THEN
    RAISE EXCEPTION 'Migration validation failed: FK aircraft_aircraft_owners_id_fkey is missing.';
  END IF;
END
$$;

-- Validation result rows for deployment logs.
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'aircraft_owners_id'
  ) AS aircraft_owners_id_column_exists,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_aircraft_owners_id_fkey'
  ) AS aircraft_owners_fk_exists;

COMMIT;

-- Rollback guidance:
-- If any statement fails before COMMIT, PostgreSQL aborts the transaction.
-- Execute ROLLBACK in the session if your migration runner does not auto-rollback on error.
