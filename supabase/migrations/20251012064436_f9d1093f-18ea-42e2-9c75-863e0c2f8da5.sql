-- Create cargo_details table for storing detailed cargo information
CREATE TABLE IF NOT EXISTS public.cargo_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  service_type TEXT,
  service_id UUID,
  cargo_type_id UUID,
  commodity_description TEXT,
  hs_code TEXT,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  dimensions_cm JSONB,
  value_amount NUMERIC,
  value_currency TEXT DEFAULT 'USD',
  special_requirements TEXT,
  is_hazardous BOOLEAN DEFAULT FALSE,
  hazmat_un_number TEXT,
  hazmat_class TEXT,
  temperature_controlled BOOLEAN DEFAULT FALSE,
  temperature_range JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.cargo_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cargo_details
CREATE POLICY "Platform admins can manage all cargo details"
  ON public.cargo_details FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage cargo details"
  ON public.cargo_details FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can view tenant cargo details"
  ON public.cargo_details FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can create cargo details"
  ON public.cargo_details FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- Grant permissions
GRANT ALL ON public.cargo_details TO authenticated;
GRANT ALL ON public.cargo_details TO service_role;

-- Create index
CREATE INDEX IF NOT EXISTS idx_cargo_details_tenant ON public.cargo_details(tenant_id);