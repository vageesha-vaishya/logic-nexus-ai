-- Consolidated safe migration replacing disabled migrations for quotes and quote_items

DO $do$
BEGIN
  -- Ensure quotes.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotes 
      ADD COLUMN service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- If legacy quotes.mode exists, migrate values using dynamic SQL to avoid parse errors
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'mode'
  ) THEN
    -- Populate service_type_id from quotes."mode" via subquery to avoid aggregate MODE() confusion
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = (quotes."mode")::text
        LIMIT 1
      )
      WHERE quotes."mode" IS NOT NULL
        AND service_type_id IS NULL';

    -- Drop legacy column
    EXECUTE 'ALTER TABLE public.quotes DROP COLUMN "mode"';
  END IF;

  -- Optional: if a text column quotes.service_type exists, migrate from that too
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quotes' 
      AND column_name = 'service_type'
  ) THEN
    EXECUTE 'UPDATE public.quotes
      SET service_type_id = (
        SELECT st.id 
        FROM public.service_types st 
        WHERE st.name = quotes.service_type::text
        LIMIT 1
      )
      WHERE quotes.service_type IS NOT NULL
        AND service_type_id IS NULL';
    -- Do not drop quotes.service_type automatically; it may be used elsewhere
  END IF;

  -- Ensure quote_items.service_type_id exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quote_items 
      ADD COLUMN service_type_id uuid REFERENCES public.service_types(id);
  END IF;

  -- Populate quote_items.service_type_id from parent quotes.service_type_id when missing
  UPDATE public.quote_items qi
  SET service_type_id = q.service_type_id
  FROM public.quotes q
  WHERE qi.quote_id = q.id
    AND qi.service_type_id IS NULL;

  -- If legacy quote_items.mode exists, drop it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'quote_items' 
      AND column_name = 'mode'
  ) THEN
    EXECUTE 'ALTER TABLE public.quote_items DROP COLUMN mode';
  END IF;
END
$do$ LANGUAGE plpgsql;