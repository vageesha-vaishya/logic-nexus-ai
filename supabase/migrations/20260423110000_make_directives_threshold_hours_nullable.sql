-- Make directives.threshold_hours nullable and align interval constraint
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE NOTICE 'Table public.directives does not exist, skipping migration.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'directives'
      AND column_name = 'threshold_hours'
  ) THEN
    RAISE NOTICE 'Column public.directives.threshold_hours does not exist, skipping migration.';
    RETURN;
  END IF;

  ALTER TABLE public.directives
    DROP CONSTRAINT IF EXISTS directives_threshold_hours_hhmm_chk,
    DROP CONSTRAINT IF EXISTS directives_threshold_hours_interval_chk;

  ALTER TABLE public.directives
    ALTER COLUMN threshold_hours DROP NOT NULL;

  ALTER TABLE public.directives
    ADD CONSTRAINT directives_threshold_hours_interval_chk
    CHECK (
      threshold_hours IS NULL
      OR threshold_hours >= interval '0 minutes'
    );

  COMMENT ON COLUMN public.directives.threshold_hours IS
    'Directive threshold stored as interval; nullable; non-null values must be >= 00:00:00.';
END
$$;

COMMIT;
