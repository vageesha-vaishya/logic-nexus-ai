-- Cargo Details module: table, indexes, RLS policies, triggers
BEGIN;

-- Create cargo_details table
CREATE TABLE IF NOT EXISTS public.cargo_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  cargo_type_id UUID REFERENCES public.cargo_types(id) ON DELETE SET NULL,
  commodity_description TEXT,
  hs_code TEXT,
  package_count INTEGER DEFAULT 0,
  total_weight_kg NUMERIC(12,3),
  total_volume_cbm NUMERIC(12,3),
  dimensions JSONB DEFAULT '{}'::jsonb, -- optional per-package dims {length_cm,width_cm,height_cm}
  hazmat BOOLEAN DEFAULT false,
  hazmat_class TEXT,
  temperature_controlled BOOLEAN DEFAULT false,
  requires_special_handling BOOLEAN DEFAULT false,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Align allowed service_type values (kept flexible; constrain to known set if present)
ALTER TABLE public.cargo_details DROP CONSTRAINT IF EXISTS cargo_details_service_type_check;
ALTER TABLE public.cargo_details
  ADD CONSTRAINT cargo_details_service_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_cargo_details_tenant ON public.cargo_details(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cargo_details_service ON public.cargo_details(service_id);
CREATE INDEX IF NOT EXISTS idx_cargo_details_type ON public.cargo_details(service_type);
CREATE INDEX IF NOT EXISTS idx_cargo_details_active ON public.cargo_details(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.cargo_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins manage all cargo details" ON public.cargo_details;
CREATE POLICY "Platform admins manage all cargo details"
ON public.cargo_details
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins manage own cargo details" ON public.cargo_details;
CREATE POLICY "Tenant admins manage own cargo details"
ON public.cargo_details
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant cargo details" ON public.cargo_details;
CREATE POLICY "Users can view tenant cargo details"
ON public.cargo_details
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_cargo_details_updated_at ON public.cargo_details;
CREATE TRIGGER update_cargo_details_updated_at
  BEFORE UPDATE ON public.cargo_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;