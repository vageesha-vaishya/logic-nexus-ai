-- DB-VERIFICATION: flypal-directives-add-is-wrong-data-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   Add is_wrong_data boolean column to flypal.flypal_directives.

BEGIN;

DO $$
BEGIN
  IF to_regclass('flypal.flypal_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_directives does not exist.';
  END IF;
END
$$;

ALTER TABLE flypal.flypal_directives
  ADD COLUMN IF NOT EXISTS is_wrong_data boolean NULL;

-- Validation output for migration logs.
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'flypal'
  AND c.table_name = 'flypal_directives'
  AND c.column_name = 'is_wrong_data';

COMMIT;

-- =========================
-- DOWN MIGRATION (MANUAL)
-- =========================
-- BEGIN;
-- ALTER TABLE flypal.flypal_directives
--   DROP COLUMN IF EXISTS is_wrong_data;
-- COMMIT;
