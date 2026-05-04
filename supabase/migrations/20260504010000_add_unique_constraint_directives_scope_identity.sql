-- DB-VERIFICATION: directives-composite-unique-constraint-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

-- Ensure target table exists.
DO $$
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;
END
$$;

-- Add composite unique constraint:
-- tenant_id, franchise_id, ata_code, assembly_models, reference_amp, directive_no (Directive No.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'directives'
      AND c.conname = 'uq_directives_tenant_franchise_ata_model_refamp_directive_no'
  ) THEN
    ALTER TABLE public.directives
      ADD CONSTRAINT uq_directives_tenant_franchise_ata_model_refamp_directive_no
      UNIQUE (
        tenant_id,
        franchise_id,
        ata_code,
        assembly_models,
        reference_amp,
        directive_no
      );
  END IF;
END
$$;

-- Validation output for migration logs.
SELECT
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'directives'
  AND c.conname = 'uq_directives_tenant_franchise_ata_model_refamp_directive_no';

COMMIT;
