-- DB-VERIFICATION: directives-unique-add-code-form-no-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge
-- Purpose:
--   Add code_form_no to directives uniqueness while preserving
--   UNIQUE NULLS NOT DISTINCT behavior and idempotent execution.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'directives'
      AND column_name = 'code_form_no'
  ) THEN
    RAISE EXCEPTION 'Column public.directives.code_form_no does not exist.';
  END IF;
END
$$;

-- Rebuild the named constraint with code_form_no included.
ALTER TABLE public.directives
  DROP CONSTRAINT IF EXISTS uq_directives_tenant_ata_model_refamp_directive_issue_date_no;

-- Resolve conflicts on the new key by keeping the latest row.
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
        category_code,
        code_form_no
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
    category_code,
    code_form_no
  );

-- Validation: verify final key shape and duplicate count.
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
    category_code,
    code_form_no
  FROM public.directives
  GROUP BY
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no,
    issue_date,
    category_code,
    code_form_no
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
--     issue_date,
--     category_code
--   );
-- COMMIT;
