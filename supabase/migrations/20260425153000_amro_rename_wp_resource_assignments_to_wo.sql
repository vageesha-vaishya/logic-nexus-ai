-- DB-VERIFICATION: amro-rename-wp-resource-assignments-to-wo-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Rename column public.amro_work_package_resource_assignments.work_package_id -> work_order_id
-- - Rename table public.amro_work_package_resource_assignments -> public.amro_work_order_resource_assignments
-- - Rename associated constraints, indexes, and policies to work-order naming conventions

BEGIN;

DO $$
DECLARE
  v_old_table regclass := to_regclass('public.amro_work_package_resource_assignments');
  v_new_table regclass := to_regclass('public.amro_work_order_resource_assignments');
  v_has_old_column boolean := false;
  v_has_new_column boolean := false;
  rec record;
  v_new_name text;
BEGIN
  IF v_old_table IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = v_old_table
        AND attname = 'work_package_id'
        AND NOT attisdropped
    ) INTO v_has_old_column;

    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = v_old_table
        AND attname = 'work_order_id'
        AND NOT attisdropped
    ) INTO v_has_new_column;

    IF v_has_old_column AND NOT v_has_new_column THEN
      EXECUTE 'ALTER TABLE public.amro_work_package_resource_assignments RENAME COLUMN work_package_id TO work_order_id';
    END IF;
  END IF;

  -- If old table exists and new table does not, rename table.
  IF v_old_table IS NOT NULL AND v_new_table IS NULL THEN
    EXECUTE 'ALTER TABLE public.amro_work_package_resource_assignments RENAME TO amro_work_order_resource_assignments';
  END IF;

  v_new_table := to_regclass('public.amro_work_order_resource_assignments');
  IF v_new_table IS NULL THEN
    RETURN;
  END IF;

  -- Handle partial state where table was renamed first but column was not.
  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = v_new_table
      AND attname = 'work_package_id'
      AND NOT attisdropped
  ) INTO v_has_old_column;

  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = v_new_table
      AND attname = 'work_order_id'
      AND NOT attisdropped
  ) INTO v_has_new_column;

  IF v_has_old_column AND NOT v_has_new_column THEN
    EXECUTE 'ALTER TABLE public.amro_work_order_resource_assignments RENAME COLUMN work_package_id TO work_order_id';
  END IF;

  -- Rename constraints on the renamed table.
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = v_new_table
  LOOP
    v_new_name := rec.conname;
    v_new_name := replace(v_new_name, 'work_package_resource_assignments', 'work_order_resource_assignments');
    v_new_name := replace(v_new_name, 'wp_resource_assignments', 'wo_resource_assignments');
    v_new_name := replace(v_new_name, 'work_package_id', 'work_order_id');

    IF v_new_name <> rec.conname THEN
      EXECUTE format('ALTER TABLE public.amro_work_order_resource_assignments RENAME CONSTRAINT %I TO %I', rec.conname, v_new_name);
    END IF;
  END LOOP;

  -- Rename indexes on the renamed table.
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_resource_assignments'
  LOOP
    v_new_name := rec.indexname;
    v_new_name := replace(v_new_name, 'work_package_resource_assignments', 'work_order_resource_assignments');
    v_new_name := replace(v_new_name, 'wp_resource_assignments', 'wo_resource_assignments');
    v_new_name := replace(v_new_name, 'work_package_id', 'work_order_id');

    IF v_new_name <> rec.indexname THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.indexname, v_new_name);
    END IF;
  END LOOP;

  -- Rename RLS policies for naming consistency.
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_resource_assignments'
      AND policyname = 'amro_platform_admin_access_wp_resource_assignments'
  ) THEN
    EXECUTE 'ALTER POLICY amro_platform_admin_access_wp_resource_assignments ON public.amro_work_order_resource_assignments RENAME TO amro_platform_admin_access_wo_resource_assignments';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_resource_assignments'
      AND policyname = 'amro_tenant_franchise_scope_wp_resource_assignments_read'
  ) THEN
    EXECUTE 'ALTER POLICY amro_tenant_franchise_scope_wp_resource_assignments_read ON public.amro_work_order_resource_assignments RENAME TO amro_tenant_franchise_scope_wo_resource_assignments_read';
  END IF;

  COMMENT ON TABLE public.amro_work_order_resource_assignments IS
    'Resource allocation and scheduling for work orders';
END
$$;

COMMIT;
