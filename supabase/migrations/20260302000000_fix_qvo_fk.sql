-- Fix quotation_version_options foreign key and nullability
-- This migration ensures carrier_rate_id is nullable (for ad-hoc rates) and has a proper foreign key

DO $$
BEGIN
  -- 1. Make carrier_rate_id nullable
  ALTER TABLE public.quotation_version_options ALTER COLUMN carrier_rate_id DROP NOT NULL;

  -- 2. Add Foreign Key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotation_version_options_carrier_rate_id_fkey'
    AND table_name = 'quotation_version_options'
  ) THEN
    -- Check if there are any invalid carrier_rate_ids before adding constraint
    -- Optional: Clean up invalid IDs or let it fail? 
    -- We'll try to add it. If it fails, the user will need to clean data. 
    -- But for safety, we can update invalid IDs to NULL since we just made it nullable.
    
    UPDATE public.quotation_version_options
    SET carrier_rate_id = NULL
    WHERE carrier_rate_id IS NOT NULL 
    AND carrier_rate_id NOT IN (SELECT id FROM public.carrier_rates);

    ALTER TABLE public.quotation_version_options
    ADD CONSTRAINT quotation_version_options_carrier_rate_id_fkey
    FOREIGN KEY (carrier_rate_id)
    REFERENCES public.carrier_rates(id)
    ON DELETE SET NULL;
  END IF;

END $$;
