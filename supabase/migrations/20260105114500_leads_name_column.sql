DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN name TEXT;
    UPDATE public.leads 
      SET name = CONCAT_WS(' ', first_name, last_name)
      WHERE name IS NULL;
  END IF;
END $$;
