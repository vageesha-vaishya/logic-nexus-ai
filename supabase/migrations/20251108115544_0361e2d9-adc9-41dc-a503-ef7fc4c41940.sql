-- Create enum for quote reset policy
CREATE TYPE quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');

-- Create charge_sides table (Buy/Sell)
CREATE TABLE IF NOT EXISTS public.charge_sides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create charge_categories table
CREATE TABLE IF NOT EXISTS public.charge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create charge_bases table
CREATE TABLE IF NOT EXISTS public.charge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create currencies table
CREATE TABLE IF NOT EXISTS public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create quote_number_config_tenant table
CREATE TABLE IF NOT EXISTS public.quote_number_config_tenant (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO',
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id)
);

-- Create quote_number_config_franchise table
CREATE TABLE IF NOT EXISTS public.quote_number_config_franchise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL DEFAULT 'QUO',
  reset_policy quote_reset_policy NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tenant_id, franchise_id)
);

-- Create quote_number_sequences table
CREATE TABLE IF NOT EXISTS public.quote_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create partial unique indexes for quote_number_sequences
CREATE UNIQUE INDEX IF NOT EXISTS quote_number_sequences_franchise_unique
  ON public.quote_number_sequences(tenant_id, franchise_id, period_key)
  WHERE franchise_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS quote_number_sequences_tenant_unique
  ON public.quote_number_sequences(tenant_id, period_key)
  WHERE franchise_id IS NULL;

-- Create quotation_versions table
CREATE TABLE IF NOT EXISTS public.quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  major_version INTEGER NOT NULL DEFAULT 1,
  minor_version INTEGER NOT NULL DEFAULT 0,
  change_reason TEXT,
  valid_until TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(quote_id, version_number)
);

-- Create quotation_version_options table (carrier rates for each version)
CREATE TABLE IF NOT EXISTS public.quotation_version_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quotation_version_id UUID NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  carrier_rate_id UUID NOT NULL REFERENCES public.carrier_rates(id) ON DELETE CASCADE,
  option_name TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.charge_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_config_franchise ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_version_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies for charge_sides
CREATE POLICY "Platform admins can manage all charge sides"
  ON public.charge_sides FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view charge sides"
  ON public.charge_sides FOR SELECT
  USING (true);

-- RLS Policies for charge_categories
CREATE POLICY "Platform admins can manage all charge categories"
  ON public.charge_categories FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view charge categories"
  ON public.charge_categories FOR SELECT
  USING (true);

-- RLS Policies for charge_bases
CREATE POLICY "Platform admins can manage all charge bases"
  ON public.charge_bases FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view charge bases"
  ON public.charge_bases FOR SELECT
  USING (true);

-- RLS Policies for currencies
CREATE POLICY "Platform admins can manage all currencies"
  ON public.currencies FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can view currencies"
  ON public.currencies FOR SELECT
  USING (true);

-- RLS Policies for quote_number_config_tenant
CREATE POLICY "Platform admins can manage all tenant quote configs"
  ON public.quote_number_config_tenant FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant quote config"
  ON public.quote_number_config_tenant FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can view tenant quote config"
  ON public.quote_number_config_tenant FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for quote_number_config_franchise
CREATE POLICY "Platform admins can manage all franchise quote configs"
  ON public.quote_number_config_franchise FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage franchise quote configs"
  ON public.quote_number_config_franchise FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Franchise admins can manage franchise quote config"
  ON public.quote_number_config_franchise FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));

CREATE POLICY "Users can view franchise quote config"
  ON public.quote_number_config_franchise FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for quote_number_sequences
CREATE POLICY "Platform admins can manage all quote sequences"
  ON public.quote_number_sequences FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "System can manage quote sequences"
  ON public.quote_number_sequences FOR ALL
  USING (true);

-- RLS Policies for quotation_versions
CREATE POLICY "Platform admins can manage all quotation versions"
  ON public.quotation_versions FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can manage versions for accessible quotes"
  ON public.quotation_versions FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid()
    )
  );

-- RLS Policies for quotation_version_options
CREATE POLICY "Platform admins can manage all quotation version options"
  ON public.quotation_version_options FOR ALL
  USING (is_platform_admin(auth.uid()));

CREATE POLICY "Users can manage options for accessible versions"
  ON public.quotation_version_options FOR ALL
  USING (
    quotation_version_id IN (
      SELECT qv.id FROM quotation_versions qv
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid()) OR q.owner_id = auth.uid()
    )
  );

-- Insert default charge sides
INSERT INTO public.charge_sides (name, code, description) VALUES
  ('Buy', 'buy', 'Costs incurred from carriers/suppliers'),
  ('Sell', 'sell', 'Charges to customers')
ON CONFLICT (code) DO NOTHING;

-- Insert default charge categories
INSERT INTO public.charge_categories (name, code, description) VALUES
  ('Freight', 'freight', 'Main transportation charge'),
  ('Fuel Surcharge', 'fuel', 'Fuel adjustment charge'),
  ('Security', 'security', 'Security screening charges'),
  ('Handling', 'handling', 'Cargo handling fees'),
  ('Documentation', 'doc', 'Document processing fees'),
  ('Insurance', 'insurance', 'Cargo insurance'),
  ('Customs', 'customs', 'Customs clearance fees'),
  ('Storage', 'storage', 'Warehousing and storage'),
  ('Other', 'other', 'Miscellaneous charges')
ON CONFLICT (code) DO NOTHING;

-- Insert default charge bases
INSERT INTO public.charge_bases (name, code, description) VALUES
  ('Per Shipment', 'shipment', 'Flat rate per shipment'),
  ('Per KG', 'kg', 'Rate per kilogram'),
  ('Per CBM', 'cbm', 'Rate per cubic meter'),
  ('Per Container', 'container', 'Rate per container'),
  ('Percentage', 'percent', 'Percentage of value'),
  ('Per Day', 'day', 'Daily rate'),
  ('Per Mile', 'mile', 'Rate per mile'),
  ('Per Hour', 'hour', 'Hourly rate')
ON CONFLICT (code) DO NOTHING;

-- Insert default currencies
INSERT INTO public.currencies (code, name, symbol) VALUES
  ('USD', 'US Dollar', '$'),
  ('EUR', 'Euro', '€'),
  ('GBP', 'British Pound', '£'),
  ('JPY', 'Japanese Yen', '¥'),
  ('CAD', 'Canadian Dollar', 'C$'),
  ('AUD', 'Australian Dollar', 'A$'),
  ('CHF', 'Swiss Franc', 'CHF'),
  ('CNY', 'Chinese Yuan', '¥'),
  ('INR', 'Indian Rupee', '₹')
ON CONFLICT (code) DO NOTHING;

-- Create triggers for updated_at
CREATE TRIGGER update_charge_sides_updated_at BEFORE UPDATE ON public.charge_sides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_charge_categories_updated_at BEFORE UPDATE ON public.charge_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_charge_bases_updated_at BEFORE UPDATE ON public.charge_bases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_number_config_tenant_updated_at BEFORE UPDATE ON public.quote_number_config_tenant
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_number_config_franchise_updated_at BEFORE UPDATE ON public.quote_number_config_franchise
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quote_number_sequences_updated_at BEFORE UPDATE ON public.quote_number_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();