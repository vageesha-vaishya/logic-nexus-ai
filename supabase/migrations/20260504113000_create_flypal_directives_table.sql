-- DB-VERIFICATION: flypal-directives-table-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   Create flypal.flypal_directives with directive-like datatypes and
--   additional processing audit columns.
-- Notes:
--   No unique constraint is created as requested.

BEGIN;

CREATE SCHEMA IF NOT EXISTS flypal;

CREATE TABLE IF NOT EXISTS flypal.flypal_directives (
  data_sequence integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  assembly_models_name text NULL,
  code_form_no character varying(50) NULL,
  ata_code character varying(10) NULL,
  reference_amp text NULL,
  description text NULL,
  category_code character varying(10) NULL,
  issue_date date NULL,
  directive_no text NULL,
  is_rii boolean NULL DEFAULT false,
  show_in_c_of_a boolean NULL DEFAULT false,
  estimated_man_hours numeric(5, 2) NULL,
  note text NULL,
  applicability text NULL,
  is_success boolean NOT NULL DEFAULT false,
  failure_reasone text NULL,
  processing_date timestamp with time zone NULL
);

COMMENT ON TABLE flypal.flypal_directives IS
  'Flypal directives staging/reference table without unique constraints.';

COMMENT ON COLUMN flypal.flypal_directives.data_sequence IS
  'Identity sequence for imported directive rows.';

COMMENT ON COLUMN flypal.flypal_directives.failure_reasone IS
  'Failure reason captured during processing (column name requested as failure_reasone).';

-- Validation output for migration logs.
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'flypal'
  AND c.table_name = 'flypal_directives'
ORDER BY c.ordinal_position;

COMMIT;

-- =========================
-- DOWN MIGRATION (MANUAL)
-- =========================
-- BEGIN;
-- DROP TABLE IF EXISTS flypal.flypal_directives;
-- COMMIT;
