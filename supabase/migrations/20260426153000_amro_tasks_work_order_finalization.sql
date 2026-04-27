-- DB-VERIFICATION: tasks-work-order-finalization-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
DECLARE
  has_work_order boolean;
  has_work_package boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'work_order_id'
  ) INTO has_work_order;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'work_package_id'
  ) INTO has_work_package;

  IF has_work_package AND NOT has_work_order THEN
    EXECUTE 'ALTER TABLE public.tasks RENAME COLUMN work_package_id TO work_order_id';
    has_work_order := true;
    has_work_package := false;
  END IF;

  IF has_work_order AND has_work_package THEN
    EXECUTE 'UPDATE public.tasks SET work_order_id = COALESCE(work_order_id, work_package_id)';
  END IF;
END $$;

-- Remove compatibility artifacts and any constraints/indexes tied to tasks.work_package_id.
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_work_package_id_compat_fkey;
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS ck_tasks_work_order_alias_consistency;

DROP TRIGGER IF EXISTS trg_sync_tasks_work_order_alias_columns ON public.tasks;
DROP FUNCTION IF EXISTS public.sync_tasks_work_order_alias_columns();

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  FOR v_constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND a.attname = 'work_package_id'
      AND a.attnum = ANY (c.conkey)
  LOOP
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;
END $$;

DO $$
DECLARE
  v_index_name text;
BEGIN
  FOR v_index_name IN
    SELECT idx.relname
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'tasks'
      AND a.attname = 'work_package_id'
      AND a.attnum = ANY (i.indkey)
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', v_index_name);
  END LOOP;
END $$;

ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS work_package_id;

-- Normalize naming conventions from work_package -> work_order on tasks indexes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'uq_tasks_work_package_sequence_active' AND c.relkind = 'i'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'uq_tasks_work_order_sequence_active' AND c.relkind = 'i'
  ) THEN
    EXECUTE 'ALTER INDEX public.uq_tasks_work_package_sequence_active RENAME TO uq_tasks_work_order_sequence_active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_tasks_tenant_work_package_status' AND c.relkind = 'i'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_tasks_tenant_work_order_status' AND c.relkind = 'i'
  ) THEN
    EXECUTE 'ALTER INDEX public.idx_tasks_tenant_work_package_status RENAME TO idx_tasks_tenant_work_order_status';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_tasks_work_package_id' AND c.relkind = 'i'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idx_tasks_work_order_id' AND c.relkind = 'i'
  ) THEN
    EXECUTE 'ALTER INDEX public.idx_tasks_work_package_id RENAME TO idx_tasks_work_order_id';
  END IF;
END $$;

-- Ensure a single canonical FK for tasks.work_order_id -> work_orders(id), without duplicates.
DO $$
DECLARE
  v_tasks regclass := 'public.tasks'::regclass;
  v_work_orders regclass := 'public.work_orders'::regclass;
  v_work_order_attnum smallint;
  v_fk_name text;
BEGIN
  SELECT attnum::smallint
  INTO v_work_order_attnum
  FROM pg_attribute
  WHERE attrelid = v_tasks
    AND attname = 'work_order_id'
    AND NOT attisdropped;

  IF v_work_order_attnum IS NULL THEN
    RAISE EXCEPTION 'tasks.work_order_id does not exist';
  END IF;

  SELECT c.conname
  INTO v_fk_name
  FROM pg_constraint c
  WHERE c.conrelid = v_tasks
    AND c.contype = 'f'
    AND c.confrelid = v_work_orders
    AND c.conkey = ARRAY[v_work_order_attnum]::smallint[]
  LIMIT 1;

  IF v_fk_name IS NOT NULL AND v_fk_name <> 'tasks_work_order_id_fkey' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = v_tasks
        AND conname = 'tasks_work_order_id_fkey'
    ) THEN
      EXECUTE format('ALTER TABLE public.tasks RENAME CONSTRAINT %I TO tasks_work_order_id_fkey', v_fk_name);
    ELSE
      EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS %I', v_fk_name);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = v_tasks
      AND conname = 'tasks_work_order_id_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_work_order_id_fkey
      FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN public.tasks.work_order_id IS
  'Canonical FK to public.work_orders(id).';

COMMIT;
