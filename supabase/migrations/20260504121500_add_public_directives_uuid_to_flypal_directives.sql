-- DB-VERIFICATION: flypal-directives-add-public-directives-uuid-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   Add public_directives_uuid (uuid) to flypal.flypal_directives.

BEGIN;

DO $$
BEGIN
  IF to_regclass('flypal.flypal_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_directives does not exist.';
  END IF;
END
$$;

ALTER TABLE flypal.flypal_directives
  ADD COLUMN IF NOT EXISTS public_directives_uuid uuid NULL;

COMMENT ON COLUMN flypal.flypal_directives.public_directives_uuid IS
  'Optional reference to public.directives.id for mapped directive rows.';

-- Validation output for migration logs.
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'flypal'
  AND c.table_name = 'flypal_directives'
  AND c.column_name = 'public_directives_uuid';

COMMIT;

-- =========================
-- DOWN MIGRATION (MANUAL)
-- =========================
-- BEGIN;
-- ALTER TABLE flypal.flypal_directives
--   DROP COLUMN IF EXISTS public_directives_uuid;
-- COMMIT;
