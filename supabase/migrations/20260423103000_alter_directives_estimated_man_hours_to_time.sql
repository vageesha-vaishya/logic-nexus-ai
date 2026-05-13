-- Alter directives estimated_man_hours from numeric to interval NOT NULL
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

BEGIN;

ALTER TABLE IF EXISTS public.directives
  ALTER COLUMN estimated_man_hours TYPE interval
  USING (
    make_interval(mins => round(coalesce(estimated_man_hours, 0) * 60)::integer)
  );

ALTER TABLE IF EXISTS public.directives
  ALTER COLUMN estimated_man_hours SET NOT NULL;

COMMENT ON COLUMN public.directives.estimated_man_hours IS
  'Estimated man-hours stored as interval; previous NULL values are normalized to 00:00:00.';

COMMIT;
