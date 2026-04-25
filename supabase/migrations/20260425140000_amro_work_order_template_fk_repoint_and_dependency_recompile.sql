-- DB-VERIFICATION: amro-work-order-template-fk-repoint-validated
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Ensure all foreign keys that should target template master records reference public.work_order_templates(id).
-- - Recompile SQL functions that still reference public.work_package_templates to use the canonical table.
-- - Keep legacy compatibility view public.work_package_templates in place for transition-safe runtime behavior.

BEGIN;

-- Ensure canonical physical table exists even on partially migrated environments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'work_package_templates'
      AND c.relkind IN ('r', 'p')
  ) AND to_regclass('public.work_order_templates') IS NULL THEN
    ALTER TABLE public.work_package_templates RENAME TO work_order_templates;
  END IF;
END
$$;

-- Ensure compatibility view exists for legacy readers/writers during dev transition.
DO $$
BEGIN
  IF to_regclass('public.work_order_templates') IS NOT NULL THEN
    DROP VIEW IF EXISTS public.work_package_templates;
    CREATE VIEW public.work_package_templates AS
    SELECT *
    FROM public.work_order_templates;
  END IF;
END
$$;

-- Repoint known FK columns used by AMRO flows.
DO $$
DECLARE
  rec record;
BEGIN
  IF to_regclass('public.work_order_templates') IS NULL THEN
    RAISE EXCEPTION 'public.work_order_templates is required before FK repoint';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'work_packages'
      AND c.relkind IN ('r', 'p')
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_packages'
      AND column_name = 'work_package_template_id'
  ) THEN
    FOR rec IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.work_packages'::regclass
        AND c.contype = 'f'
        AND a.attname = 'work_package_template_id'
    LOOP
      EXECUTE format('ALTER TABLE public.work_packages DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;

    ALTER TABLE public.work_packages
      ADD CONSTRAINT fk_work_packages_work_order_template_id
      FOREIGN KEY (work_package_template_id)
      REFERENCES public.work_order_templates(id)
      ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'amro_work_package_template_versions'
      AND c.relkind IN ('r', 'p')
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'amro_work_package_template_versions'
      AND column_name = 'template_id'
  ) THEN
    FOR rec IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.amro_work_package_template_versions'::regclass
        AND c.contype = 'f'
        AND a.attname = 'template_id'
    LOOP
      EXECUTE format('ALTER TABLE public.amro_work_package_template_versions DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;

    ALTER TABLE public.amro_work_package_template_versions
      ADD CONSTRAINT fk_amro_wp_template_versions_work_order_template_id
      FOREIGN KEY (template_id)
      REFERENCES public.work_order_templates(id)
      ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'work_package_template_task_templates'
      AND c.relkind IN ('r', 'p')
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_package_template_task_templates'
      AND column_name = 'work_package_template_id'
  ) THEN
    FOR rec IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.work_package_template_task_templates'::regclass
        AND c.contype = 'f'
        AND a.attname = 'work_package_template_id'
    LOOP
      EXECUTE format('ALTER TABLE public.work_package_template_task_templates DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;

    ALTER TABLE public.work_package_template_task_templates
      ADD CONSTRAINT fk_wpt_task_templates_work_order_template_id
      FOREIGN KEY (work_package_template_id)
      REFERENCES public.work_order_templates(id)
      ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'work_package_template_task_temlates'
      AND c.relkind IN ('r', 'p')
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_package_template_task_temlates'
      AND column_name = 'work_package_template_id'
  ) THEN
    FOR rec IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'public.work_package_template_task_temlates'::regclass
        AND c.contype = 'f'
        AND a.attname = 'work_package_template_id'
    LOOP
      EXECUTE format('ALTER TABLE public.work_package_template_task_temlates DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;

    ALTER TABLE public.work_package_template_task_temlates
      ADD CONSTRAINT fk_wpt_task_temlates_work_order_template_id
      FOREIGN KEY (work_package_template_id)
      REFERENCES public.work_order_templates(id)
      ON DELETE CASCADE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'amro_ops'
      AND c.relname = 'work_package'
      AND c.relkind IN ('r', 'p')
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'amro_ops'
      AND table_name = 'work_package'
      AND column_name = 'work_package_template_id'
  ) THEN
    FOR rec IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a
        ON a.attrelid = c.conrelid
       AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'amro_ops.work_package'::regclass
        AND c.contype = 'f'
        AND a.attname = 'work_package_template_id'
    LOOP
      EXECUTE format('ALTER TABLE amro_ops.work_package DROP CONSTRAINT IF EXISTS %I', rec.conname);
    END LOOP;

    ALTER TABLE amro_ops.work_package
      ADD CONSTRAINT fk_amro_ops_work_order_template_id
      FOREIGN KEY (work_package_template_id)
      REFERENCES public.work_order_templates(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Generic remediation: if any FK still points to a physical public.work_package_templates table,
-- rewrite the constraint definition to public.work_order_templates.
DO $$
DECLARE
  rec record;
  v_new_name text;
  v_def text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'work_package_templates'
      AND c.relkind IN ('r', 'p')
  ) THEN
    FOR rec IN
      SELECT
        c.oid,
        c.conname,
        c.conrelid::regclass AS owning_table,
        pg_get_constraintdef(c.oid, true) AS condef
      FROM pg_constraint c
      JOIN pg_class rel ON rel.oid = c.confrelid
      JOIN pg_namespace rel_ns ON rel_ns.oid = rel.relnamespace
      WHERE c.contype = 'f'
        AND rel_ns.nspname = 'public'
        AND rel.relname = 'work_package_templates'
    LOOP
      v_new_name := replace(rec.conname, 'work_package_templates', 'work_order_templates');
      IF v_new_name = rec.conname THEN
        v_new_name := rec.conname || '_wot';
      END IF;

      v_def := replace(
        replace(rec.condef, 'REFERENCES public.work_package_templates', 'REFERENCES public.work_order_templates'),
        'REFERENCES work_package_templates',
        'REFERENCES work_order_templates'
      );

      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.owning_table, rec.conname);
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.owning_table, v_new_name, v_def);
    END LOOP;
  END IF;
END
$$;

-- Recompile SQL/PLpgSQL functions that still reference legacy physical table token.
DO $$
DECLARE
  rec record;
  v_function_sql text;
BEGIN
  FOR rec IN
    SELECT
      p.oid,
      n.nspname AS schema_name,
      p.proname AS routine_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname IN ('public', 'amro_ops')
      AND p.prokind = 'f'
      AND l.lanname IN ('sql', 'plpgsql')
      AND pg_get_functiondef(p.oid) ILIKE '%work_package_templates%'
  LOOP
    v_function_sql := pg_get_functiondef(rec.oid);
    v_function_sql := replace(v_function_sql, 'public.work_package_templates%ROWTYPE', 'public.work_order_templates%ROWTYPE');
    v_function_sql := replace(v_function_sql, 'public.work_package_templates', 'public.work_order_templates');
    v_function_sql := replace(v_function_sql, 'work_package_templates table is not available', 'work_order_templates table is not available');

    -- Safety gate: only execute rewritten CREATE OR REPLACE FUNCTION statements.
    IF v_function_sql ~* '^\s*CREATE\s+OR\s+REPLACE\s+FUNCTION\s+' THEN
      BEGIN
        EXECUTE v_function_sql;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Skipping function %.% during WOT recompilation: %',
          rec.schema_name,
          rec.routine_name,
          SQLERRM;
      END;
    END IF;
  END LOOP;
END
$$;

COMMIT;
