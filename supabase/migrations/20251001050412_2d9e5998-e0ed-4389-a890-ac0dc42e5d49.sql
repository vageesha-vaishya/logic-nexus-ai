-- Create opportunity_stage enum
CREATE TYPE opportunity_stage AS ENUM (
  'prospecting',
  'qualification',
  'needs_analysis',
  'value_proposition',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost'
);

-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  franchise_id UUID,
  
  -- Basic Information
  name TEXT NOT NULL,
  description TEXT,
  stage opportunity_stage NOT NULL DEFAULT 'prospecting',
  amount NUMERIC(15, 2),
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  close_date DATE,
  
  -- Relationships
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  owner_id UUID,
  
  -- Sales Details
  lead_source lead_source,
  next_step TEXT,
  competitors TEXT,
  campaign_id UUID,
  
  -- Additional Details
  type TEXT,
  forecast_category TEXT,
  expected_revenue NUMERIC(15, 2),
  
  -- Metadata
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_close_date CHECK (close_date >= CURRENT_DATE OR stage IN ('closed_won', 'closed_lost'))
);

-- Enable RLS
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Platform admins can manage all opportunities"
  ON public.opportunities
  FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant opportunities"
  ON public.opportunities
  FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin') 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

CREATE POLICY "Franchise admins can manage franchise opportunities"
  ON public.opportunities
  FOR ALL
  USING (
    has_role(auth.uid(), 'franchise_admin') 
    AND franchise_id = get_user_franchise_id(auth.uid())
  );

CREATE POLICY "Users can view franchise opportunities"
  ON public.opportunities
  FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can create franchise opportunities"
  ON public.opportunities
  FOR INSERT
  WITH CHECK (franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can update assigned opportunities"
  ON public.opportunities
  FOR UPDATE
  USING (owner_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_opportunities_tenant ON public.opportunities(tenant_id);
CREATE INDEX idx_opportunities_franchise ON public.opportunities(franchise_id);
CREATE INDEX idx_opportunities_account ON public.opportunities(account_id);
CREATE INDEX idx_opportunities_contact ON public.opportunities(contact_id);
CREATE INDEX idx_opportunities_owner ON public.opportunities(owner_id);
CREATE INDEX idx_opportunities_stage ON public.opportunities(stage);
CREATE INDEX idx_opportunities_close_date ON public.opportunities(close_date);

-- Create trigger for updated_at
CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();