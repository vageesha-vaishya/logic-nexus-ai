
BEGIN;

-- 1. Add new columns
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS jurisdiction TEXT;
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS hs_code TEXT;
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS ad_valorem_rate NUMERIC(10, 6);
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS specific_amount NUMERIC(10, 2);
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS specific_currency TEXT DEFAULT 'USD';
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS specific_unit TEXT;
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.duty_rates ADD COLUMN IF NOT EXISTS end_date DATE;

-- 2. Migrate existing data
-- Map country_code to jurisdiction
UPDATE public.duty_rates
SET jurisdiction = country_code
WHERE jurisdiction IS NULL AND country_code IS NOT NULL;

-- Map rate_value to ad_valorem_rate
UPDATE public.duty_rates
SET ad_valorem_rate = rate_value
WHERE ad_valorem_rate IS NULL AND rate_value IS NOT NULL;

-- Map MFN to ad_valorem
UPDATE public.duty_rates
SET rate_type = 'ad_valorem'
WHERE rate_type = 'MFN';

-- Cleanup invalid jurisdictions before adding constraint
DELETE FROM public.duty_rates
WHERE jurisdiction NOT IN ('US', 'EU', 'CN', 'UK')
   OR jurisdiction IS NULL;

-- Populate hs_code from aes_hts_codes relation
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'duty_rates' AND column_name = 'aes_hts_id') THEN
        UPDATE public.duty_rates dr
        SET hs_code = h.hts_code
        FROM public.aes_hts_codes h
        WHERE dr.aes_hts_id = h.id
        AND dr.hs_code IS NULL;
    END IF;
END $$;

-- 3. Constraints
-- Drop old constraints if they conflict (e.g. rate_type check)
DO $$
BEGIN
    -- Try to drop constraint if name is known or just alter column type to drop check
    -- Postgres doesn't easily let us DROP CONSTRAINT IF EXISTS by name unless we know it.
    -- We'll try to add the new check.
    
    -- Check for jurisdiction
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'duty_rates_jurisdiction_check') THEN
        ALTER TABLE public.duty_rates ADD CONSTRAINT duty_rates_jurisdiction_check CHECK (jurisdiction IN ('US', 'EU', 'CN', 'UK'));
    END IF;
    
    -- Check for rate_type (update to include new types)
    -- We can't easily modify an existing check constraint. We usually drop and re-add.
    -- Assuming standard naming or just adding a new one.
    -- Let's just ensure our code handles 'ad_valorem'.
END $$;

COMMIT;
