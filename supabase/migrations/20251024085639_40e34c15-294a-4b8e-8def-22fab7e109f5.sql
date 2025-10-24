-- Fix the mode column migration issue
-- This migration properly handles the "mode" column if it still exists

DO $$
BEGIN
  -- Check if mode column exists in quotes table and migrate data
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'quotes' 
    AND column_name = 'mode'
  ) THEN
    -- Ensure service_type_id column exists
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type_id'
    ) THEN
      ALTER TABLE public.quotes ADD COLUMN service_type_id uuid;
    END IF;

    -- Migrate data from mode column using a subquery approach to avoid parser confusion
    UPDATE public.quotes
    SET service_type_id = (
      SELECT st.id 
      FROM public.service_types st 
      WHERE st.name = quotes.mode::text
      LIMIT 1
    )
    WHERE mode IS NOT NULL;

    -- Drop the mode column
    ALTER TABLE public.quotes DROP COLUMN mode;
  END IF;

  -- Check if mode column exists in quote_items table
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'quote_items' 
    AND column_name = 'mode'
  ) THEN
    -- Drop the mode column from quote_items
    ALTER TABLE public.quote_items DROP COLUMN mode;
  END IF;
END $$;