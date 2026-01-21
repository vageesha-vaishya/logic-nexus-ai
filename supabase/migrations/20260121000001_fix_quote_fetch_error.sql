-- Fix "FAILED TO FETCH QUOTE ERROR" by ensuring quotes table has correct columns and foreign keys
-- Specifically targeting account_id (vs customer_id), missing franchise_id FK, and service_type_id

DO $$
BEGIN

  -- 1. Handle account_id / customer_id discrepancy
  -- If customer_id exists but account_id does not, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'customer_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.quotes RENAME COLUMN customer_id TO account_id;
  END IF;

  -- If account_id still doesn't exist (neither did customer_id), add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;

  -- 2. Ensure account_id has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'account_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
      ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_account_id_fkey
      FOREIGN KEY (account_id)
      REFERENCES public.accounts(id)
      ON DELETE SET NULL;
  END IF;

  -- 3. Ensure franchise_id has Foreign Key constraint
  -- This is likely the cause of "franchises:franchise_id(name)" failure if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'franchise_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_franchise_id_fkey
    FOREIGN KEY (franchise_id)
    REFERENCES public.franchises(id)
    ON DELETE SET NULL;
  END IF;

  -- 4. Ensure service_type_id exists and has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN service_type_id UUID REFERENCES public.service_types(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'service_type_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_service_type_id_fkey
    FOREIGN KEY (service_type_id)
    REFERENCES public.service_types(id)
    ON DELETE SET NULL;
  END IF;

  -- 5. Ensure opportunity_id has Foreign Key constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
    WHERE kcu.table_name = 'quotes' AND kcu.column_name = 'opportunity_id' AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.quotes
    ADD CONSTRAINT quotes_opportunity_id_fkey
    FOREIGN KEY (opportunity_id)
    REFERENCES public.opportunities(id)
    ON DELETE SET NULL;
  END IF;

END $$;
