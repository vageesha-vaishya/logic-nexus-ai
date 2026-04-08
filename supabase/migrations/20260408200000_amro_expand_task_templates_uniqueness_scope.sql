BEGIN;

DO $$
DECLARE
  table_exists boolean;
  constraint_exists boolean;
  constraint_matches_target boolean;
  duplicate_count bigint;
BEGIN
  SELECT to_regclass('public.task_templates') IS NOT NULL INTO table_exists;
  IF NOT table_exists THEN
    RAISE EXCEPTION 'Table public.task_templates does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'Column public.task_templates.tenant_id does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'franchise_id'
  ) THEN
    RAISE EXCEPTION 'Column public.task_templates.franchise_id does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'ata_code'
  ) THEN
    RAISE EXCEPTION 'Column public.task_templates.ata_code does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'assembly_models'
  ) THEN
    RAISE EXCEPTION 'Column public.task_templates.assembly_models does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'task_templates'
      AND column_name = 'reference_amp'
  ) THEN
    RAISE EXCEPTION 'Column public.task_templates.reference_amp does not exist';
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
  ) INTO constraint_exists;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'task_templates'
      AND c.conname = 'uq_maintenance_tasks_tenant_ata_ref'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) = 'UNIQUE (tenant_id, franchise_id, ata_code, assembly_models, reference_amp)'
  ) INTO constraint_matches_target;

  IF constraint_matches_target THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT tenant_id, franchise_id, ata_code, assembly_models, reference_amp
    FROM public.task_templates
    WHERE tenant_id IS NOT NULL
      AND franchise_id IS NOT NULL
      AND ata_code IS NOT NULL
      AND assembly_models IS NOT NULL
      AND reference_amp IS NOT NULL
    GROUP BY tenant_id, franchise_id, ata_code, assembly_models, reference_amp
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'Cannot apply uq_maintenance_tasks_tenant_ata_ref update: % duplicate groups exist for (tenant_id, franchise_id, ata_code, assembly_models, reference_amp)',
      duplicate_count;
  END IF;

  IF constraint_exists THEN
    ALTER TABLE public.task_templates
      DROP CONSTRAINT uq_maintenance_tasks_tenant_ata_ref;
  END IF;

  ALTER TABLE public.task_templates
    ADD CONSTRAINT uq_maintenance_tasks_tenant_ata_ref
      UNIQUE (tenant_id, franchise_id, ata_code, assembly_models, reference_amp);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'task_templates'
      AND c.conname = 'uq_maintenance_tasks_tenant_ata_ref'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) = 'UNIQUE (tenant_id, franchise_id, ata_code, assembly_models, reference_amp)'
  ) THEN
    RAISE EXCEPTION 'Verification failed for uq_maintenance_tasks_tenant_ata_ref on public.task_templates';
  END IF;
END;
$$;

COMMENT ON CONSTRAINT uq_maintenance_tasks_tenant_ata_ref ON public.task_templates IS
  'Expanded uniqueness scope to tenant + franchise + ATA + assembly model + reference AMP to prevent cross-franchise and cross-model collisions.';

COMMIT;
