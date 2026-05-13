-- DB-VERIFICATION: directives-unique-remove-franchise-id-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
DECLARE
  v_duplicate_groups integer := 0;
BEGIN
  IF to_regclass('public.directives') IS NULL THEN
    RAISE EXCEPTION 'Table public.directives does not exist.';
  END IF;

  -- Safety pre-check:
  -- Removing franchise_id from uniqueness can create collisions across franchises.
  SELECT COUNT(*)
  INTO v_duplicate_groups
  FROM (
    SELECT
      tenant_id,
      ata_code,
      assembly_models,
      reference_amp,
      directive_no
    FROM public.directives
    GROUP BY
      tenant_id,
      ata_code,
      assembly_models,
      reference_amp,
      directive_no
    HAVING COUNT(*) > 1
  ) d;

  IF v_duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'Cannot remove franchise_id from directives uniqueness; % duplicate group(s) already exist on (tenant_id, ata_code, assembly_models, reference_amp, directive_no).',
      v_duplicate_groups;
  END IF;
END
$$;

ALTER TABLE public.directives
DROP CONSTRAINT IF EXISTS uq_directives_tenant_franchise_ata_model_refamp_directive_no;

ALTER TABLE public.directives
ADD CONSTRAINT uq_directives_tenant_franchise_ata_model_refamp_directive_no
UNIQUE NULLS NOT DISTINCT (
  tenant_id,
  ata_code,
  assembly_models,
  reference_amp,
  directive_no
);

-- Validation output.
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
