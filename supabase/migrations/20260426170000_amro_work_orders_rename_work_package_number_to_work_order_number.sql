-- DB-VERIFICATION: work-orders-number-column-rename-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
DECLARE
  has_work_package_number boolean;
  has_work_order_number boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'work_package_number'
  ) INTO has_work_package_number;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'work_order_number'
  ) INTO has_work_order_number;

  IF has_work_package_number AND NOT has_work_order_number THEN
    EXECUTE 'ALTER TABLE public.work_orders RENAME COLUMN work_package_number TO work_order_number';
  ELSIF has_work_package_number AND has_work_order_number THEN
    EXECUTE 'UPDATE public.work_orders SET work_order_number = COALESCE(work_order_number, work_package_number)';
    EXECUTE 'ALTER TABLE public.work_orders DROP COLUMN work_package_number';
  END IF;
END $$;

-- Normalize constraint names to work_order_number naming and avoid duplicates.
DO $$
DECLARE
  v_name text;
  v_new_name text;
BEGIN
  FOR v_name IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'work_orders'
      AND c.conname LIKE '%work_package_number%'
  LOOP
    v_new_name := replace(v_name, 'work_package_number', 'work_order_number');
    v_new_name := replace(v_new_name, 'work_packages', 'work_orders');
    IF v_new_name <> v_name THEN
      IF EXISTS (
        SELECT 1
        FROM pg_constraint c2
        JOIN pg_class t2 ON t2.oid = c2.conrelid
        JOIN pg_namespace n2 ON n2.oid = t2.relnamespace
        WHERE n2.nspname = 'public'
          AND t2.relname = 'work_orders'
          AND c2.conname = v_new_name
      ) THEN
        EXECUTE format('ALTER TABLE public.work_orders DROP CONSTRAINT IF EXISTS %I', v_name);
      ELSE
        EXECUTE format('ALTER TABLE public.work_orders RENAME CONSTRAINT %I TO %I', v_name, v_new_name);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Normalize index names to work_order_number naming and avoid duplicates.
DO $$
DECLARE
  v_name text;
  v_new_name text;
BEGIN
  FOR v_name IN
    SELECT i.relname
    FROM pg_class i
    JOIN pg_index idx ON idx.indexrelid = i.oid
    JOIN pg_class t ON t.oid = idx.indrelid
    JOIN pg_namespace n ON n.oid = i.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'work_orders'
      AND i.relname LIKE '%work_package_number%'
  LOOP
    v_new_name := replace(v_name, 'work_package_number', 'work_order_number');
    v_new_name := replace(v_new_name, 'work_packages', 'work_orders');
    IF v_new_name <> v_name THEN
      IF EXISTS (
        SELECT 1
        FROM pg_class i2
        JOIN pg_namespace n2 ON n2.oid = i2.relnamespace
        WHERE n2.nspname = 'public'
          AND i2.relname = v_new_name
      ) THEN
        EXECUTE format('DROP INDEX IF EXISTS public.%I', v_name);
      ELSE
        EXECUTE format('ALTER INDEX public.%I RENAME TO %I', v_name, v_new_name);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Ensure canonical unique index exists with renamed column.
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_tenant_work_order_number
  ON public.work_orders(tenant_id, work_order_number)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.work_orders.work_order_number IS
  'Canonical work order identifier. Replaces legacy work_package_number.';

COMMIT;
