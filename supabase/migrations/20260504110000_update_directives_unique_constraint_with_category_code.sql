-- DB-VERIFICATION: directives-unique-with-category-code-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   Update directives uniqueness to include category_code while keeping
--   UNIQUE NULLS NOT DISTINCT behavior and idempotent execution.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END
$$;

-- Ensure required columns exist (idempotent safety).
ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS issue_date date NULL;

ALTER TABLE public.directives
  ADD COLUMN IF NOT EXISTS category_code varchar(10) NULL;

-- Drop current version of the constraint before recreating with category_code.
ALTER TABLE public.directives
  DROP CONSTRAINT IF EXISTS uq_directives_tenant_ata_model_refamp_directive_issue_date_no;

-- Handle potential existing conflicts on the new key by keeping the latest row.
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
        issue_date,
        category_code
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

-- Recreate with category_code included and NULLS NOT DISTINCT semantics.
ALTER TABLE public.directives
  ADD CONSTRAINT uq_directives_tenant_ata_model_refamp_directive_issue_date_no
  UNIQUE NULLS NOT DISTINCT (
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no,
    issue_date,
    category_code
  );

-- Validation: verify constraint definition and no duplicates remain.
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
    issue_date,
    category_code
  FROM public.directives
  GROUP BY
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no,
    issue_date,
    category_code
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
--   ADD CONSTRAINT uq_directives_tenant_ata_model_refamp_directive_issue_date_no
--   UNIQUE NULLS NOT DISTINCT (
--     tenant_id,
--     franchise_id,
--     ata_code,
--     assembly_models,
--     reference_amp,
--     directive_no,
--     issue_date
--   );
-- COMMIT;
