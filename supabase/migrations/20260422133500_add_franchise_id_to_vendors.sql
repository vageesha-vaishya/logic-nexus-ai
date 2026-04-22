-- Vendor scope alignment: add franchise_id to vendors
-- DB-VERIFICATION: pending-local-migration-apply
-- DB-ARCH-APPROVAL: pending-review

BEGIN;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS franchise_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendors_franchise_id_fkey'
      AND conrelid = 'public.vendors'::regclass
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT vendors_franchise_id_fkey
      FOREIGN KEY (franchise_id)
      REFERENCES public.franchises(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vendors_franchise_id
  ON public.vendors(franchise_id);

COMMIT;
