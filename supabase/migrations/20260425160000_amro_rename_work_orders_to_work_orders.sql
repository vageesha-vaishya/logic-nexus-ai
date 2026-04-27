-- DB-VERIFICATION: full-impact-analysis-work-orders-to-work-orders-completed
-- DB-ARCH-APPROVAL: required-pending-before-merge

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
  ) THEN
    RAISE EXCEPTION 'Expected source table public.work_orders to exist';
  END IF;
END
$$;

-- 1) Primary table rename
ALTER TABLE public.work_orders RENAME TO work_orders;

-- 2) Supporting title table rename for naming consistency
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'work_orders_title'
  ) THEN
    ALTER TABLE public.work_orders_title RENAME TO work_order_titles;
  END IF;
END
$$;

-- 3) Rename scoped columns across schema (including work_orders and mapping tables)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'work_order_template_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I RENAME COLUMN work_order_template_id TO work_order_template_id',
      rec.table_schema,
      rec.table_name
    );
  END LOOP;

  FOR rec IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'work_order_title_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I RENAME COLUMN work_order_title_id TO work_order_title_id',
      rec.table_schema,
      rec.table_name
    );
  END LOOP;
END
$$;

-- 4) Domain rename for status naming convention
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'work_order_status'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'work_order_status'
  ) THEN
    ALTER DOMAIN public.work_order_status RENAME TO work_order_status;
  END IF;
END
$$;

-- Compatibility alias domain for legacy casts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'work_order_status'
  ) THEN
    CREATE DOMAIN public.work_order_status AS text
      CHECK (VALUE IN ('planning', 'approved', 'scheduled', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled'));
  END IF;
END
$$;

-- 5) Rename constraints on renamed tables
DO $$
DECLARE
  rec RECORD;
  new_name text;
BEGIN
  FOR rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid IN ('public.work_orders'::regclass, 'public.work_order_titles'::regclass)
      AND (
        conname LIKE '%work_orders%'
        OR conname LIKE '%work_order_template_id%'
        OR conname LIKE '%work_order_title_id%'
      )
  LOOP
    new_name := replace(rec.conname, 'work_orders', 'work_orders');
    new_name := replace(new_name, 'work_order_template_id', 'work_order_template_id');
    new_name := replace(new_name, 'work_order_title_id', 'work_order_title_id');

    IF new_name <> rec.conname
      AND length(new_name) <= 63
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conname = new_name
      ) THEN
      EXECUTE format(
        'ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
        CASE
          WHEN EXISTS (
            SELECT 1 FROM pg_constraint c
            WHERE c.conname = rec.conname
              AND c.conrelid = 'public.work_orders'::regclass
          ) THEN 'public.work_orders'
          ELSE 'public.work_order_titles'
        END,
        rec.conname,
        new_name
      );
    END IF;
  END LOOP;
END
$$;

-- 6) Rename indexes on renamed tables
DO $$
DECLARE
  rec RECORD;
  new_name text;
BEGIN
  FOR rec IN
    SELECT schemaname, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN ('work_orders', 'work_order_titles')
      AND (
        indexname LIKE '%work_orders%'
        OR indexname LIKE '%work_order_template_id%'
        OR indexname LIKE '%work_order_title_id%'
      )
  LOOP
    new_name := replace(rec.indexname, 'work_orders', 'work_orders');
    new_name := replace(new_name, 'work_order_template_id', 'work_order_template_id');
    new_name := replace(new_name, 'work_order_title_id', 'work_order_title_id');

    IF new_name <> rec.indexname
      AND length(new_name) <= 63
      AND NOT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = rec.schemaname
          AND c.relname = new_name
      ) THEN
      EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', rec.schemaname, rec.indexname, new_name);
    END IF;
  END LOOP;
END
$$;

-- 7) Compatibility view: legacy table name -> new table
DROP VIEW IF EXISTS public.work_orders;
DO $$
DECLARE
  select_list text;
BEGIN
  SELECT string_agg(
    CASE
      WHEN c.column_name = 'work_order_template_id' THEN format('%I AS work_order_template_id', c.column_name)
      WHEN c.column_name = 'work_order_title_id' THEN format('%I AS work_order_title_id', c.column_name)
      ELSE format('%I', c.column_name)
    END,
    ', ' ORDER BY c.ordinal_position
  )
  INTO select_list
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'work_orders';

  EXECUTE format(
    'CREATE VIEW public.work_orders AS SELECT %s FROM public.work_orders',
    select_list
  );
END
$$;

COMMENT ON VIEW public.work_orders IS
  'Backward-compatibility view after work_orders -> work_orders rename. Do not use for new development.';

-- 8) Compatibility view for title catalog table rename
DROP VIEW IF EXISTS public.work_orders_title;
CREATE VIEW public.work_orders_title AS
SELECT *
FROM public.work_order_titles;

COMMENT ON VIEW public.work_orders_title IS
  'Backward-compatibility view after work_orders_title -> work_order_titles rename.';

-- 9) Validation checks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
  ) THEN
    RAISE EXCEPTION 'Validation failed: public.work_orders was not created by rename';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'work_order_template_id'
  ) THEN
    RAISE EXCEPTION 'Validation failed: work_order_template_id missing on public.work_orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'work_order_title_id'
  ) THEN
    RAISE EXCEPTION 'Validation failed: work_order_title_id missing on public.work_orders';
  END IF;
END
$$;

COMMIT;
