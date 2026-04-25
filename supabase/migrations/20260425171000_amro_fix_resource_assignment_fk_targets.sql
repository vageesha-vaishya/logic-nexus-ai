-- DB-VERIFICATION: amro-fix-resource-assignment-fk-targets-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Repoint any residual foreign keys referencing public.amro_work_package_resource_assignments(id)
--   to public.amro_work_order_resource_assignments(id).
-- - Keep migration safe for environments where no such foreign keys exist.

BEGIN;

DO $$
DECLARE
  rec record;
  v_new_name text;
  v_def text;
  v_old_table regclass := to_regclass('public.amro_work_package_resource_assignments');
  v_new_table regclass := to_regclass('public.amro_work_order_resource_assignments');
BEGIN
  -- Ensure canonical table exists in partially migrated environments.
  IF v_new_table IS NULL AND v_old_table IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.amro_work_package_resource_assignments RENAME TO amro_work_order_resource_assignments';
    v_new_table := to_regclass('public.amro_work_order_resource_assignments');
    v_old_table := to_regclass('public.amro_work_package_resource_assignments');
  END IF;

  IF v_new_table IS NULL THEN
    RAISE NOTICE 'Skipping resource-assignment FK repoint because public.amro_work_order_resource_assignments does not exist';
    RETURN;
  END IF;

  -- Repoint constraints only when they still target a physical legacy table.
  IF v_old_table IS NULL THEN
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      c.conname,
      c.conrelid::regclass AS owning_table,
      pg_get_constraintdef(c.oid, true) AS condef
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = v_old_table
  LOOP
    v_new_name := replace(rec.conname, 'work_package_resource_assignments', 'work_order_resource_assignments');
    v_new_name := replace(v_new_name, 'resource_assignment', 'work_order_resource_assignment');
    IF v_new_name = rec.conname THEN
      v_new_name := rec.conname || '_wora';
    END IF;

    v_def := replace(
      replace(rec.condef, 'REFERENCES public.amro_work_package_resource_assignments', 'REFERENCES public.amro_work_order_resource_assignments'),
      'REFERENCES amro_work_package_resource_assignments',
      'REFERENCES amro_work_order_resource_assignments'
    );

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.owning_table, rec.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.owning_table, v_new_name, v_def);
  END LOOP;
END
$$;

COMMIT;
