-- Create service_types table
CREATE TABLE IF NOT EXISTS public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create service_type_mappings table
CREATE TABLE IF NOT EXISTS public.service_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type TEXT NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  conditions JSONB DEFAULT '{}'::jsonb,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_type_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_types (platform admin only)
CREATE POLICY "Platform admins can manage all service types"
  ON public.service_types
  FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "All users can view service types"
  ON public.service_types
  FOR SELECT
  USING (true);

-- RLS Policies for service_type_mappings
CREATE POLICY "Platform admins can manage all mappings"
  ON public.service_type_mappings
  FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant mappings"
  ON public.service_type_mappings
  FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can view tenant mappings"
  ON public.service_type_mappings
  FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_type_mappings_service_id 
  ON public.service_type_mappings(service_id);
  
CREATE INDEX IF NOT EXISTS idx_service_type_mappings_tenant_id 
  ON public.service_type_mappings(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_service_types_updated_at
  BEFORE UPDATE ON public.service_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_type_mappings_updated_at
  BEFORE UPDATE ON public.service_type_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();