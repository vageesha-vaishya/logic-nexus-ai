-- Landed Cost Engine Schema
-- Implements 'duty_rates' and 'tax_definitions' to address the Critical Gap identified in Competitive Analysis.

-- 1. Duty Rates Table
CREATE TABLE IF NOT EXISTS public.duty_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('US', 'EU', 'CN', 'UK')), -- Expandable
    hs_code TEXT NOT NULL, -- The HS Code this applies to (can be 6, 8, 10 digits)
    rate_type TEXT NOT NULL CHECK (rate_type IN ('ad_valorem', 'specific', 'compound', 'free')),
    
    -- Ad Valorem: Percentage (e.g., 0.05 for 5%)
    ad_valorem_rate NUMERIC(10, 6),
    
    -- Specific: Amount per unit (e.g., $0.50 per kg)
    specific_amount NUMERIC(10, 2),
    specific_currency TEXT DEFAULT 'USD',
    specific_unit TEXT, -- e.g., 'kg', 'liter', 'item'
    
    -- Metadata
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    source TEXT, -- e.g., 'USITC', 'TARIC', 'China Customs'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by code and jurisdiction
-- CREATE INDEX idx_duty_rates_lookup ON public.duty_rates (jurisdiction, hs_code);
-- CREATE INDEX idx_duty_rates_effective ON public.duty_rates (effective_date, end_date);

-- 2. Tax & Fee Definitions (MPF, HMF, VAT)
CREATE TABLE IF NOT EXISTS public.tax_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL, -- e.g., 'US_MPF', 'US_HMF', 'DE_VAT'
    name TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    
    calculation_method TEXT NOT NULL CHECK (calculation_method IN ('percentage', 'flat', 'complex_min_max')),
    
    percentage_rate NUMERIC(10, 6), -- e.g., 0.003464 for MPF
    flat_amount NUMERIC(10, 2),
    
    -- For Min/Max logic (common in MPF)
    min_amount NUMERIC(10, 2),
    max_amount NUMERIC(10, 2),
    
    currency TEXT DEFAULT 'USD',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE
);

-- 3. RLS Policies
ALTER TABLE public.duty_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_definitions ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated users
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.duty_rates;
CREATE POLICY "Allow read access to authenticated users" ON public.duty_rates
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.tax_definitions;
CREATE POLICY "Allow read access to authenticated users" ON public.tax_definitions
    FOR SELECT TO authenticated USING (true);

-- Write access for admins only
DROP POLICY IF EXISTS "Allow write access to admins" ON public.duty_rates;
CREATE POLICY "Allow write access to admins" ON public.duty_rates
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('platform_admin', 'tenant_admin')
        )
    );

DROP POLICY IF EXISTS "Allow write access to admins" ON public.tax_definitions;
CREATE POLICY "Allow write access to admins" ON public.tax_definitions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role IN ('platform_admin', 'tenant_admin')
        )
    );

-- 4. Audit Triggers (Reusing existing audit mechanism if available, else simple update trigger)
DROP TRIGGER IF EXISTS update_duty_rates_modtime ON public.duty_rates;
CREATE TRIGGER update_duty_rates_modtime
    BEFORE UPDATE ON public.duty_rates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seeding Basic US Fees (MPF/HMF) as per analysis
INSERT INTO public.tax_definitions (code, name, jurisdiction, calculation_method, percentage_rate, min_amount, max_amount, currency)
VALUES 
('US_MPF', 'Merchandise Processing Fee', 'US', 'complex_min_max', 0.003464, 31.67, 614.35, 'USD'),
('US_HMF', 'Harbor Maintenance Fee', 'US', 'percentage', 0.00125, NULL, NULL, 'USD')
ON CONFLICT DO NOTHING;
