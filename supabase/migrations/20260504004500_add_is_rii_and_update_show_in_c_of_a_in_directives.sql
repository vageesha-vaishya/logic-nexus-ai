-- DB-VERIFICATION: directives-is-rii-and-show-in-cofa-columns-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Ensure target table exists before schema mutation.
DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END
$$;

-- 1) Add new nullable boolean column with default false.
ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS is_rii boolean NULL DEFAULT false;

-- 2) Align show_in_c_of_a as nullable with default false.
--    Column already exists in most environments, so this is an idempotent alter.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'directives'
      AND column_name = 'show_in_c_of_a'
  ) THEN
    ALTER TABLE public.directives
      ALTER COLUMN show_in_c_of_a DROP NOT NULL,
      ALTER COLUMN show_in_c_of_a SET DEFAULT false;
  ELSE
    ALTER TABLE public.directives
      ADD COLUMN show_in_c_of_a boolean NULL DEFAULT false;
  END IF;
END
$$;

COMMENT ON COLUMN public.directives.is_rii IS
  'Flags whether the directive is categorized as RII.';
COMMENT ON COLUMN public.directives.show_in_c_of_a IS
  'Controls whether directive should appear in C of A outputs; nullable with default false.';

-- Validation output for migration logs.
SELECT
  c.column_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'directives'
  AND c.column_name IN ('is_rii', 'show_in_c_of_a')
ORDER BY c.column_name;

COMMIT;
