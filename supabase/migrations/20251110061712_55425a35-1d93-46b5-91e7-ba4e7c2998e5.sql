-- Enable RLS and add policies for aes_hts_codes table

-- Enable Row Level Security
ALTER TABLE public.aes_hts_codes ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all HTS codes
CREATE POLICY "Platform admins can manage all HTS codes"
ON public.aes_hts_codes
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

-- All authenticated users can view HTS codes (read-only for most users)
CREATE POLICY "Authenticated users can view HTS codes"
ON public.aes_hts_codes
FOR SELECT
TO authenticated
USING (true);