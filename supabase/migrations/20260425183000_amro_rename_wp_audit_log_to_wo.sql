-- DB-VERIFICATION: amro-rename-wp-audit-log-to-wo-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Rename table public.amro_work_order_audit_log -> public.amro_work_order_audit_log
-- - Rename associated constraints/indexes/policies to work-order naming
-- - Repoint residual inbound FKs from amro_work_order_audit_log(id) to amro_work_order_audit_log(id)

BEGIN;

DO $$
DECLARE
  v_old_table regclass := to_regclass('public.amro_work_order_audit_log');
  v_new_table regclass := to_regclass('public.amro_work_order_audit_log');
  rec record;
  v_new_name text;
  v_def text;
BEGIN
  IF v_old_table IS NOT NULL AND v_new_table IS NULL THEN
    EXECUTE 'ALTER TABLE public.amro_work_order_audit_log RENAME TO amro_work_order_audit_log';
  END IF;

  v_new_table := to_regclass('public.amro_work_order_audit_log');
  IF v_new_table IS NULL THEN
    RAISE NOTICE 'Skipping audit-log rename finalization because public.amro_work_order_audit_log is not present';
    RETURN;
  END IF;

  -- Rename constraints.
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = v_new_table
  LOOP
    v_new_name := rec.conname;
    v_new_name := replace(v_new_name, 'work_order_audit_log', 'work_order_audit_log');
    v_new_name := replace(v_new_name, 'wp_audit_log', 'wo_audit_log');

    IF v_new_name <> rec.conname THEN
      EXECUTE format('ALTER TABLE public.amro_work_order_audit_log RENAME CONSTRAINT %I TO %I', rec.conname, v_new_name);
    END IF;
  END LOOP;

  -- Rename indexes.
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_audit_log'
  LOOP
    v_new_name := rec.indexname;
    v_new_name := replace(v_new_name, 'work_order_audit_log', 'work_order_audit_log');
    v_new_name := replace(v_new_name, 'wp_audit_log', 'wo_audit_log');

    IF v_new_name <> rec.indexname THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.indexname, v_new_name);
    END IF;
  END LOOP;

  -- Rename policies for explicit work-order naming.
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_audit_log'
      AND policyname = 'amro_platform_admin_access_audit_log'
  ) THEN
    EXECUTE 'ALTER POLICY amro_platform_admin_access_audit_log ON public.amro_work_order_audit_log RENAME TO amro_platform_admin_access_work_order_audit_log';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_audit_log'
      AND policyname = 'amro_tenant_franchise_scope_audit_log_insert'
  ) THEN
    EXECUTE 'ALTER POLICY amro_tenant_franchise_scope_audit_log_insert ON public.amro_work_order_audit_log RENAME TO amro_tenant_franchise_scope_work_order_audit_log_insert';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_audit_log'
      AND policyname = 'amro_tenant_franchise_scope_audit_log_read'
  ) THEN
    EXECUTE 'ALTER POLICY amro_tenant_franchise_scope_audit_log_read ON public.amro_work_order_audit_log RENAME TO amro_tenant_franchise_scope_work_order_audit_log_read';
  END IF;

  -- Repoint residual inbound FKs from old table id in edge/partial states.
  v_old_table := to_regclass('public.amro_work_order_audit_log');
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
      v_new_name := replace(rec.conname, 'work_order_audit_log', 'work_order_audit_log');
      v_new_name := replace(v_new_name, 'wp_audit_log', 'wo_audit_log');
      IF v_new_name = rec.conname THEN
        v_new_name := rec.conname || '_woal';
      END IF;

      v_def := replace(
        replace(rec.condef, 'REFERENCES public.amro_work_order_audit_log', 'REFERENCES public.amro_work_order_audit_log'),
        'REFERENCES amro_work_order_audit_log',
        'REFERENCES amro_work_order_audit_log'
      );

      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.owning_table, rec.conname);
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.owning_table, v_new_name, v_def);
    END LOOP;
  END IF;

  COMMENT ON TABLE public.amro_work_order_audit_log IS
    'Immutable audit trail for all work-order operations';
END
$$;

COMMIT;
