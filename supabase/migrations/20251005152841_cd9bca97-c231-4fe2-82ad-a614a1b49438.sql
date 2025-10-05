-- Create service catalog table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving')),
  description TEXT,
  base_price NUMERIC,
  pricing_unit TEXT, -- per kg, per container, per mile, etc.
  transit_time_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, service_code)
);

-- Create carrier rates table
CREATE TABLE public.carrier_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE,
  carrier_name TEXT NOT NULL,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('spot', 'contract')),
  origin_location TEXT,
  destination_location TEXT,
  base_rate NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  valid_from DATE NOT NULL,
  valid_until DATE,
  weight_break_min NUMERIC,
  weight_break_max NUMERIC,
  surcharges JSONB DEFAULT '[]', -- fuel surcharge, security fees, etc.
  accessorial_fees JSONB DEFAULT '[]',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create compliance rules table
CREATE TABLE public.compliance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  service_type TEXT CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving', 'all')),
  regulation_agency TEXT, -- CBP, FMC, FMCSA, TSA, etc.
  rule_description TEXT,
  validation_criteria JSONB NOT NULL, -- JSON schema for validation
  required_documents JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create document templates table
CREATE TABLE public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- commercial_invoice, bill_of_lading, airway_bill, etc.
  service_type TEXT,
  template_content TEXT NOT NULL, -- HTML template with placeholders
  required_fields JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add mode-specific fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN service_type TEXT CHECK (service_type IN ('ocean', 'air', 'trucking', 'courier', 'moving')),
ADD COLUMN incoterms TEXT,
ADD COLUMN origin_location JSONB DEFAULT '{}',
ADD COLUMN destination_location JSONB DEFAULT '{}',
ADD COLUMN cargo_details JSONB DEFAULT '{}',
ADD COLUMN special_handling JSONB DEFAULT '[]',
ADD COLUMN regulatory_data JSONB DEFAULT '{}',
ADD COLUMN compliance_status TEXT DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'validated', 'requires_review', 'non_compliant')),
ADD COLUMN carrier_id UUID,
ADD COLUMN service_id UUID REFERENCES public.services(id);

-- Create rate calculation history table
CREATE TABLE public.rate_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  carrier_rate_id UUID REFERENCES public.carrier_rates(id),
  calculation_breakdown JSONB NOT NULL, -- detailed cost breakdown
  applied_surcharges JSONB DEFAULT '[]',
  applied_discounts JSONB DEFAULT '[]',
  final_rate NUMERIC NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculated_by UUID REFERENCES auth.users(id)
);

-- Create quote documents table
CREATE TABLE public.quote_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT,
  document_data JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by UUID REFERENCES auth.users(id)
);

-- Create compliance checks table
CREATE TABLE public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.compliance_rules(id),
  check_status TEXT NOT NULL CHECK (check_status IN ('passed', 'failed', 'warning', 'pending')),
  check_details JSONB,
  checked_at TIMESTAMPTZ DEFAULT now(),
  checked_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carrier_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for services
CREATE POLICY "Tenant users can view services" ON public.services FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant admins can manage services" ON public.services FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Platform admins can manage all services" ON public.services FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for carrier_rates
CREATE POLICY "Tenant users can view rates" ON public.carrier_rates FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant admins can manage rates" ON public.carrier_rates FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Platform admins can manage all rates" ON public.carrier_rates FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for compliance_rules
CREATE POLICY "Tenant users can view compliance rules" ON public.compliance_rules FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant admins can manage compliance rules" ON public.compliance_rules FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Platform admins can manage all compliance rules" ON public.compliance_rules FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for document_templates
CREATE POLICY "Tenant users can view templates" ON public.document_templates FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant admins can manage templates" ON public.document_templates FOR ALL USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Platform admins can manage all templates" ON public.document_templates FOR ALL USING (is_platform_admin(auth.uid()));

-- RLS Policies for rate_calculations
CREATE POLICY "Users can view calculations for accessible quotes" ON public.rate_calculations FOR SELECT USING (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);
CREATE POLICY "Users can create calculations" ON public.rate_calculations FOR INSERT WITH CHECK (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);

-- RLS Policies for quote_documents
CREATE POLICY "Users can view documents for accessible quotes" ON public.quote_documents FOR SELECT USING (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);
CREATE POLICY "Users can create documents" ON public.quote_documents FOR INSERT WITH CHECK (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);

-- RLS Policies for compliance_checks
CREATE POLICY "Users can view compliance checks for accessible quotes" ON public.compliance_checks FOR SELECT USING (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);
CREATE POLICY "Users can create compliance checks" ON public.compliance_checks FOR INSERT WITH CHECK (
  quote_id IN (SELECT id FROM public.quotes WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid())
);

-- Create indexes
CREATE INDEX idx_services_tenant ON public.services(tenant_id);
CREATE INDEX idx_services_type ON public.services(service_type);
CREATE INDEX idx_carrier_rates_tenant ON public.carrier_rates(tenant_id);
CREATE INDEX idx_carrier_rates_service ON public.carrier_rates(service_id);
CREATE INDEX idx_carrier_rates_dates ON public.carrier_rates(valid_from, valid_until);
CREATE INDEX idx_quotes_service_type ON public.quotes(service_type);
CREATE INDEX idx_rate_calculations_quote ON public.rate_calculations(quote_id);
CREATE INDEX idx_quote_documents_quote ON public.quote_documents(quote_id);
CREATE INDEX idx_compliance_checks_quote ON public.compliance_checks(quote_id);

-- Add updated_at triggers
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_carrier_rates_updated_at BEFORE UPDATE ON public.carrier_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_compliance_rules_updated_at BEFORE UPDATE ON public.compliance_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_document_templates_updated_at BEFORE UPDATE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();