-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  quote_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  opportunity_id UUID,
  account_id UUID,
  contact_id UUID,
  owner_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  subtotal NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  shipping_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  terms_conditions TEXT,
  notes TEXT,
  billing_address JSONB DEFAULT '{}'::jsonb,
  shipping_address JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE
);

-- Create quote_items table
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_quotes_tenant_id ON public.quotes(tenant_id);
CREATE INDEX idx_quotes_franchise_id ON public.quotes(franchise_id);
CREATE INDEX idx_quotes_account_id ON public.quotes(account_id);
CREATE INDEX idx_quotes_opportunity_id ON public.quotes(opportunity_id);
CREATE INDEX idx_quotes_quote_number ON public.quotes(quote_number);
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotes
CREATE POLICY "Platform admins can manage all quotes"
  ON public.quotes FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant quotes"
  ON public.quotes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can manage franchise quotes"
  ON public.quotes FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can view franchise quotes"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can create franchise quotes"
  ON public.quotes FOR INSERT
  TO authenticated
  WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for quote_items
CREATE POLICY "Platform admins can manage all quote items"
  ON public.quote_items FOR ALL
  TO authenticated
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can manage items for accessible quotes"
  ON public.quote_items FOR ALL
  TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM public.quotes
      WHERE franchise_id = get_user_franchise_id(auth.uid())
        OR owner_id = auth.uid()
    )
  );

-- Update trigger
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();