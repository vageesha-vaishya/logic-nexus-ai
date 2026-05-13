-- DB-VERIFICATION: aircraft-status-pending-default-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Expand aircraft_status domain to include pending.
DO $$
DECLARE
  domain_constraint record;
BEGIN
  FOR domain_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_type t ON t.oid = c.contypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'aircraft_status'
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER DOMAIN public.aircraft_status DROP CONSTRAINT IF EXISTS %I', domain_constraint.conname);
  END LOOP;
END $$;

ALTER DOMAIN public.aircraft_status
  ADD CONSTRAINT aircraft_status_check
  CHECK (VALUE IN ('pending', 'active', 'maintenance', 'grounded', 'retired', 'storage'));

-- Change aircraft.status default only for new rows.
-- Existing aircraft records keep their current status values.
ALTER TABLE public.aircraft
  ALTER COLUMN status SET DEFAULT ('pending'::text)::public.aircraft_status;

COMMIT;

-- =============================================================================
-- Rollback Procedure (manual)
-- =============================================================================
-- BEGIN;
-- UPDATE public.aircraft
-- SET status = ('active'::text)::public.aircraft_status
-- WHERE status::text = 'pending';
--
-- ALTER TABLE public.aircraft
--   ALTER COLUMN status SET DEFAULT ('active'::text)::public.aircraft_status;
--
-- ALTER DOMAIN public.aircraft_status DROP CONSTRAINT IF EXISTS aircraft_status_check;
-- ALTER DOMAIN public.aircraft_status
--   ADD CONSTRAINT aircraft_status_check
--   CHECK (VALUE IN ('active', 'maintenance', 'grounded', 'retired', 'storage'));
-- COMMIT;

-- =============================================================================
-- Verification Queries
-- =============================================================================
-- 1) Verify aircraft.status default is pending.
-- SELECT column_name, data_type, udt_name, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'aircraft'
--   AND column_name = 'status';
--
-- 2) Verify aircraft_status domain allows pending.
-- SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
-- FROM pg_constraint c
-- JOIN pg_type t ON t.oid = c.contypid
-- JOIN pg_namespace n ON n.oid = t.typnamespace
-- WHERE n.nspname = 'public'
--   AND t.typname = 'aircraft_status'
--   AND c.contype = 'c';
--
-- 3) Verify existing rows are preserved and inspect distribution.
-- SELECT status::text AS status, COUNT(*) AS row_count
-- FROM public.aircraft
-- GROUP BY status::text
-- ORDER BY status::text;
