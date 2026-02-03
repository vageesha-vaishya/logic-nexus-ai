-- WCO Global HS Transition (Phase 3)
-- Create global_hs_roots table and link aes_hts_codes

-- 1. Create global_hs_roots table
CREATE TABLE IF NOT EXISTS public.global_hs_roots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hs6_code TEXT NOT NULL UNIQUE,
    description TEXT,
    chapter TEXT GENERATED ALWAYS AS (substring(hs6_code, 1, 2)) STORED,
    heading TEXT GENERATED ALWAYS AS (substring(hs6_code, 1, 4)) STORED,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.global_hs_roots ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
DROP POLICY IF EXISTS "Authenticated users can view global_hs_roots" ON public.global_hs_roots;
CREATE POLICY "Authenticated users can view global_hs_roots"
    ON public.global_hs_roots
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage global_hs_roots" ON public.global_hs_roots;
CREATE POLICY "Admins can manage global_hs_roots"
    ON public.global_hs_roots
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role::text IN ('admin', 'super_admin', 'platform_admin')
        )
    );

-- 4. Seed Data from aes_hts_codes
-- We extract unique subheadings (6-digit) and use the most frequent or max description as a starting point
INSERT INTO public.global_hs_roots (hs6_code, description)
SELECT DISTINCT 
    subheading,
    -- We'll just take the first description we find for now. 
    -- In a real scenario, we might want a cleaner WCO description source.
    (SELECT description FROM public.aes_hts_codes c2 WHERE c2.subheading = c1.subheading LIMIT 1) as description
FROM public.aes_hts_codes c1
WHERE subheading IS NOT NULL AND length(subheading) = 6
ON CONFLICT (hs6_code) DO NOTHING;

-- 5. Add Foreign Key to aes_hts_codes
ALTER TABLE public.aes_hts_codes 
ADD COLUMN IF NOT EXISTS global_hs_root_id UUID REFERENCES public.global_hs_roots(id);

-- 6. Link aes_hts_codes to global_hs_roots
UPDATE public.aes_hts_codes
SET global_hs_root_id = g.id
FROM public.global_hs_roots g
WHERE aes_hts_codes.subheading = g.hs6_code
AND aes_hts_codes.global_hs_root_id IS NULL;

-- 7. Add Index for performance
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_global_hs_root_id ON public.aes_hts_codes(global_hs_root_id);
CREATE INDEX IF NOT EXISTS idx_global_hs_roots_hs6_code ON public.global_hs_roots(hs6_code);
