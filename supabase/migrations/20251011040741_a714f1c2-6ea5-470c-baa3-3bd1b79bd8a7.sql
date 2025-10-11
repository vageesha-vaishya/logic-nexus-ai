-- Carrier ↔ Service Type mapping table with tenant scoping and codes
BEGIN;

-- First, add missing columns to carriers table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'mode') THEN
    ALTER TABLE public.carriers ADD COLUMN mode TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'scac') THEN
    ALTER TABLE public.carriers ADD COLUMN scac TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'iata') THEN
    ALTER TABLE public.carriers ADD COLUMN iata TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carriers' AND column_name = 'mc_dot') THEN
    ALTER TABLE public.carriers ADD COLUMN mc_dot TEXT;
  END IF;
END $$;

-- Create mapping table
CREATE TABLE IF NOT EXISTS public.carrier_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_id UUID NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  code_type TEXT,
  code_value TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allowed service_type values
ALTER TABLE public.carrier_service_types DROP CONSTRAINT IF EXISTS carrier_service_types_type_check;
ALTER TABLE public.carrier_service_types
  ADD CONSTRAINT carrier_service_types_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

-- Dedup per tenant + carrier + service_type
ALTER TABLE public.carrier_service_types DROP CONSTRAINT IF EXISTS carrier_service_types_unique_pair;
ALTER TABLE public.carrier_service_types
  ADD CONSTRAINT carrier_service_types_unique_pair UNIQUE (tenant_id, carrier_id, service_type);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cst_tenant ON public.carrier_service_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cst_tenant_type ON public.carrier_service_types(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_cst_active ON public.carrier_service_types(is_active);

-- Enable RLS
ALTER TABLE public.carrier_service_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Platform admins can manage all carrier type mappings"
ON public.carrier_service_types FOR ALL TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage own carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Tenant admins can manage own carrier type mappings"
ON public.carrier_service_types FOR ALL TO authenticated
USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Users can view tenant carrier type mappings"
ON public.carrier_service_types FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_carrier_service_types_updated_at ON public.carrier_service_types;
CREATE TRIGGER update_carrier_service_types_updated_at
  BEFORE UPDATE ON public.carrier_service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;