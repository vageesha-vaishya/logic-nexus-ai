-- Service Type ↔ Service mapping table with tenant scoping and RLS
BEGIN;

-- Create mapping table
CREATE TABLE IF NOT EXISTS public.service_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Align service_type values with existing services constraint
ALTER TABLE public.service_type_mappings DROP CONSTRAINT IF EXISTS service_type_mappings_type_check;
ALTER TABLE public.service_type_mappings
  ADD CONSTRAINT service_type_mappings_type_check
  CHECK (service_type IN ('ocean','air','trucking','courier','moving','railway_transport'));

-- Dedup constraints
ALTER TABLE public.service_type_mappings
  ADD CONSTRAINT service_type_mappings_unique_pair UNIQUE (tenant_id, service_type, service_id);

-- Only one default per tenant + service_type
CREATE UNIQUE INDEX IF NOT EXISTS uniq_default_per_type_tenant
  ON public.service_type_mappings(tenant_id, service_type)
  WHERE is_default = true;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_stm_tenant ON public.service_type_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stm_tenant_type ON public.service_type_mappings(tenant_id, service_type);
CREATE INDEX IF NOT EXISTS idx_stm_active ON public.service_type_mappings(is_active);

-- Enable RLS
ALTER TABLE public.service_type_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Platform admins can manage all service type mappings" ON public.service_type_mappings;
CREATE POLICY "Platform admins can manage all service type mappings"
ON public.service_type_mappings
FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()))
WITH CHECK (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage own service type mappings" ON public.service_type_mappings;
CREATE POLICY "Tenant admins can manage own service type mappings"
ON public.service_type_mappings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant service type mappings" ON public.service_type_mappings;
CREATE POLICY "Users can view tenant service type mappings"
ON public.service_type_mappings
FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_service_type_mappings_updated_at ON public.service_type_mappings;
CREATE TRIGGER update_service_type_mappings_updated_at
  BEFORE UPDATE ON public.service_type_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;