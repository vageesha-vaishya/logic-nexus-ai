-- Rename table quote_versions to quotation_versions if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quote_versions'
  ) THEN
    ALTER TABLE public.quote_versions RENAME TO quotation_versions;
  END IF;
END $$;