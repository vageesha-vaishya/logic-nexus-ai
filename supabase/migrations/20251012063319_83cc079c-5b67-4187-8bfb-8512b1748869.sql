-- Create quotation_versions table for tracking quote versions
CREATE TABLE IF NOT EXISTS public.quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  major INTEGER NOT NULL DEFAULT 1,
  minor INTEGER NOT NULL DEFAULT 0,
  change_reason TEXT,
  valid_until DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quotation_version_options table for carrier rate options per version
CREATE TABLE IF NOT EXISTS public.quotation_version_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quotation_version_id UUID NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  carrier_rate_id UUID NOT NULL,
  recommended BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create customer_selections table for tracking which option customer chose
CREATE TABLE IF NOT EXISTS public.customer_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quotation_version_id UUID NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  quotation_version_option_id UUID NOT NULL REFERENCES public.quotation_version_options(id) ON DELETE CASCADE,
  reason TEXT,
  selected_by UUID,
  selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_version_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quotation_versions
CREATE POLICY "Users can view franchise quote versions"
  ON public.quotation_versions FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can create quote versions"
  ON public.quotation_versions FOR INSERT
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Platform admins full access to quote versions"
  ON public.quotation_versions FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for quotation_version_options
CREATE POLICY "Users can view franchise version options"
  ON public.quotation_version_options FOR SELECT
  USING (
    quotation_version_id IN (
      SELECT qv.id FROM public.quotation_versions qv
      JOIN public.quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can create version options"
  ON public.quotation_version_options FOR INSERT
  WITH CHECK (
    quotation_version_id IN (
      SELECT qv.id FROM public.quotation_versions qv
      JOIN public.quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Platform admins full access to version options"
  ON public.quotation_version_options FOR ALL
  USING (is_platform_admin(auth.uid()));

-- RLS Policies for customer_selections
CREATE POLICY "Users can view franchise customer selections"
  ON public.customer_selections FOR SELECT
  USING (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can create customer selections"
  ON public.customer_selections FOR INSERT
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.quotes 
      WHERE franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Platform admins full access to customer selections"
  ON public.customer_selections FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Create function for recording customer selection
CREATE OR REPLACE FUNCTION public.record_customer_selection(
  p_tenant_id UUID,
  p_quote_id UUID,
  p_version_id UUID,
  p_option_id UUID,
  p_reason TEXT,
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_selections (
    tenant_id,
    quote_id,
    quotation_version_id,
    quotation_version_option_id,
    reason,
    selected_by
  ) VALUES (
    p_tenant_id,
    p_quote_id,
    p_version_id,
    p_option_id,
    p_reason,
    p_user_id
  );
END;
$$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quotation_versions_quote_id ON public.quotation_versions(quote_id);
CREATE INDEX IF NOT EXISTS idx_quotation_version_options_version_id ON public.quotation_version_options(quotation_version_id);
CREATE INDEX IF NOT EXISTS idx_customer_selections_quote_id ON public.customer_selections(quote_id);