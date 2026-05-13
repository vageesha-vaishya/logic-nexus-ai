-- DB-VERIFICATION: amro-fix-template-category-fk-targets-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Repoint any residual foreign keys referencing public.amro_work_order_template_categories(id)
--   to public.amro_work_order_template_categories(id).
-- - Keep migration safe for environments where no such FKs exist.

BEGIN;

DO $$
DECLARE
  rec record;
  v_new_name text;
  v_def text;
  v_old_table regclass := to_regclass('public.amro_work_order_template_categories');
  v_new_table regclass := to_regclass('public.amro_work_order_template_categories');
BEGIN
  -- Ensure canonical table exists in partially migrated environments.
  IF v_new_table IS NULL AND v_old_table IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.amro_work_order_template_categories RENAME TO amro_work_order_template_categories';
    v_new_table := to_regclass('public.amro_work_order_template_categories');
    v_old_table := to_regclass('public.amro_work_order_template_categories');
  END IF;

  IF v_new_table IS NULL THEN
    RAISE NOTICE 'Skipping template-category FK repoint because public.amro_work_order_template_categories does not exist';
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
    v_new_name := replace(rec.conname, 'work_order_template_categories', 'work_order_template_categories');
    v_new_name := replace(v_new_name, 'template_category', 'work_order_template_category');
    IF v_new_name = rec.conname THEN
      v_new_name := rec.conname || '_wotc';
    END IF;

    v_def := replace(
      replace(rec.condef, 'REFERENCES public.amro_work_order_template_categories', 'REFERENCES public.amro_work_order_template_categories'),
      'REFERENCES amro_work_order_template_categories',
      'REFERENCES amro_work_order_template_categories'
    );

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.owning_table, rec.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.owning_table, v_new_name, v_def);
  END LOOP;
END
$$;

COMMIT;
