-- DB-VERIFICATION: amro-rename-wp-template-categories-to-wo-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Rename table public.amro_work_package_template_categories -> public.amro_work_order_template_categories
-- - Rename associated constraints/indexes/policies to work-order naming conventions

BEGIN;

DO $$
DECLARE
  v_old_table regclass := to_regclass('public.amro_work_package_template_categories');
  v_new_table regclass := to_regclass('public.amro_work_order_template_categories');
  rec record;
  v_new_name text;
BEGIN
  -- Rename table if still in legacy name.
  IF v_old_table IS NOT NULL AND v_new_table IS NULL THEN
    EXECUTE 'ALTER TABLE public.amro_work_package_template_categories RENAME TO amro_work_order_template_categories';
  END IF;

  v_new_table := to_regclass('public.amro_work_order_template_categories');
  IF v_new_table IS NULL THEN
    RETURN;
  END IF;

  -- Rename constraints attached to the table.
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = v_new_table
  LOOP
    v_new_name := rec.conname;
    v_new_name := replace(v_new_name, 'work_package_template_categories', 'work_order_template_categories');
    v_new_name := replace(v_new_name, 'template_category_code', 'work_order_template_category_code');
    v_new_name := replace(v_new_name, 'template_category', 'work_order_template_category');

    IF v_new_name <> rec.conname THEN
      EXECUTE format('ALTER TABLE public.amro_work_order_template_categories RENAME CONSTRAINT %I TO %I', rec.conname, v_new_name);
    END IF;
  END LOOP;

  -- Rename indexes attached to the table.
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_template_categories'
  LOOP
    v_new_name := rec.indexname;
    v_new_name := replace(v_new_name, 'template_categories', 'work_order_template_categories');
    v_new_name := replace(v_new_name, 'template_category_code', 'work_order_template_category_code');

    IF v_new_name <> rec.indexname THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.indexname, v_new_name);
    END IF;
  END LOOP;

  -- Rename policy identifiers for consistency.
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_template_categories'
      AND policyname = 'amro_platform_admin_access_template_categories'
  ) THEN
    EXECUTE 'ALTER POLICY amro_platform_admin_access_template_categories ON public.amro_work_order_template_categories RENAME TO amro_platform_admin_access_work_order_template_categories';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_template_categories'
      AND policyname = 'amro_tenant_franchise_scope_template_categories_read'
  ) THEN
    EXECUTE 'ALTER POLICY amro_tenant_franchise_scope_template_categories_read ON public.amro_work_order_template_categories RENAME TO amro_tenant_franchise_scope_work_order_template_categories_read';
  END IF;

  COMMENT ON TABLE public.amro_work_order_template_categories IS
    'Classification system for work order templates';
END
$$;

COMMIT;
