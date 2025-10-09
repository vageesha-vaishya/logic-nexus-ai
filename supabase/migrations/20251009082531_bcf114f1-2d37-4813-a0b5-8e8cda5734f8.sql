-- Add foreign key constraints for quotes table relationships
-- This enables proper joins between quotes and related tables

-- Add foreign key for opportunity_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_opportunity_id_fkey' 
    AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_opportunity_id_fkey
    FOREIGN KEY (opportunity_id)
    REFERENCES public.opportunities(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for account_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_account_id_fkey' 
    AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES public.accounts(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key for contact_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'quotes_contact_id_fkey' 
    AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_contact_id_fkey
    FOREIGN KEY (contact_id)
    REFERENCES public.contacts(id)
    ON DELETE SET NULL;
  END IF;
END $$;