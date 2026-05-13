-- Alter directives threshold hour format and add additional threshold metrics
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

BEGIN;

ALTER TABLE IF EXISTS public.directives
  ALTER COLUMN threshold_hours TYPE text
  USING (
    CASE
      WHEN threshold_hours IS NULL THEN NULL
      ELSE
        ((round(threshold_hours * 60))::bigint / 60)::text
        || ':'
        || lpad((((round(threshold_hours * 60))::bigint % 60))::text, 2, '0')
    END
  );

ALTER TABLE IF EXISTS public.directives
  DROP CONSTRAINT IF EXISTS directives_threshold_hours_hhmm_chk;

ALTER TABLE IF EXISTS public.directives
  ADD CONSTRAINT directives_threshold_hours_hhmm_chk
  CHECK (
    threshold_hours IS NULL
    OR threshold_hours ~ '^[0-9]+:[0-5][0-9]$'
  );

ALTER TABLE IF EXISTS public.directives
  ADD COLUMN IF NOT EXISTS threshold_rins integer NULL,
  ADD COLUMN IF NOT EXISTS threshold_hobbs integer NULL;

COMMENT ON COLUMN public.directives.threshold_hours IS
  'Directive threshold in HH:MM format.';
COMMENT ON COLUMN public.directives.threshold_rins IS
  'RINS threshold for recurring directive intervals.';
COMMENT ON COLUMN public.directives.threshold_hobbs IS
  'HOBBS threshold for recurring directive intervals.';

COMMIT;
