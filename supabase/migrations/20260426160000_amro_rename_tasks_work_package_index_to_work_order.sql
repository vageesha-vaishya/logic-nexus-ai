-- DB-VERIFICATION: tasks-index-rename-work-package-to-work-order-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review-required-before-merge

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_tasks_work_package_id'
      AND c.relkind = 'i'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_tasks_work_order_id'
      AND c.relkind = 'i'
  ) THEN
    EXECUTE 'ALTER INDEX public.idx_tasks_work_package_id RENAME TO idx_tasks_work_order_id';
  ELSIF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_tasks_work_package_id'
      AND c.relkind = 'i'
  ) AND EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_tasks_work_order_id'
      AND c.relkind = 'i'
  ) THEN
    -- Prevent duplicate index coverage under different names.
    EXECUTE 'DROP INDEX IF EXISTS public.idx_tasks_work_package_id';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'work_order_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_tasks_work_order_id'
      AND c.relkind = 'i'
  ) THEN
    EXECUTE 'CREATE INDEX idx_tasks_work_order_id ON public.tasks(work_order_id)';
  END IF;
END $$;

COMMIT;
