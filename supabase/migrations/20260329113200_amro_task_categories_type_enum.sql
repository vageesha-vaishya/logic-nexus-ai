BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'task_category_type'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.task_category_type AS ENUM ('Service', 'Inspection');
  END IF;
END $$;

ALTER TABLE public.task_categories
  ADD COLUMN IF NOT EXISTS task_category_type public.task_category_type;

COMMIT;
