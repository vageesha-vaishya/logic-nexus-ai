-- Create quote_legs table for multi-modal quotations
CREATE TABLE IF NOT EXISTS public.quote_legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  quote_option_id UUID NOT NULL,
  leg_number INTEGER NOT NULL DEFAULT 1,
  mode TEXT,
  service_type_id UUID,
  origin_location TEXT,
  destination_location TEXT,
  carrier_id UUID,
  transit_days INTEGER,
  departure_date TIMESTAMP WITH TIME ZONE,
  arrival_date TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  sort_order INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.quote_legs ENABLE ROW LEVEL SECURITY;

-- Create stub records for existing leg_ids in quote_charges
INSERT INTO public.quote_legs (id, tenant_id, quote_option_id, leg_number, mode)
SELECT DISTINCT 
  qc.leg_id,
  qc.tenant_id,
  qc.quote_option_id,
  1,
  'ocean'
FROM public.quote_charges qc
WHERE qc.leg_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies
CREATE POLICY "Platform admins can manage all quote legs"
  ON public.quote_legs
  FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant quote legs"
  ON public.quote_legs
  FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin'::app_role) AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view franchise quote legs"
  ON public.quote_legs
  FOR SELECT
  USING (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

CREATE POLICY "Users can create franchise quote legs"
  ON public.quote_legs
  FOR INSERT
  WITH CHECK (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

-- Create indexes
CREATE INDEX idx_quote_legs_option ON public.quote_legs(quote_option_id);
CREATE INDEX idx_quote_legs_tenant ON public.quote_legs(tenant_id);
CREATE INDEX idx_quote_legs_service_type ON public.quote_legs(service_type_id);

-- Add foreign key constraints
ALTER TABLE public.quote_legs
  ADD CONSTRAINT fk_quote_legs_tenant
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.quote_legs
  ADD CONSTRAINT fk_quote_legs_option
  FOREIGN KEY (quote_option_id) REFERENCES public.quotation_version_options(id) ON DELETE CASCADE;

-- Add foreign key for quote_charges to quote_legs
ALTER TABLE public.quote_charges
  ADD CONSTRAINT fk_quote_charges_leg
  FOREIGN KEY (leg_id) REFERENCES public.quote_legs(id) ON DELETE CASCADE;

-- Create updated_at trigger
CREATE TRIGGER set_quote_legs_updated_at
  BEFORE UPDATE ON public.quote_legs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
