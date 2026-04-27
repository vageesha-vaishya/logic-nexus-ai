-- Drop legacy work_order_number column and consolidate to work_order_number.
-- This completes the rename that was started in 20260322132000 but never finished.

BEGIN;

-- 1. Find and update any code references that still use work_order_number
--    (This is a data-level fix; code-level cleanup is separate)

-- 2. Drop any indexes/constraints that reference work_order_number
DROP INDEX IF EXISTS uq_work_orders_tenant_order_number;
DROP INDEX IF EXISTS idx_work_orders_work_order_number;

-- 3. Drop the legacy column (it duplicates work_order_number)
ALTER TABLE public.work_orders
  DROP COLUMN IF EXISTS work_order_number;

-- 4. Verify the primary column is properly constrained
DO $$
BEGIN
  -- Ensure work_order_number is NOT NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'work_order_number'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.work_orders
      ALTER COLUMN work_order_number SET NOT NULL;
  END IF;

  -- Ensure unique constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'work_orders'
      AND indexname = 'uq_work_orders_tenant_number_active'
  ) THEN
    CREATE UNIQUE INDEX uq_work_orders_tenant_number_active
      ON public.work_orders(tenant_id, work_order_number)
      WHERE deleted_at IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'Legacy work_order_number column removed. work_order_number is now the sole identifier.';
END $$;
COMMIT;
