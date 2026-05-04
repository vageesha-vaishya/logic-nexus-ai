-- DB-VERIFICATION: directives-issue-date-note-columns-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   Add issue_date and note metadata fields to public.directives.
--   Backfill existing rows with requested initial values while allowing NULL for future records.

-- =========================
-- UP MIGRATION (APPLIED)
-- =========================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END
$$;

-- Add nullable DATE column with a default matching requested value.
ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS issue_date date NULL DEFAULT DATE '2025-08-22';

-- Add nullable TEXT column with a default matching requested value.
ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS note text NULL DEFAULT 'hi how are you ?';

COMMENT ON COLUMN public.directives.issue_date IS
  'Directive issue date. Initial default set to 2025-08-22 as requested.';
COMMENT ON COLUMN public.directives.note IS
  'Free-text note attached to directives. Initial default set to requested seed text.';

-- Backfill existing rows that predate these columns and have NULL values.
UPDATE public.directives
SET
  issue_date = COALESCE(issue_date, DATE '2025-08-22'),
  note = COALESCE(note, 'hi how are you ?')
WHERE issue_date IS NULL
   OR note IS NULL;

-- No index created: these are informational fields and not part of known filter/join patterns.

-- Validation output for migration logs.
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'directives'
  AND c.column_name IN ('issue_date', 'note')
ORDER BY c.column_name;

COMMIT;

-- =========================
-- DOWN MIGRATION (MANUAL)
-- =========================
-- BEGIN;
-- ALTER TABLE public.directives
--   DROP COLUMN IF EXISTS note,
--   DROP COLUMN IF EXISTS issue_date;
-- COMMIT;
