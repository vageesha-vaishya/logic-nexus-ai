-- Fix quote_charges to support per-leg charges and correct option FK
-- Idempotent guards ensure safe re-application

DO $$
BEGIN
  -- 1) Add leg_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_charges'
      AND column_name = 'leg_id'
  ) THEN
    ALTER TABLE public.quote_charges
      ADD COLUMN leg_id uuid NULL;
  END IF;

  -- 2) Attach FK for leg_id to quotation_version_option_legs if not present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_leg_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges
      ADD CONSTRAINT quote_charges_leg_id_fkey
      FOREIGN KEY (leg_id)
      REFERENCES public.quotation_version_option_legs(id)
      ON DELETE CASCADE;
  END IF;

  -- 3) Ensure quote_option_id references quotation_version_options, not quote_options
  -- Drop any existing FK on quote_option_id that might point to public.quote_options
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_quote_option_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges
      DROP CONSTRAINT quote_charges_quote_option_id_fkey;
  END IF;

  -- Recreate FK to public.quotation_version_options
  ALTER TABLE public.quote_charges
    ADD CONSTRAINT quote_charges_quote_option_id_fkey
    FOREIGN KEY (quote_option_id)
    REFERENCES public.quotation_version_options(id)
    ON DELETE CASCADE;
END $$;

-- Optional: simple tenant RLS alignment (keeps existing if already set)
ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_read'
  ) THEN
    CREATE POLICY quote_charges_read ON public.quote_charges FOR SELECT
      USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_manage'
  ) THEN
    CREATE POLICY quote_charges_manage ON public.quote_charges FOR ALL
      USING (tenant_id = get_user_tenant_id(auth.uid()))
      WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;