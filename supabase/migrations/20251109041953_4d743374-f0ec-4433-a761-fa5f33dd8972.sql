-- Create container_types table
CREATE TABLE IF NOT EXISTS public.container_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create container_sizes table
CREATE TABLE IF NOT EXISTS public.container_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  length_ft NUMERIC,
  width_ft NUMERIC,
  height_ft NUMERIC,
  max_weight_kg NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create quote_charges table for quotation composer
CREATE TABLE IF NOT EXISTS public.quote_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_option_id UUID NOT NULL REFERENCES public.quotation_version_options(id) ON DELETE CASCADE,
  leg_id UUID REFERENCES public.quotation_version_option_legs(id) ON DELETE CASCADE,
  charge_side_id UUID,
  category_id UUID,
  basis_id UUID,
  quantity NUMERIC DEFAULT 1,
  unit TEXT,
  rate NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  currency_id UUID,
  note TEXT,
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on container_types
ALTER TABLE public.container_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view container types"
  ON public.container_types FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage container types"
  ON public.container_types FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Platform admins can manage all container types"
  ON public.container_types FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Enable RLS on container_sizes
ALTER TABLE public.container_sizes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view container sizes"
  ON public.container_sizes FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage container sizes"
  ON public.container_sizes FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Platform admins can manage all container sizes"
  ON public.container_sizes FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Enable RLS on quote_charges
ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view franchise quote charges"
  ON public.quote_charges FOR SELECT
  USING (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can create franchise quote charges"
  ON public.quote_charges FOR INSERT
  WITH CHECK (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Tenant admins can manage tenant quote charges"
  ON public.quote_charges FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Platform admins can manage all quote charges"
  ON public.quote_charges FOR ALL
  USING (is_platform_admin(auth.uid()));