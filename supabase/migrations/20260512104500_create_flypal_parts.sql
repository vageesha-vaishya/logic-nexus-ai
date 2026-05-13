-- DB-VERIFICATION: Assessed existing flypal/public tables; no existing table matches flypal_parts.csv column set in the flypal schema.
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

CREATE SCHEMA IF NOT EXISTS flypal;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS flypal.flypal_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_no text,
  description text,
  part_type text,
  location text,
  min_stock_level integer,
  rate numeric,
  unit text,
  category text,
  serialized_status text
);

DO $migration$
DECLARE
  v_server_version_num int := current_setting('server_version_num')::int;
  v_supports_nulls_not_distinct boolean := false;
BEGIN
  v_supports_nulls_not_distinct := v_server_version_num >= 150000;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'flypal'
      AND t.relname = 'flypal_parts'
      AND c.conname = 'uq_flypal_parts_all_columns'
  ) THEN
    IF v_supports_nulls_not_distinct THEN
      EXECUTE 'ALTER TABLE flypal.flypal_parts ' ||
              'ADD CONSTRAINT uq_flypal_parts_all_columns ' ||
              'UNIQUE NULLS NOT DISTINCT (part_no, description, part_type, location, min_stock_level, rate, unit, category, serialized_status)';
    ELSE
      EXECUTE 'ALTER TABLE flypal.flypal_parts ' ||
              'ADD CONSTRAINT uq_flypal_parts_all_columns ' ||
              'UNIQUE (part_no, description, part_type, location, min_stock_level, rate, unit, category, serialized_status)';
    END IF;
  END IF;
END
$migration$;

COMMIT;
