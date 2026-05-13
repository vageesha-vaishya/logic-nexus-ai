-- DB-VERIFICATION: task-templates-uq-maintenance-tasks-tenant-ata-ref-redefined-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
DECLARE
  constraint_matches_target boolean;
  duplicate_count bigint;
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
      AND pg_get_constraintdef(c.oid) = 'UNIQUE NULLS NOT DISTINCT (tenant_id, franchise_id, ata_code, assembly_models, reference_amp, code_form_no, category_code)'
  ) INTO constraint_matches_target;

  IF constraint_matches_target THEN
    RETURN;
  END IF;

  -- Count duplicate groups under the target UNIQUE NULLS NOT DISTINCT key.
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT
      tenant_id,
      franchise_id,
      ata_code,
      assembly_models,
      reference_amp,
      code_form_no,
      category_code
    FROM public.task_templates
    GROUP BY
      tenant_id,
      franchise_id,
      ata_code,
      assembly_models,
      reference_amp,
      code_form_no,
      category_code
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE NOTICE
      'Resolving % duplicate groups for uq_maintenance_tasks_tenant_ata_ref before constraint recreation.',
      duplicate_count;

    -- Build winner/loser mapping per duplicate key. Keep the earliest UUID to ensure deterministic merge.
    CREATE TEMP TABLE tmp_task_template_dedup_map ON COMMIT DROP AS
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY
            tenant_id,
            franchise_id,
            ata_code,
            assembly_models,
            reference_amp,
            code_form_no,
            category_code
          ORDER BY created_at DESC, id DESC
        ) AS keeper_id
      FROM public.task_templates
    )
    SELECT id AS loser_id, keeper_id
    FROM ranked
    WHERE id <> keeper_id;

    -- Repoint dependent rows to the keeper task template before delete.
    IF to_regclass('public.work_order_template_task_templates') IS NOT NULL THEN
      -- Remove rows that would conflict after remapping loser -> keeper.
      WITH mapped AS (
        SELECT
          w.id,
          w.tenant_id,
          COALESCE(w.franchise_id, '00000000-0000-0000-0000-000000000000'::uuid) AS franchise_scope,
          w.work_order_template_id,
          w.model_id,
          COALESCE(m.keeper_id, w.task_template_id) AS final_task_template_id,
          w.created_at
        FROM public.work_order_template_task_templates w
        LEFT JOIN tmp_task_template_dedup_map m
          ON m.loser_id = w.task_template_id
      ),
      rel_ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY
              tenant_id,
              franchise_scope,
              work_order_template_id,
              model_id,
              final_task_template_id
            ORDER BY created_at DESC, id DESC
          ) AS rn
        FROM mapped
      )
      DELETE FROM public.work_order_template_task_templates r
      USING rel_ranked rr
      WHERE r.id = rr.id
        AND rr.rn > 1;

      UPDATE public.work_order_template_task_templates w
      SET task_template_id = m.keeper_id
      FROM tmp_task_template_dedup_map m
      WHERE w.task_template_id = m.loser_id;
    END IF;

    -- Remove duplicate task template rows, retaining only keeper rows.
    DELETE FROM public.task_templates t
    USING tmp_task_template_dedup_map m
    WHERE t.id = m.loser_id;
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
        category_code
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
      AND pg_get_constraintdef(c.oid) = 'UNIQUE NULLS NOT DISTINCT (tenant_id, franchise_id, ata_code, assembly_models, reference_amp, code_form_no, category_code)'
  ) THEN
    RAISE EXCEPTION 'Verification failed for uq_maintenance_tasks_tenant_ata_ref on public.task_templates.';
  END IF;
END;
$$;

COMMENT ON CONSTRAINT uq_maintenance_tasks_tenant_ata_ref ON public.task_templates IS
  'Uniqueness scope set to tenant + franchise + ATA + assembly model + reference AMP + code_form_no + category_code with NULLS NOT DISTINCT semantics.';

COMMIT;
