DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'legacy_metadata'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN legacy_metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'legacy_json'
  ) THEN
    ALTER TABLE public.accounts
      ADD COLUMN legacy_json JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'legacy_json'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN legacy_json JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;
