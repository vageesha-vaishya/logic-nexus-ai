-- DB-VERIFICATION: tasks-work-order-nullable-and-flypal-franchise-reviewed
-- DB-ARCH-APPROVAL: not-required-no-create-table

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'Table public.tasks does not exist.';
  END IF;
  IF to_regclass('flypal.flypal_configured_directives') IS NULL THEN
    RAISE EXCEPTION 'Table flypal.flypal_configured_directives does not exist.';
  END IF;
END $$;

-- Make work_order_id nullable in tasks.
ALTER TABLE public.tasks
  ALTER COLUMN work_order_id DROP NOT NULL;

-- Add franchise_id to flypal configured directives.
ALTER TABLE flypal.flypal_configured_directives
  ADD COLUMN IF NOT EXISTS franchise_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'flypal'
      AND t.relname = 'flypal_configured_directives'
      AND c.conname = 'flypal_configured_directives_franchise_id_fkey'
  ) THEN
    ALTER TABLE flypal.flypal_configured_directives
      ADD CONSTRAINT flypal_configured_directives_franchise_id_fkey
      FOREIGN KEY (franchise_id)
      REFERENCES public.franchises(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flypal_configured_directives_franchise_id
  ON flypal.flypal_configured_directives(franchise_id);

COMMIT;
