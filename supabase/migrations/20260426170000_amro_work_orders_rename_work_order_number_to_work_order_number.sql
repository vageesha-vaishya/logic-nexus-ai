-- DB-VERIFICATION: work-orders-number-column-alignment-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'work_order_number'
  ) THEN
    ALTER TABLE public.work_orders
      ADD COLUMN work_order_number text;
  END IF;
END $$;

UPDATE public.work_orders
SET work_order_number = COALESCE(NULLIF(btrim(work_order_number), ''), id::text)
WHERE work_order_number IS NULL OR btrim(work_order_number) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_tenant_work_order_number
  ON public.work_orders(tenant_id, work_order_number)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.work_orders.work_order_number IS
  'Canonical work order identifier.';

COMMIT;
