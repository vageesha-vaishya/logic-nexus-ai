-- DB-VERIFICATION: amro-rename-wp-compliance-records-to-wo-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Rename column public.amro_work_order_compliance_records.work_order_id -> work_order_id
-- - Rename table public.amro_work_order_compliance_records -> public.amro_work_order_compliance_records
-- - Rename associated constraints/indexes/policies to work-order naming
-- - Repoint residual inbound FKs from amro_work_order_compliance_records(id) to amro_work_order_compliance_records(id)

BEGIN;

DO $$
DECLARE
  v_old_table regclass := to_regclass('public.amro_work_order_compliance_records');
  v_new_table regclass := to_regclass('public.amro_work_order_compliance_records');
  v_has_old_column boolean := false;
  v_has_new_column boolean := false;
  rec record;
  v_new_name text;
  v_def text;
BEGIN
  -- Rename column on legacy table when applicable.
  IF v_old_table IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = v_old_table
        AND attname = 'work_order_id'
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
      EXECUTE 'ALTER TABLE public.amro_work_order_compliance_records RENAME COLUMN work_order_id TO work_order_id';
    END IF;
  END IF;

  -- Rename table to canonical work-order naming.
  IF v_old_table IS NOT NULL AND v_new_table IS NULL THEN
    EXECUTE 'ALTER TABLE public.amro_work_order_compliance_records RENAME TO amro_work_order_compliance_records';
  END IF;

  v_new_table := to_regclass('public.amro_work_order_compliance_records');
  IF v_new_table IS NULL THEN
    RAISE NOTICE 'Skipping compliance-record rename finalization because public.amro_work_order_compliance_records is not present';
    RETURN;
  END IF;

  -- Handle partial state where table renamed first.
  SELECT EXISTS (
    SELECT 1
    FROM pg_attribute
    WHERE attrelid = v_new_table
      AND attname = 'work_order_id'
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
    EXECUTE 'ALTER TABLE public.amro_work_order_compliance_records RENAME COLUMN work_order_id TO work_order_id';
  END IF;

  -- Rename constraints on new table.
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = v_new_table
  LOOP
    v_new_name := rec.conname;
    v_new_name := replace(v_new_name, 'work_order_compliance_records', 'work_order_compliance_records');
    v_new_name := replace(v_new_name, 'wp_compliance_records', 'wo_compliance_records');
    v_new_name := replace(v_new_name, 'compliance_records_wp', 'compliance_records_wo');
    v_new_name := replace(v_new_name, 'work_order_id', 'work_order_id');

    IF v_new_name <> rec.conname THEN
      EXECUTE format('ALTER TABLE public.amro_work_order_compliance_records RENAME CONSTRAINT %I TO %I', rec.conname, v_new_name);
    END IF;
  END LOOP;

  -- Rename indexes on new table.
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_compliance_records'
  LOOP
    v_new_name := rec.indexname;
    v_new_name := replace(v_new_name, 'work_order_compliance_records', 'work_order_compliance_records');
    v_new_name := replace(v_new_name, 'wp_compliance_records', 'wo_compliance_records');
    v_new_name := replace(v_new_name, 'compliance_records_wp', 'compliance_records_wo');
    v_new_name := replace(v_new_name, 'work_order_id', 'work_order_id');

    IF v_new_name <> rec.indexname THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.indexname, v_new_name);
    END IF;
  END LOOP;

  -- Rename policies for consistency.
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_compliance_records'
      AND policyname = 'amro_platform_admin_access_wp_compliance_records'
  ) THEN
    EXECUTE 'ALTER POLICY amro_platform_admin_access_wp_compliance_records ON public.amro_work_order_compliance_records RENAME TO amro_platform_admin_access_wo_compliance_records';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_compliance_records'
      AND policyname = 'amro_tenant_franchise_scope_wp_compliance_records_read'
  ) THEN
    EXECUTE 'ALTER POLICY amro_tenant_franchise_scope_wp_compliance_records_read ON public.amro_work_order_compliance_records RENAME TO amro_tenant_franchise_scope_wo_compliance_records_read';
  END IF;

  -- Repoint residual inbound FKs if an old physical table still exists in edge environments.
  v_old_table := to_regclass('public.amro_work_order_compliance_records');
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
      v_new_name := replace(rec.conname, 'work_order_compliance_records', 'work_order_compliance_records');
      v_new_name := replace(v_new_name, 'wp_compliance_records', 'wo_compliance_records');
      v_new_name := replace(v_new_name, 'compliance_records_wp', 'compliance_records_wo');
      IF v_new_name = rec.conname THEN
        v_new_name := rec.conname || '_wocr';
      END IF;

      v_def := replace(
        replace(rec.condef, 'REFERENCES public.amro_work_order_compliance_records', 'REFERENCES public.amro_work_order_compliance_records'),
        'REFERENCES amro_work_order_compliance_records',
        'REFERENCES amro_work_order_compliance_records'
      );

      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.owning_table, rec.conname);
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.owning_table, v_new_name, v_def);
    END LOOP;
  END IF;

  COMMENT ON TABLE public.amro_work_order_compliance_records IS
    'Compliance tracking with digital signatures and evidence for each work-order task';
END
$$;

COMMIT;
