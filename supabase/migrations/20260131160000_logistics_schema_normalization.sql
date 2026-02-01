-- Migration: Logistics Schema Normalization and Enhancement
-- Description: Normalizes cargo details, integrates AES HTS codes, adds package types, and formalizes service type mappings.
-- Date: 2026-01-31

BEGIN;

--------------------------------------------------------------------------------
-- 1. Package Types Master Data
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.package_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_length_cm NUMERIC,
  default_width_cm NUMERIC,
  default_height_cm NUMERIC,
  default_weight_kg NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Seed Standard Package Types (Global - tenant_id NULL)
INSERT INTO public.package_types (code, name, description, default_length_cm, default_width_cm, default_height_cm)
VALUES
  ('PLT_STD', 'Standard Pallet', 'Standard 48x40 pallet', 120, 100, 15),
  ('PLT_EUR', 'Euro Pallet', 'European standard pallet', 120, 80, 15),
  ('BOX_SM', 'Small Box', 'Small shipping carton', 30, 30, 30),
  ('BOX_MD', 'Medium Box', 'Medium shipping carton', 50, 50, 50),
  ('BOX_LG', 'Large Box', 'Large shipping carton', 80, 80, 80),
  ('CRATE', 'Wooden Crate', 'Secure wooden crate', NULL, NULL, NULL),
  ('DRUM', 'Drum', '55-gallon drum', 60, 60, 90)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- RLS for Package Types
ALTER TABLE public.package_types ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    DROP POLICY IF EXISTS "Read package types" ON public.package_types;
    DROP POLICY IF EXISTS "Manage package types" ON public.package_types;
END $$;
CREATE POLICY "Read package types" ON public.package_types FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Manage package types" ON public.package_types FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));


--------------------------------------------------------------------------------
-- 2. Service Type Mappings
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  carrier_id UUID REFERENCES public.carriers(id) ON DELETE CASCADE,
  mapping_context TEXT NOT NULL CHECK (mapping_context IN ('SCAC', 'IATA', 'EDI', 'INTERNAL', 'API')),
  external_code TEXT NOT NULL,
  external_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, carrier_id, mapping_context, external_code)
);

-- RLS for Service Type Mappings
ALTER TABLE public.service_type_mappings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    DROP POLICY IF EXISTS "Read service mappings" ON public.service_type_mappings;
    DROP POLICY IF EXISTS "Manage service mappings" ON public.service_type_mappings;
END $$;
CREATE POLICY "Read service mappings" ON public.service_type_mappings FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Manage service mappings" ON public.service_type_mappings FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));


--------------------------------------------------------------------------------
-- 3. Enhance Services Table (Link to Service Types)
--------------------------------------------------------------------------------
-- Ensure service_type_id exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'service_type_id') THEN
        ALTER TABLE public.services ADD COLUMN service_type_id UUID REFERENCES public.service_types(id);
    END IF;
END $$;

-- Migrate existing text service_types to FKs
UPDATE public.services s
SET service_type_id = st.id
FROM public.service_types st
WHERE s.service_type_id IS NULL 
  AND lower(s.service_type) = lower(st.name);


--------------------------------------------------------------------------------
-- 4. Refactor Cargo Details (Normalization)
--------------------------------------------------------------------------------
-- Add foreign keys and relax constraints
ALTER TABLE public.cargo_details
  ADD COLUMN IF NOT EXISTS aes_hts_id UUID REFERENCES public.aes_hts_codes(id),
  ADD COLUMN IF NOT EXISTS quotation_version_id UUID REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS package_type_id UUID REFERENCES public.package_types(id),
  ALTER COLUMN service_id DROP NOT NULL,
  ALTER COLUMN service_type DROP NOT NULL;

-- Create Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_cargo_details_quotation_version ON public.cargo_details(quotation_version_id);
CREATE INDEX IF NOT EXISTS idx_cargo_details_aes_hts ON public.cargo_details(aes_hts_id);

-- Trigger to validate AES HTS if provided
CREATE OR REPLACE FUNCTION validate_cargo_aes_hts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.aes_hts_id IS NOT NULL AND NEW.hs_code IS NULL THEN
    SELECT hts_code INTO NEW.hs_code FROM public.aes_hts_codes WHERE id = NEW.aes_hts_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_cargo_aes_hts ON public.cargo_details;
CREATE TRIGGER trg_validate_cargo_aes_hts
  BEFORE INSERT OR UPDATE ON public.cargo_details
  FOR EACH ROW
  EXECUTE FUNCTION validate_cargo_aes_hts();

COMMIT;
