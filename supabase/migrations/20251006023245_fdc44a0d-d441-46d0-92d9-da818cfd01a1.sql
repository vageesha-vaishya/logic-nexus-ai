-- Create carriers database
CREATE TABLE IF NOT EXISTS public.carriers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  carrier_name TEXT NOT NULL,
  carrier_code TEXT,
  carrier_type TEXT CHECK (carrier_type IN ('ocean', 'air', 'trucking', 'courier', 'rail')),
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB DEFAULT '{}',
  website TEXT,
  service_routes JSONB DEFAULT '[]',
  rating NUMERIC(3,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create consignees database
CREATE TABLE IF NOT EXISTS public.consignees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address JSONB DEFAULT '{}',
  tax_id TEXT,
  customs_id TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create ports and locations database
CREATE TABLE IF NOT EXISTS public.ports_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  location_name TEXT NOT NULL,
  location_code TEXT,
  location_type TEXT CHECK (location_type IN ('seaport', 'airport', 'inland_port', 'warehouse', 'terminal')),
  country TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  coordinates JSONB DEFAULT '{}',
  facilities JSONB DEFAULT '[]',
  operating_hours TEXT,
  customs_available BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add references to quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contact_id UUID,
  ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES public.carriers(id),
  ADD COLUMN IF NOT EXISTS consignee_id UUID REFERENCES public.consignees(id),
  ADD COLUMN IF NOT EXISTS origin_port_id UUID REFERENCES public.ports_locations(id),
  ADD COLUMN IF NOT EXISTS destination_port_id UUID REFERENCES public.ports_locations(id);

-- Enable RLS
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ports_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for carriers
CREATE POLICY "Platform admins can manage all carriers"
  ON public.carriers FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage carriers"
  ON public.carriers FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant carriers"
  ON public.carriers FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for consignees
CREATE POLICY "Platform admins can manage all consignees"
  ON public.consignees FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage consignees"
  ON public.consignees FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant consignees"
  ON public.consignees FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for ports_locations
CREATE POLICY "Platform admins can manage all ports"
  ON public.ports_locations FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage ports"
  ON public.ports_locations FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant ports"
  ON public.ports_locations FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carriers_tenant ON public.carriers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_consignees_tenant ON public.consignees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ports_tenant ON public.ports_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_carrier ON public.quotes(carrier_id);
CREATE INDEX IF NOT EXISTS idx_quotes_consignee ON public.quotes(consignee_id);
CREATE INDEX IF NOT EXISTS idx_quotes_origin_port ON public.quotes(origin_port_id);
CREATE INDEX IF NOT EXISTS idx_quotes_destination_port ON public.quotes(destination_port_id);