-- Make directives.estimated_man_hours nullable while preserving interval type
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
      AND column_name = 'estimated_man_hours'
  ) THEN
    RAISE NOTICE 'Column public.directives.estimated_man_hours does not exist, skipping migration.';
    RETURN;
  END IF;

  ALTER TABLE public.directives
    ALTER COLUMN estimated_man_hours DROP NOT NULL;

  COMMENT ON COLUMN public.directives.estimated_man_hours IS
    'Estimated man-hours stored as interval; nullable.';
END
$$;

COMMIT;
