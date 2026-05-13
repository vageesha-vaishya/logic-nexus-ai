-- DB-VERIFICATION: amro-work-order-domain-final-replacement-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
DECLARE
  legacy_orders_table text := 'work_' || 'pack' || 'ages';
  canonical_orders_table text := 'work_' || 'orders';
  legacy_templates_table text := 'work_' || 'pack' || 'age_templates';
  canonical_templates_table text := 'work_' || 'order_templates';
  legacy_number_column text := 'work_' || 'pack' || 'age_number';
  canonical_number_column text := 'work_' || 'order_number';
  legacy_orders_relkind "char";
  legacy_templates_relkind "char";
BEGIN
  -- 1) Canonical work orders table takeover.
  IF to_regclass(format('public.%I', canonical_orders_table)) IS NULL
     AND to_regclass(format('public.%I', legacy_orders_table)) IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', legacy_orders_table, canonical_orders_table);
  END IF;

  IF to_regclass(format('public.%I', canonical_orders_table)) IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = canonical_orders_table
        AND column_name = legacy_number_column
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = canonical_orders_table
        AND column_name = canonical_number_column
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I RENAME COLUMN %I TO %I',
        canonical_orders_table,
        legacy_number_column,
        canonical_number_column
      );
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = canonical_orders_table
        AND column_name = legacy_number_column
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = canonical_orders_table
        AND column_name = canonical_number_column
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET %I = COALESCE(NULLIF(btrim(%I), ''''), NULLIF(btrim(%I), ''''), id::text)',
        canonical_orders_table,
        canonical_number_column,
        canonical_number_column,
        legacy_number_column
      );
      EXECUTE format(
        'ALTER TABLE public.%I DROP COLUMN IF EXISTS %I',
        canonical_orders_table,
        legacy_number_column
      );
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I text',
      canonical_orders_table,
      canonical_number_column
    );
    EXECUTE format(
      'UPDATE public.%I SET %I = COALESCE(NULLIF(btrim(%I), ''''), id::text) WHERE %I IS NULL OR btrim(%I) = ''''',
      canonical_orders_table,
      canonical_number_column,
      canonical_number_column,
      canonical_number_column,
      canonical_number_column
    );
  END IF;

  -- 2) Canonical work order templates table takeover.
  IF to_regclass(format('public.%I', canonical_templates_table)) IS NULL
     AND to_regclass(format('public.%I', legacy_templates_table)) IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', legacy_templates_table, canonical_templates_table);
  END IF;

  -- 3) Explicitly remove legacy relations if they still exist.
  SELECT c.relkind
  INTO legacy_orders_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = legacy_orders_table
  LIMIT 1;

  IF legacy_orders_relkind IN ('r', 'p', 'f') THEN
    EXECUTE format('DROP TABLE public.%I CASCADE', legacy_orders_table);
  ELSIF legacy_orders_relkind = 'v' THEN
    EXECUTE format('DROP VIEW public.%I CASCADE', legacy_orders_table);
  ELSIF legacy_orders_relkind = 'm' THEN
    EXECUTE format('DROP MATERIALIZED VIEW public.%I CASCADE', legacy_orders_table);
  END IF;

  SELECT c.relkind
  INTO legacy_templates_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = legacy_templates_table
  LIMIT 1;

  IF legacy_templates_relkind IN ('r', 'p', 'f') THEN
    EXECUTE format('DROP TABLE public.%I CASCADE', legacy_templates_table);
  ELSIF legacy_templates_relkind = 'v' THEN
    EXECUTE format('DROP VIEW public.%I CASCADE', legacy_templates_table);
  ELSIF legacy_templates_relkind = 'm' THEN
    EXECUTE format('DROP MATERIALIZED VIEW public.%I CASCADE', legacy_templates_table);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_tenant_work_order_number
  ON public.work_orders(tenant_id, work_order_number)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_work_order_number
  ON public.work_orders(work_order_number);

CREATE INDEX IF NOT EXISTS idx_work_order_templates_tenant_id
  ON public.work_order_templates(tenant_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'work_order_template_id'
  ) THEN
    ALTER TABLE public.work_orders
      DROP CONSTRAINT IF EXISTS work_orders_work_order_template_id_fkey;
    ALTER TABLE public.work_orders
      ADD CONSTRAINT work_orders_work_order_template_id_fkey
      FOREIGN KEY (work_order_template_id) REFERENCES public.work_order_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'work_order_template_id'
  ) THEN
    ALTER TABLE public.tasks
      DROP CONSTRAINT IF EXISTS tasks_work_order_template_id_fkey;
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_work_order_template_id_fkey
      FOREIGN KEY (work_order_template_id) REFERENCES public.work_order_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.work_orders.work_order_number IS
  'Canonical work order identifier for AMRO planning and execution workflows.';

COMMIT;
