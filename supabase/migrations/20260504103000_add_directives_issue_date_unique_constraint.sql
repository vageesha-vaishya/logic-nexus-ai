-- DB-VERIFICATION: directives-issue-date-unique-constraint-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   1) Add issue_date to public.directives if it does not exist.
--   2) Enforce uniqueness on:
--      (tenant_id, franchise_id, ata_code, assembly_models, reference_amp, directive_no, issue_date)
--      using UNIQUE NULLS NOT DISTINCT.
--   3) Handle existing conflicts before creating the constraint.
--   4) Keep migration idempotent and transaction-safe.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END
$$;

-- 1) Add issue_date as nullable DATE if missing.
ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS issue_date date NULL;

-- Remove prior directive uniqueness constraints so final behavior is defined by
-- the new issue-date-aware key.
ALTER TABLE public.directives
  DROP CONSTRAINT IF EXISTS uq_directives_tenant_franchise_ata_model_refamp_directive_no;

ALTER TABLE public.directives
  DROP CONSTRAINT IF EXISTS uq_directives_tenant_ata_model_refamp_directive_no;

ALTER TABLE public.directives
  DROP CONSTRAINT IF EXISTS uq_directives_tenant_ata_model_refamp_directive_issue_date_no;

ALTER TABLE public.directives
  DROP CONSTRAINT IF EXISTS uq_directives_tenant_ata_model_refamp_directive_issue_date_no_tmp;

-- 3) Handle existing data conflicts for the new uniqueness key.
-- Keep the most recent row per duplicate group.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        tenant_id,
        franchise_id,
        ata_code,
        assembly_models,
        reference_amp,
        directive_no,
        issue_date
      ORDER BY directive_sequence DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.directives
),
to_delete AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM public.directives d
USING to_delete td
WHERE d.id = td.id;

-- 2) Create the requested UNIQUE NULLS NOT DISTINCT constraint.
ALTER TABLE public.directives
  ADD CONSTRAINT uq_directives_tenant_ata_model_refamp_directive_issue_date_no
  UNIQUE NULLS NOT DISTINCT (
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no,
    issue_date
  );

-- 5) Validation: verify constraint exists and duplicate groups are zero.
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'directives'
  AND c.conname = 'uq_directives_tenant_ata_model_refamp_directive_issue_date_no';

SELECT
  COUNT(*) AS duplicate_group_count
FROM (
  SELECT
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no,
    issue_date
  FROM public.directives
  GROUP BY
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no,
    issue_date
  HAVING COUNT(*) > 1
) s;

COMMIT;

-- =========================
-- DOWN MIGRATION (MANUAL)
-- =========================
-- BEGIN;
-- ALTER TABLE public.directives
--   DROP CONSTRAINT IF EXISTS uq_directives_tenant_ata_model_refamp_directive_issue_date_no;
--
-- ALTER TABLE public.directives
--   DROP COLUMN IF EXISTS issue_date;
-- COMMIT;
