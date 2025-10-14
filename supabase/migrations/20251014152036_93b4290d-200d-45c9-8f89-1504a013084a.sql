-- Step 1: Add service_type_id column to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);

-- Step 2: Update quotes with matching service types
UPDATE public.quotes q
SET service_type_id = st.id
FROM public.service_types st
WHERE st.name = q.service_type;

-- Step 3: Drop service_type text column from quotes
ALTER TABLE public.quotes
DROP COLUMN IF EXISTS service_type;

-- Step 4: Check if quote_items table has mode or service_type column
DO $$
BEGIN
  -- Add service_type_id column to quote_items if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quote_items') THEN
    -- Add the new column
    ALTER TABLE public.quote_items
    ADD COLUMN IF NOT EXISTS service_type_id UUID REFERENCES public.service_types(id);
    
    -- Update quote_items with service_type_id from quotes
    UPDATE public.quote_items qi
    SET service_type_id = q.service_type_id
    FROM public.quotes q
    WHERE qi.quote_id = q.id;
    
    -- Drop old columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'mode') THEN
      ALTER TABLE public.quote_items DROP COLUMN mode;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quote_items' AND column_name = 'service_type') THEN
      ALTER TABLE public.quote_items DROP COLUMN service_type;
    END IF;
  END IF;
END $$;