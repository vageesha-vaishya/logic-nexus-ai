-- Fix missing foreign key relationship for PostgREST
-- This ensures quote_charges references quotation_version_option_legs correctly

DO $$
BEGIN
    -- 1. Drop potentially incorrect foreign keys on leg_id
    ALTER TABLE public.quote_charges DROP CONSTRAINT IF EXISTS fk_quote_charges_leg;
    ALTER TABLE public.quote_charges DROP CONSTRAINT IF EXISTS quote_charges_leg_id_fkey;

    -- 2. Add the correct foreign key pointing to quotation_version_option_legs
    -- This is required for the embedding: quotation_version_option_legs -> quote_charges
    ALTER TABLE public.quote_charges
      ADD CONSTRAINT quote_charges_leg_id_fkey
      FOREIGN KEY (leg_id)
      REFERENCES public.quotation_version_option_legs(id)
      ON DELETE CASCADE;

    -- 3. Ensure the quote_option_id FK is also correct (pointing to options, not quote_options)
    ALTER TABLE public.quote_charges DROP CONSTRAINT IF EXISTS quote_charges_quote_option_id_fkey;
    
    ALTER TABLE public.quote_charges
      ADD CONSTRAINT quote_charges_quote_option_id_fkey
      FOREIGN KEY (quote_option_id)
      REFERENCES public.quotation_version_options(id)
      ON DELETE CASCADE;

    -- 4. Notify PostgREST to reload schema cache (happens automatically on DDL, but good to be explicit in intent)
    NOTIFY pgrst, 'reload config';

END $$;
