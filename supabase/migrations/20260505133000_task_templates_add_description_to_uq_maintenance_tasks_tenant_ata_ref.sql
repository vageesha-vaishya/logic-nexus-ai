-- DB-VERIFICATION: task-templates-uq-maintenance-tasks-tenant-ata-ref-add-description-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
DECLARE
  constraint_matches_target boolean;
BEGIN
  IF to_regclass('public.task_templates') IS NULL THEN
    RAISE EXCEPTION 'Table public.task_templates does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'tenant_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'franchise_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'ata_code'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'assembly_models'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'reference_amp'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'code_form_no'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'category_code'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'description'
  ) THEN
    RAISE EXCEPTION 'One or more required columns are missing on public.task_templates.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'task_templates'
      AND c.conname = 'uq_maintenance_tasks_tenant_ata_ref'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) = 'UNIQUE NULLS NOT DISTINCT (tenant_id, franchise_id, ata_code, assembly_models, reference_amp, code_form_no, category_code, description)'
  ) INTO constraint_matches_target;

  IF constraint_matches_target THEN
    RETURN;
  END IF;

  ALTER TABLE public.task_templates
    DROP CONSTRAINT IF EXISTS uq_maintenance_tasks_tenant_ata_ref;

  ALTER TABLE public.task_templates
    ADD CONSTRAINT uq_maintenance_tasks_tenant_ata_ref
      UNIQUE NULLS NOT DISTINCT (
        tenant_id,
        franchise_id,
        ata_code,
        assembly_models,
        reference_amp,
        code_form_no,
        category_code,
        description
      );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'task_templates'
      AND c.conname = 'uq_maintenance_tasks_tenant_ata_ref'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) = 'UNIQUE NULLS NOT DISTINCT (tenant_id, franchise_id, ata_code, assembly_models, reference_amp, code_form_no, category_code, description)'
  ) THEN
    RAISE EXCEPTION 'Verification failed for uq_maintenance_tasks_tenant_ata_ref on public.task_templates.';
  END IF;
END;
$$;

COMMENT ON CONSTRAINT uq_maintenance_tasks_tenant_ata_ref ON public.task_templates IS
  'Uniqueness scope set to tenant + franchise + ATA + assembly model + reference AMP + code_form_no + category_code + description with NULLS NOT DISTINCT semantics.';

COMMIT;
