-- DB-VERIFICATION: amro-rename-wp-template-versions-to-wo-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Rename table public.amro_work_order_template_versions -> public.amro_work_order_template_versions
-- - Rename associated constraints/indexes/policies to work-order naming
-- - Repoint residual inbound FKs from amro_work_order_template_versions(id) to amro_work_order_template_versions(id)

BEGIN;

DO $$
DECLARE
  v_old_table regclass := to_regclass('public.amro_work_order_template_versions');
  v_new_table regclass := to_regclass('public.amro_work_order_template_versions');
  rec record;
  v_new_name text;
  v_def text;
BEGIN
  IF v_old_table IS NOT NULL AND v_new_table IS NULL THEN
    EXECUTE 'ALTER TABLE public.amro_work_order_template_versions RENAME TO amro_work_order_template_versions';
  END IF;

  v_new_table := to_regclass('public.amro_work_order_template_versions');
  IF v_new_table IS NULL THEN
    RAISE NOTICE 'Skipping template-version rename finalization because public.amro_work_order_template_versions is not present';
    RETURN;
  END IF;

  -- Rename constraints.
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = v_new_table
  LOOP
    v_new_name := rec.conname;
    v_new_name := replace(v_new_name, 'work_order_template_versions', 'work_order_template_versions');
    v_new_name := replace(v_new_name, 'template_versions_wp', 'template_versions_wo');
    v_new_name := replace(v_new_name, 'wp_template_versions', 'wo_template_versions');

    IF v_new_name <> rec.conname THEN
      EXECUTE format('ALTER TABLE public.amro_work_order_template_versions RENAME CONSTRAINT %I TO %I', rec.conname, v_new_name);
    END IF;
  END LOOP;

  -- Rename indexes.
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_template_versions'
  LOOP
    v_new_name := rec.indexname;
    v_new_name := replace(v_new_name, 'work_order_template_versions', 'work_order_template_versions');
    v_new_name := replace(v_new_name, 'template_versions_wp', 'template_versions_wo');
    v_new_name := replace(v_new_name, 'wp_template_versions', 'wo_template_versions');

    IF v_new_name <> rec.indexname THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.indexname, v_new_name);
    END IF;
  END LOOP;

  -- Rename policies for consistency.
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_template_versions'
      AND policyname = 'amro_platform_admin_access_template_versions'
  ) THEN
    EXECUTE 'ALTER POLICY amro_platform_admin_access_template_versions ON public.amro_work_order_template_versions RENAME TO amro_platform_admin_access_work_order_template_versions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_template_versions'
      AND policyname = 'amro_tenant_franchise_scope_template_versions_read'
  ) THEN
    EXECUTE 'ALTER POLICY amro_tenant_franchise_scope_template_versions_read ON public.amro_work_order_template_versions RENAME TO amro_tenant_franchise_scope_work_order_template_versions_read';
  END IF;

  -- Repoint residual inbound FKs from the old table id in edge/partial states.
  v_old_table := to_regclass('public.amro_work_order_template_versions');
  IF v_old_table IS NOT NULL THEN
    FOR rec IN
      SELECT
        c.conname,
        c.conrelid::regclass AS owning_table,
        pg_get_constraintdef(c.oid, true) AS condef
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.confrelid = v_old_table
    LOOP
      v_new_name := replace(rec.conname, 'work_order_template_versions', 'work_order_template_versions');
      v_new_name := replace(v_new_name, 'template_versions_wp', 'template_versions_wo');
      v_new_name := replace(v_new_name, 'wp_template_versions', 'wo_template_versions');
      IF v_new_name = rec.conname THEN
        v_new_name := rec.conname || '_wotv';
      END IF;

      v_def := replace(
        replace(rec.condef, 'REFERENCES public.amro_work_order_template_versions', 'REFERENCES public.amro_work_order_template_versions'),
        'REFERENCES amro_work_order_template_versions',
        'REFERENCES amro_work_order_template_versions'
      );

      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.owning_table, rec.conname);
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.owning_table, v_new_name, v_def);
    END LOOP;
  END IF;

  COMMENT ON TABLE public.amro_work_order_template_versions IS
    'Template versioning with approval workflow for AMRO work-order change control';
END
$$;

COMMIT;
