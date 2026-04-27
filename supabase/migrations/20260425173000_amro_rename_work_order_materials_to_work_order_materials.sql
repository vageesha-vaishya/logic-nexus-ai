-- DB-VERIFICATION: amro-rename-work-order-materials-to-work-order-materials-verified
-- DB-ARCH-APPROVAL: pending-amro-arch-board-approval
--
-- Purpose:
-- - Rename public.work_order_materials.work_order_id -> work_order_id
-- - Rename table public.work_order_materials -> public.amro_work_order_materials
-- - Rename associated constraints, indexes, and policies to work-order naming
-- - Repoint any residual inbound FKs referencing work_order_materials(id) to amro_work_order_materials(id)

BEGIN;

DO $$
DECLARE
  v_old_table regclass := to_regclass('public.work_order_materials');
  v_new_table regclass := to_regclass('public.amro_work_order_materials');
  v_has_old_column boolean := false;
  v_has_new_column boolean := false;
  rec record;
  v_new_name text;
  v_def text;
BEGIN
  -- Column rename on legacy table before table rename (when applicable).
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
      EXECUTE 'ALTER TABLE public.work_order_materials RENAME COLUMN work_order_id TO work_order_id';
    END IF;
  END IF;

  -- Rename table to canonical AMRO work-order naming.
  IF v_old_table IS NOT NULL AND v_new_table IS NULL THEN
    EXECUTE 'ALTER TABLE public.work_order_materials RENAME TO amro_work_order_materials';
  END IF;

  v_new_table := to_regclass('public.amro_work_order_materials');
  IF v_new_table IS NULL THEN
    RAISE NOTICE 'Skipping materials rename finalization because public.amro_work_order_materials is not present';
    RETURN;
  END IF;

  -- Handle partial state where table renamed but column rename not yet applied.
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
    EXECUTE 'ALTER TABLE public.amro_work_order_materials RENAME COLUMN work_order_id TO work_order_id';
  END IF;

  -- Rename constraints on new table.
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = v_new_table
  LOOP
    v_new_name := rec.conname;
    v_new_name := replace(v_new_name, 'work_order_materials', 'work_order_materials');
    v_new_name := replace(v_new_name, 'work_order_id', 'work_order_id');

    IF v_new_name <> rec.conname THEN
      EXECUTE format('ALTER TABLE public.amro_work_order_materials RENAME CONSTRAINT %I TO %I', rec.conname, v_new_name);
    END IF;
  END LOOP;

  -- Rename indexes on new table.
  FOR rec IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_materials'
  LOOP
    v_new_name := rec.indexname;
    v_new_name := replace(v_new_name, 'work_order_materials', 'work_order_materials');
    v_new_name := replace(v_new_name, 'work_order_id', 'work_order_id');

    IF v_new_name <> rec.indexname THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rec.indexname, v_new_name);
    END IF;
  END LOOP;

  -- Rename policies on new table (handles quoted legacy policy names).
  FOR rec IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'amro_work_order_materials'
  LOOP
    v_new_name := rec.policyname;
    v_new_name := replace(v_new_name, 'Work package materials', 'Work order materials');
    v_new_name := replace(v_new_name, 'work_order_materials', 'work_order_materials');

    IF v_new_name <> rec.policyname THEN
      EXECUTE format('ALTER POLICY %I ON public.amro_work_order_materials RENAME TO %I', rec.policyname, v_new_name);
    END IF;
  END LOOP;

  -- Repoint residual inbound FKs if an old physical table still exists in edge environments.
  v_old_table := to_regclass('public.work_order_materials');
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
      v_new_name := replace(rec.conname, 'work_order_materials', 'work_order_materials');
      v_new_name := replace(v_new_name, 'work_order_id', 'work_order_id');
      IF v_new_name = rec.conname THEN
        v_new_name := rec.conname || '_awom';
      END IF;

      v_def := replace(
        replace(rec.condef, 'REFERENCES public.work_order_materials', 'REFERENCES public.amro_work_order_materials'),
        'REFERENCES work_order_materials',
        'REFERENCES amro_work_order_materials'
      );

      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', rec.owning_table, rec.conname);
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', rec.owning_table, v_new_name, v_def);
    END LOOP;
  END IF;

  COMMENT ON TABLE public.amro_work_order_materials IS
    'Parts/material demand, reservation, and sourcing lines for AMRO work orders';
END
$$;

COMMIT;
