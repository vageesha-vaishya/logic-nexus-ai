-- DB-VERIFICATION: flypal-directives-estimated-man-hours-interval-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   Change flypal.flypal_directives.estimated_man_hours from numeric(5,2)
--   to interval.

BEGIN;

DO $$
DECLARE
  v_data_type text;
BEGIN
  IF to_regclass('flypal.flypal_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_directives does not exist.';
  END IF;

  SELECT c.data_type
  INTO v_data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'flypal'
    AND c.table_name = 'flypal_directives'
    AND c.column_name = 'estimated_man_hours';

  IF v_data_type IS NULL THEN
    RAISE EXCEPTION 'Column flypal.flypal_directives.estimated_man_hours does not exist.';
  END IF;

  IF v_data_type <> 'interval' THEN
    EXECUTE $sql$
      ALTER TABLE flypal.flypal_directives
      ALTER COLUMN estimated_man_hours TYPE interval
      USING (
        CASE
          WHEN estimated_man_hours IS NULL THEN NULL
          ELSE make_interval(
            hours => trunc(estimated_man_hours)::int,
            mins => round((estimated_man_hours - trunc(estimated_man_hours)) * 60)::int
          )
        END
      )
    $sql$;
  END IF;
END
$$;

-- Validation output for migration logs.
SELECT
  c.column_name,
  c.data_type,
  c.udt_name,
  c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'flypal'
  AND c.table_name = 'flypal_directives'
  AND c.column_name = 'estimated_man_hours';

COMMIT;

-- =========================
-- DOWN MIGRATION (MANUAL)
-- =========================
-- BEGIN;
-- ALTER TABLE flypal.flypal_directives
--   ALTER COLUMN estimated_man_hours TYPE numeric(5,2)
--   USING (
--     CASE
--       WHEN estimated_man_hours IS NULL THEN NULL
--       ELSE round((extract(epoch from estimated_man_hours) / 3600.0)::numeric, 2)
--     END
--   );
-- COMMIT;
