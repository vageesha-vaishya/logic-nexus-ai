-- Create package categories table (container types)
CREATE TABLE public.package_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category_name TEXT NOT NULL,
  category_code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create package sizes table
CREATE TABLE public.package_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  size_name TEXT NOT NULL,
  size_code TEXT,
  length_ft NUMERIC,
  width_ft NUMERIC,
  height_ft NUMERIC,
  max_weight_kg NUMERIC,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create cargo types table
CREATE TABLE public.cargo_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  cargo_type_name TEXT NOT NULL,
  cargo_code TEXT,
  requires_special_handling BOOLEAN DEFAULT false,
  hazmat_class TEXT,
  temperature_controlled BOOLEAN DEFAULT false,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create incoterms table
CREATE TABLE public.incoterms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  incoterm_code TEXT NOT NULL,
  incoterm_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add pricing fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS cost_price NUMERIC,
ADD COLUMN IF NOT EXISTS sell_price NUMERIC,
ADD COLUMN IF NOT EXISTS margin_amount NUMERIC,
ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC,
ADD COLUMN IF NOT EXISTS additional_costs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS incoterm_id UUID,
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add cargo details to quote_items
ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS package_category_id UUID,
ADD COLUMN IF NOT EXISTS package_size_id UUID,
ADD COLUMN IF NOT EXISTS cargo_type_id UUID,
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC,
ADD COLUMN IF NOT EXISTS volume_cbm NUMERIC,
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Enable RLS
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargo_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoterms ENABLE ROW LEVEL SECURITY;

-- RLS Policies for package_categories
CREATE POLICY "Platform admins can manage all package categories"
ON public.package_categories FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage package categories"
ON public.package_categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant package categories"
ON public.package_categories FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for package_sizes
CREATE POLICY "Platform admins can manage all package sizes"
ON public.package_sizes FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage package sizes"
ON public.package_sizes FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant package sizes"
ON public.package_sizes FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for cargo_types
CREATE POLICY "Platform admins can manage all cargo types"
ON public.cargo_types FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage cargo types"
ON public.cargo_types FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant cargo types"
ON public.cargo_types FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for incoterms
CREATE POLICY "Platform admins can manage all incoterms"
ON public.incoterms FOR ALL
TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage incoterms"
ON public.incoterms FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant incoterms"
ON public.incoterms FOR SELECT
TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_package_categories_updated_at
BEFORE UPDATE ON public.package_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_package_sizes_updated_at
BEFORE UPDATE ON public.package_sizes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cargo_types_updated_at
BEFORE UPDATE ON public.cargo_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incoterms_updated_at
BEFORE UPDATE ON public.incoterms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();