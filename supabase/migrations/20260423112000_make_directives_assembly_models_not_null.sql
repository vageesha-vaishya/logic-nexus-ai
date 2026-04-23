-- Make directives.assembly_models NOT NULL
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
      AND column_name = 'assembly_models'
  ) THEN
    RAISE NOTICE 'Column public.directives.assembly_models does not exist, skipping migration.';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.directives
    WHERE assembly_models IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot set public.directives.assembly_models to NOT NULL because NULL values exist. Backfill them first.';
  END IF;

  ALTER TABLE public.directives
    ALTER COLUMN assembly_models SET NOT NULL;
END
$$;

COMMIT;
