-- Enable RLS and add policies for aes_hts_codes table

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'aes_hts_codes'
  ) THEN
    ALTER TABLE public.aes_hts_codes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Platform admins can manage all HTS codes" ON public.aes_hts_codes;
    CREATE POLICY "Platform admins can manage all HTS codes"
    ON public.aes_hts_codes
    FOR ALL
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

    DROP POLICY IF EXISTS "Authenticated users can view HTS codes" ON public.aes_hts_codes;
    CREATE POLICY "Authenticated users can view HTS codes"
    ON public.aes_hts_codes
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
