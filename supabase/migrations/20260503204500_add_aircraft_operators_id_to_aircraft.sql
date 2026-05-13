-- DB-VERIFICATION: aircraft-operators-fk-column-addition-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- =============================================================================
-- MIGRATION: Add aircraft_operators_id to public.aircraft and enforce FK
-- =============================================================================
-- Business rule:
-- Keep aircraft records even if an operator is removed, so use ON DELETE SET NULL.
-- =============================================================================

-- Pre-validation: ensure required tables exist.
DO $$
BEGIN
  IF to_regclass('public.aircraft') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.aircraft';
  END IF;

  IF to_regclass('public.aircraft_operators') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.aircraft_operators';
  END IF;
END
$$;

-- Step 1) Add column if missing (idempotent).
ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS aircraft_operators_id uuid NULL;

-- Step 2) Add FK constraint if missing (idempotent via catalog check).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_aircraft_operators_id_fkey'
  ) THEN
    ALTER TABLE public.aircraft
      ADD CONSTRAINT aircraft_aircraft_operators_id_fkey
      FOREIGN KEY (aircraft_operators_id)
      REFERENCES public.aircraft_operators(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Step 3) Add lookup index for join/filter performance.
CREATE INDEX IF NOT EXISTS idx_aircraft_aircraft_operators_id
  ON public.aircraft (aircraft_operators_id);

-- Post-validation A: expected schema state.
DO $$
DECLARE
  v_has_column boolean;
  v_has_fk boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'aircraft_operators_id'
  ) INTO v_has_column;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_aircraft_operators_id_fkey'
  ) INTO v_has_fk;

  IF NOT v_has_column THEN
    RAISE EXCEPTION 'Validation failed: column public.aircraft.aircraft_operators_id is missing.';
  END IF;

  IF NOT v_has_fk THEN
    RAISE EXCEPTION 'Validation failed: FK aircraft_aircraft_operators_id_fkey is missing.';
  END IF;
END
$$;

-- Post-validation B: verify FK enforcement using sample test logic.
-- Attempts an invalid UUID assignment on one existing aircraft row and expects FK violation.
-- If no rows exist in public.aircraft, test is skipped with NOTICE.
DO $$
DECLARE
  v_aircraft_id uuid;
  v_fk_enforced boolean := false;
BEGIN
  SELECT a.id
    INTO v_aircraft_id
  FROM public.aircraft a
  LIMIT 1;

  IF v_aircraft_id IS NULL THEN
    RAISE NOTICE 'FK enforcement test skipped: public.aircraft has no rows.';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.aircraft
    SET aircraft_operators_id = gen_random_uuid()
    WHERE id = v_aircraft_id;
  EXCEPTION
    WHEN foreign_key_violation THEN
      v_fk_enforced := true;
  END;

  IF NOT v_fk_enforced THEN
    RAISE EXCEPTION 'Validation failed: FK was not enforced during sample invalid update test.';
  END IF;
END
$$;

-- Output checks for deployment logs.
SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aircraft'
      AND column_name = 'aircraft_operators_id'
  ) AS aircraft_operators_id_column_exists,
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'aircraft'
      AND c.conname = 'aircraft_aircraft_operators_id_fkey'
  ) AS aircraft_operators_fk_exists;

COMMIT;

-- =============================================================================
-- ROLLBACK SCRIPT (MANUAL - RUN ONLY IF YOU NEED TO REVERT THIS MIGRATION)
-- =============================================================================
-- BEGIN;
-- ALTER TABLE public.aircraft
--   DROP CONSTRAINT IF EXISTS aircraft_aircraft_operators_id_fkey;
-- DROP INDEX IF EXISTS public.idx_aircraft_aircraft_operators_id;
-- ALTER TABLE public.aircraft
--   DROP COLUMN IF EXISTS aircraft_operators_id;
-- COMMIT;
--
-- If migration fails before COMMIT in normal execution, PostgreSQL keeps the
-- transaction uncommitted; execute ROLLBACK in that session.
--
-- Staging recommendation before production:
-- 1) Apply migration on staging snapshot.
-- 2) Run SELECT checks above.
-- 3) Attempt one invalid UUID update to confirm FK rejection.
-- 4) Attempt one valid UUID update from public.aircraft_operators(id).
-- 5) Confirm application flows depending on aircraft ownership still function.
