-- DB-VERIFICATION: directives-unique-nulls-not-distinct-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END
$$;

ALTER TABLE public.directives
DROP CONSTRAINT IF EXISTS uq_directives_tenant_franchise_ata_model_refamp_directive_no;

-- Remove existing duplicates for the target uniqueness key before adding
-- UNIQUE NULLS NOT DISTINCT. Keep the latest row by directive_sequence.
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
        directive_no
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
ADD CONSTRAINT uq_directives_tenant_franchise_ata_model_refamp_directive_no
UNIQUE NULLS NOT DISTINCT (
  tenant_id,
  franchise_id,
  ata_code,
  assembly_models,
  reference_amp,
  directive_no
);

-- Validation output
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'directives'
  AND c.conname = 'uq_directives_tenant_franchise_ata_model_refamp_directive_no';

-- Post-check: there must be no remaining duplicates on the uniqueness key.
SELECT
  COUNT(*) AS duplicate_group_count
FROM (
  SELECT
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no
  FROM public.directives
  GROUP BY
    tenant_id,
    franchise_id,
    ata_code,
    assembly_models,
    reference_amp,
    directive_no
  HAVING COUNT(*) > 1
) s;

COMMIT;
