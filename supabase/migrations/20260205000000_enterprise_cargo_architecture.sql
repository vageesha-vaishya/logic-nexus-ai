-- Enterprise Cargo & Commodity Architecture
-- Date: 2026-02-02
-- Description: Implements advanced commodity management, duty rates, compliance tracking, and HTS search optimization.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Enhanced HTS Codes Structure
--------------------------------------------------------------------------------
-- Add hierarchy columns for better categorization and drill-down
ALTER TABLE public.aes_hts_codes
ADD COLUMN IF NOT EXISTS chapter VARCHAR(2),
ADD COLUMN IF NOT EXISTS heading VARCHAR(4),
ADD COLUMN IF NOT EXISTS subheading VARCHAR(6),
ADD COLUMN IF NOT EXISTS tariff_item VARCHAR(8),
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to auto-populate hierarchy from hts_code
CREATE OR REPLACE FUNCTION public.parse_hts_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
  -- Assumes hts_code format like '1234.56.7890' or '1234567890'
  -- Remove dots for parsing
  DECLARE
    clean_code TEXT := regexp_replace(NEW.hts_code, '[^0-9]', '', 'g');
  BEGIN
    NEW.chapter := substring(clean_code, 1, 2);
    NEW.heading := substring(clean_code, 1, 4);
    NEW.subheading := substring(clean_code, 1, 6);
    NEW.tariff_item := substring(clean_code, 1, 8);
    
    -- Update search vector (English dictionary)
    NEW.search_vector := to_tsvector('english'::regconfig, 
      coalesce(NEW.description, '') || ' ' || 
      coalesce(NEW.hts_code, '') || ' ' || 
      coalesce(NEW.category, '')
    );
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for HTS hierarchy and search vector
DROP TRIGGER IF EXISTS trg_aes_hts_hierarchy ON public.aes_hts_codes;
CREATE TRIGGER trg_aes_hts_hierarchy
BEFORE INSERT OR UPDATE ON public.aes_hts_codes
FOR EACH ROW
EXECUTE FUNCTION public.parse_hts_hierarchy();

-- Update existing records
-- UPDATE public.aes_hts_codes SET id = id; -- Commented out to save time during dev, run manually if needed

-- GIN Index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_aes_hts_search_vector ON public.aes_hts_codes USING GIN(search_vector);
-- Indexes for hierarchy
CREATE INDEX IF NOT EXISTS idx_aes_hts_chapter ON public.aes_hts_codes(chapter);
CREATE INDEX IF NOT EXISTS idx_aes_hts_heading ON public.aes_hts_codes(heading);

--------------------------------------------------------------------------------
-- 2. Master Commodities (Tenant Product Catalog)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.master_commodities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  aes_hts_id UUID REFERENCES public.aes_hts_codes(id),
  default_cargo_type_id UUID REFERENCES public.cargo_types(id),
  unit_value NUMERIC(15, 2),
  currency TEXT DEFAULT 'USD',
  origin_country TEXT, -- ISO 2-char code
  hazmat_class TEXT,
  hazmat_un_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

-- Enable RLS
ALTER TABLE public.master_commodities ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'master_commodities' AND policyname = 'Tenant read master commodities'
  ) THEN
    CREATE POLICY "Tenant read master commodities" ON public.master_commodities
      FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'master_commodities' AND policyname = 'Tenant write master commodities'
  ) THEN
    CREATE POLICY "Tenant write master commodities" ON public.master_commodities
      FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_master_commodities_tenant_sku ON public.master_commodities(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_master_commodities_name ON public.master_commodities USING GIN (to_tsvector('english', name));

--------------------------------------------------------------------------------
-- 3. Duty Rates
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.duty_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aes_hts_id UUID NOT NULL REFERENCES public.aes_hts_codes(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL, -- Destination country ISO code
  rate_type TEXT NOT NULL DEFAULT 'MFN', -- MFN (General), FTA (Free Trade), STAT (Statutory), 301 (Punitive)
  rate_value NUMERIC(10, 5), -- Percentage (e.g., 0.05 for 5%)
  specific_rate TEXT, -- Text description like "5.5c/kg"
  currency TEXT DEFAULT 'USD',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  source TEXT, -- e.g., 'USITC', 'TARIC'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_duty_rates_hts_country ON public.duty_rates(aes_hts_id, country_code);

-- RLS (Public read, Admin write)
ALTER TABLE public.duty_rates ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'duty_rates' AND policyname = 'Public read duty rates'
  ) THEN
    CREATE POLICY "Public read duty rates" ON public.duty_rates FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'duty_rates' AND policyname = 'Admin manage duty rates'
  ) THEN
    CREATE POLICY "Admin manage duty rates" ON public.duty_rates FOR ALL USING (is_platform_admin(auth.uid()));
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 4. Compliance Screenings
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'cargo', 'shipment', 'party'
  entity_id UUID NOT NULL,
  screening_type TEXT NOT NULL, -- 'HTS_VALIDATION', 'RPS', 'LICENSE_CHECK', 'OGA'
  status TEXT NOT NULL CHECK (status IN ('PASSED', 'WARNING', 'FAILED', 'PENDING')),
  details JSONB DEFAULT '{}'::jsonb, -- Store specific errors or matches
  screened_at TIMESTAMPTZ DEFAULT now(),
  screened_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_compliance_screenings_entity ON public.compliance_screenings(entity_type, entity_id);

-- RLS
ALTER TABLE public.compliance_screenings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'compliance_screenings' AND policyname = 'Tenant read screenings'
  ) THEN
    CREATE POLICY "Tenant read screenings" ON public.compliance_screenings FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;

--------------------------------------------------------------------------------
-- 5. Advanced Search Function
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_hts_codes(text, integer);

CREATE OR REPLACE FUNCTION public.search_hts_codes(
  search_term TEXT,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  hts_code VARCHAR,
  description TEXT,
  category VARCHAR,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.hts_code,
    c.description,
    c.category,
    ts_rank(c.search_vector, websearch_to_tsquery('english'::regconfig, search_term))::REAL as rank
  FROM public.aes_hts_codes c
  WHERE c.search_vector @@ websearch_to_tsquery('english'::regconfig, search_term)
  ORDER BY rank DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;
