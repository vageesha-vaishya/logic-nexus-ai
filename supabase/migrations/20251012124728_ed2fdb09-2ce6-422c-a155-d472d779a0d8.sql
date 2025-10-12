-- Create quotation_packages table
CREATE TABLE IF NOT EXISTS public.quotation_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  package_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  length_cm NUMERIC,
  width_cm NUMERIC,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  volume_cbm NUMERIC,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotation_packages ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_quotation_packages_quote_id ON public.quotation_packages(quote_id);
CREATE INDEX idx_quotation_packages_tenant_id ON public.quotation_packages(tenant_id);

-- RLS Policies
CREATE POLICY "Platform admins can manage all quotation packages"
  ON public.quotation_packages
  FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant quotation packages"
  ON public.quotation_packages
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Users can view franchise quotation packages"
  ON public.quotation_packages
  FOR SELECT
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can create quotation packages"
  ON public.quotation_packages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can update quotation packages"
  ON public.quotation_packages
  FOR UPDATE
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_quotation_packages_updated_at
  BEFORE UPDATE ON public.quotation_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.quotation_packages TO authenticated;
GRANT ALL ON public.quotation_packages TO service_role;