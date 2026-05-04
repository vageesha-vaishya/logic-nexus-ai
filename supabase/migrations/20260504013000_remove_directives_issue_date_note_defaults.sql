-- DB-VERIFICATION: directives-issue-date-note-default-removal-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Ensure target table exists.
DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END
$$;

-- Remove column defaults.
ALTER TABLE public.directives
  ALTER COLUMN issue_date DROP DEFAULT,
  ALTER COLUMN note DROP DEFAULT;

-- Remove previously seeded default values from existing records.
-- Only the exact seeded values are nulled to avoid touching real user-entered data.
UPDATE public.directives
SET issue_date = NULL
WHERE issue_date = DATE '2025-08-22';

UPDATE public.directives
SET note = NULL
WHERE note = 'hi how are you ?';

-- Validation output for migration logs.
SELECT
  c.column_name,
  c.column_default,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'directives'
  AND c.column_name IN ('issue_date', 'note')
ORDER BY c.column_name;

SELECT
  COUNT(*) FILTER (WHERE issue_date = DATE '2025-08-22') AS remaining_default_issue_date_rows,
  COUNT(*) FILTER (WHERE note = 'hi how are you ?') AS remaining_default_note_rows
FROM public.directives;

COMMIT;
