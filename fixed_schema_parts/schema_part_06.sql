  -- Add 'lost' if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lost' AND enumtypid = 'lead_status'::regtype) THEN
    ALTER TYPE lead_status ADD VALUE 'lost';
  END IF;
END $$;-- Create enum for quote reset policy
DO $$ BEGIN
    CREATE TYPE quote_reset_policy AS ENUM ('none', 'daily', 'monthly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
  major INTEGER NOT NULL DEFAULT 1,
  minor INTEGER NOT NULL DEFAULT 0,
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
DROP POLICY IF EXISTS "Platform admins can manage all charge sides" ON public.charge_sides;
CREATE POLICY "Platform admins can manage all charge sides" ON public.charge_sides FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view charge sides" ON public.charge_sides;
CREATE POLICY "Users can view charge sides" ON public.charge_sides FOR SELECT
  USING (true);

-- RLS Policies for charge_categories
DROP POLICY IF EXISTS "Platform admins can manage all charge categories" ON public.charge_categories;
CREATE POLICY "Platform admins can manage all charge categories" ON public.charge_categories FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view charge categories" ON public.charge_categories;
CREATE POLICY "Users can view charge categories" ON public.charge_categories FOR SELECT
  USING (true);

-- RLS Policies for charge_bases
DROP POLICY IF EXISTS "Platform admins can manage all charge bases" ON public.charge_bases;
CREATE POLICY "Platform admins can manage all charge bases" ON public.charge_bases FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view charge bases" ON public.charge_bases;
CREATE POLICY "Users can view charge bases" ON public.charge_bases FOR SELECT
  USING (true);

-- RLS Policies for currencies
DROP POLICY IF EXISTS "Platform admins can manage all currencies" ON public.currencies;
CREATE POLICY "Platform admins can manage all currencies" ON public.currencies FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view currencies" ON public.currencies;
CREATE POLICY "Users can view currencies" ON public.currencies FOR SELECT
  USING (true);

-- RLS Policies for quote_number_config_tenant
DROP POLICY IF EXISTS "Platform admins can manage all tenant quote configs" ON public.quote_number_config_tenant;
CREATE POLICY "Platform admins can manage all tenant quote configs" ON public.quote_number_config_tenant FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage tenant quote config" ON public.quote_number_config_tenant FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view tenant quote config" ON public.quote_number_config_tenant FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

-- RLS Policies for quote_number_config_franchise
DROP POLICY IF EXISTS "Platform admins can manage all franchise quote configs" ON public.quote_number_config_franchise;
CREATE POLICY "Platform admins can manage all franchise quote configs" ON public.quote_number_config_franchise FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage franchise quote configs" ON public.quote_number_config_franchise;
CREATE POLICY "Tenant admins can manage franchise quote configs" ON public.quote_number_config_franchise FOR ALL
  USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Franchise admins can manage franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage franchise quote config" ON public.quote_number_config_franchise FOR ALL
  USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view franchise quote config" ON public.quote_number_config_franchise FOR SELECT
  USING (franchise_id = get_user_franchise_id(auth.uid()));

-- RLS Policies for quote_number_sequences
DROP POLICY IF EXISTS "Platform admins can manage all quote sequences" ON public.quote_number_sequences;
CREATE POLICY "Platform admins can manage all quote sequences" ON public.quote_number_sequences FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "System can manage quote sequences" ON public.quote_number_sequences;
CREATE POLICY "System can manage quote sequences" ON public.quote_number_sequences FOR ALL
  USING (true);

-- RLS Policies for quotation_versions
DROP POLICY IF EXISTS "Platform admins can manage all quotation versions" ON public.quotation_versions;
CREATE POLICY "Platform admins can manage all quotation versions" ON public.quotation_versions FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage versions for accessible quotes" ON public.quotation_versions;
CREATE POLICY "Users can manage versions for accessible quotes" ON public.quotation_versions FOR ALL
  USING (
    quote_id IN (
      SELECT id FROM quotes
      WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid()
    )
  );

-- RLS Policies for quotation_version_options
DROP POLICY IF EXISTS "Platform admins can manage all quotation version options" ON public.quotation_version_options;
CREATE POLICY "Platform admins can manage all quotation version options" ON public.quotation_version_options FOR ALL
  USING (is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can manage options for accessible versions" ON public.quotation_version_options;
CREATE POLICY "Users can manage options for accessible versions" ON public.quotation_version_options FOR ALL
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
DROP TRIGGER IF EXISTS update_charge_sides_updated_at ON public.charge_sides;
CREATE TRIGGER update_charge_sides_updated_at BEFORE UPDATE ON public.charge_sides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_charge_categories_updated_at ON public.charge_categories;
CREATE TRIGGER update_charge_categories_updated_at BEFORE UPDATE ON public.charge_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_charge_bases_updated_at ON public.charge_bases;
CREATE TRIGGER update_charge_bases_updated_at BEFORE UPDATE ON public.charge_bases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_currencies_updated_at ON public.currencies;
CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_number_config_tenant_updated_at ON public.quote_number_config_tenant;
CREATE TRIGGER update_quote_number_config_tenant_updated_at BEFORE UPDATE ON public.quote_number_config_tenant
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_number_config_franchise_updated_at ON public.quote_number_config_franchise;
CREATE TRIGGER update_quote_number_config_franchise_updated_at BEFORE UPDATE ON public.quote_number_config_franchise
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quote_number_sequences_updated_at ON public.quote_number_sequences;
CREATE TRIGGER update_quote_number_sequences_updated_at BEFORE UPDATE ON public.quote_number_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();-- Create enum for quote reset policy if it doesn't exist
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'quote_reset_policy' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.quote_reset_policy AS ENUM ('none','daily','monthly','yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['none','daily','monthly','yearly'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'quote_reset_policy' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.quote_reset_policy ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

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
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all charge sides" ON public.charge_sides;
CREATE POLICY "Platform admins can manage all charge sides" ON public.charge_sides FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view charge sides" ON public.charge_sides;
CREATE POLICY "Users can view charge sides" ON public.charge_sides FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for charge_categories
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all charge categories" ON public.charge_categories;
CREATE POLICY "Platform admins can manage all charge categories" ON public.charge_categories FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view charge categories" ON public.charge_categories;
CREATE POLICY "Users can view charge categories" ON public.charge_categories FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for charge_bases
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all charge bases" ON public.charge_bases;
CREATE POLICY "Platform admins can manage all charge bases" ON public.charge_bases FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view charge bases" ON public.charge_bases;
CREATE POLICY "Users can view charge bases" ON public.charge_bases FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for currencies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all currencies" ON public.currencies;
CREATE POLICY "Platform admins can manage all currencies" ON public.currencies FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view currencies" ON public.currencies;
CREATE POLICY "Users can view currencies" ON public.currencies FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quote_number_config_tenant
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all tenant quote configs" ON public.quote_number_config_tenant;
CREATE POLICY "Platform admins can manage all tenant quote configs" ON public.quote_number_config_tenant FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Tenant admins can manage tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage tenant quote config" ON public.quote_number_config_tenant FOR ALL
    USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view tenant quote config" ON public.quote_number_config_tenant FOR SELECT
    USING (tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quote_number_config_franchise
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all franchise quote configs" ON public.quote_number_config_franchise;
CREATE POLICY "Platform admins can manage all franchise quote configs" ON public.quote_number_config_franchise FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Tenant admins can manage franchise quote configs" ON public.quote_number_config_franchise;
CREATE POLICY "Tenant admins can manage franchise quote configs" ON public.quote_number_config_franchise FOR ALL
    USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Franchise admins can manage franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage franchise quote config" ON public.quote_number_config_franchise FOR ALL
    USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view franchise quote config" ON public.quote_number_config_franchise FOR SELECT
    USING (franchise_id = get_user_franchise_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quote_number_sequences
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all quote sequences" ON public.quote_number_sequences;
CREATE POLICY "Platform admins can manage all quote sequences" ON public.quote_number_sequences FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "System can manage quote sequences" ON public.quote_number_sequences;
CREATE POLICY "System can manage quote sequences" ON public.quote_number_sequences FOR ALL
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quotation_versions
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all quotation versions" ON public.quotation_versions;
CREATE POLICY "Platform admins can manage all quotation versions" ON public.quotation_versions FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage versions for accessible quotes" ON public.quotation_versions;
CREATE POLICY "Users can manage versions for accessible quotes" ON public.quotation_versions FOR ALL
    USING (
      quote_id IN (
        SELECT id FROM quotes
        WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quotation_version_options
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all quotation version options" ON public.quotation_version_options;
CREATE POLICY "Platform admins can manage all quotation version options" ON public.quotation_version_options FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage options for accessible versions" ON public.quotation_version_options;
CREATE POLICY "Users can manage options for accessible versions" ON public.quotation_version_options FOR ALL
    USING (
      quotation_version_id IN (
        SELECT qv.id FROM quotation_versions qv
        JOIN quotes q ON qv.quote_id = q.id
        WHERE q.franchise_id = get_user_franchise_id(auth.uid()) OR q.owner_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_charge_sides_updated_at ON public.charge_sides;
CREATE TRIGGER update_charge_sides_updated_at BEFORE UPDATE ON public.charge_sides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_charge_categories_updated_at ON public.charge_categories;
CREATE TRIGGER update_charge_categories_updated_at BEFORE UPDATE ON public.charge_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_charge_bases_updated_at ON public.charge_bases;
CREATE TRIGGER update_charge_bases_updated_at BEFORE UPDATE ON public.charge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_currencies_updated_at ON public.currencies;
CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_quote_number_config_tenant_updated_at ON public.quote_number_config_tenant;
CREATE TRIGGER update_quote_number_config_tenant_updated_at BEFORE UPDATE ON public.quote_number_config_tenant
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_quote_number_config_franchise_updated_at ON public.quote_number_config_franchise;
CREATE TRIGGER update_quote_number_config_franchise_updated_at BEFORE UPDATE ON public.quote_number_config_franchise
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_quote_number_sequences_updated_at ON public.quote_number_sequences;
CREATE TRIGGER update_quote_number_sequences_updated_at BEFORE UPDATE ON public.quote_number_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;-- Create enum for quote reset policy if it doesn't exist
DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'quote_reset_policy' AND n.nspname = 'public'
  ) THEN BEGIN
    CREATE TYPE public.quote_reset_policy AS ENUM ('none','daily','monthly','yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END;
EXCEPTION
    WHEN duplicate_object THEN null;
END; ELSE
    FOREACH lbl IN ARRAY ARRAY['none','daily','monthly','yearly'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'quote_reset_policy' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.quote_reset_policy ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

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
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all charge sides" ON public.charge_sides;
CREATE POLICY "Platform admins can manage all charge sides" ON public.charge_sides FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view charge sides" ON public.charge_sides;
CREATE POLICY "Users can view charge sides" ON public.charge_sides FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for charge_categories
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all charge categories" ON public.charge_categories;
CREATE POLICY "Platform admins can manage all charge categories" ON public.charge_categories FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view charge categories" ON public.charge_categories;
CREATE POLICY "Users can view charge categories" ON public.charge_categories FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for charge_bases
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all charge bases" ON public.charge_bases;
CREATE POLICY "Platform admins can manage all charge bases" ON public.charge_bases FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view charge bases" ON public.charge_bases;
CREATE POLICY "Users can view charge bases" ON public.charge_bases FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for currencies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all currencies" ON public.currencies;
CREATE POLICY "Platform admins can manage all currencies" ON public.currencies FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view currencies" ON public.currencies;
CREATE POLICY "Users can view currencies" ON public.currencies FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quote_number_config_tenant
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all tenant quote configs" ON public.quote_number_config_tenant;
CREATE POLICY "Platform admins can manage all tenant quote configs" ON public.quote_number_config_tenant FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Tenant admins can manage tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Tenant admins can manage tenant quote config" ON public.quote_number_config_tenant FOR ALL
    USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view tenant quote config" ON public.quote_number_config_tenant;
CREATE POLICY "Users can view tenant quote config" ON public.quote_number_config_tenant FOR SELECT
    USING (tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quote_number_config_franchise
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all franchise quote configs" ON public.quote_number_config_franchise;
CREATE POLICY "Platform admins can manage all franchise quote configs" ON public.quote_number_config_franchise FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Tenant admins can manage franchise quote configs" ON public.quote_number_config_franchise;
CREATE POLICY "Tenant admins can manage franchise quote configs" ON public.quote_number_config_franchise FOR ALL
    USING (has_role(auth.uid(), 'tenant_admin') AND tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Franchise admins can manage franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Franchise admins can manage franchise quote config" ON public.quote_number_config_franchise FOR ALL
    USING (has_role(auth.uid(), 'franchise_admin') AND franchise_id = get_user_franchise_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view franchise quote config" ON public.quote_number_config_franchise;
CREATE POLICY "Users can view franchise quote config" ON public.quote_number_config_franchise FOR SELECT
    USING (franchise_id = get_user_franchise_id(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quote_number_sequences
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all quote sequences" ON public.quote_number_sequences;
CREATE POLICY "Platform admins can manage all quote sequences" ON public.quote_number_sequences FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "System can manage quote sequences" ON public.quote_number_sequences;
CREATE POLICY "System can manage quote sequences" ON public.quote_number_sequences FOR ALL
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quotation_versions
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all quotation versions" ON public.quotation_versions;
CREATE POLICY "Platform admins can manage all quotation versions" ON public.quotation_versions FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage versions for accessible quotes" ON public.quotation_versions;
CREATE POLICY "Users can manage versions for accessible quotes" ON public.quotation_versions FOR ALL
    USING (
      quote_id IN (
        SELECT id FROM quotes
        WHERE franchise_id = get_user_franchise_id(auth.uid()) OR owner_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for quotation_version_options
DO $$ BEGIN
  DROP POLICY IF EXISTS "Platform admins can manage all quotation version options" ON public.quotation_version_options;
CREATE POLICY "Platform admins can manage all quotation version options" ON public.quotation_version_options FOR ALL
    USING (is_platform_admin(auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage options for accessible versions" ON public.quotation_version_options;
CREATE POLICY "Users can manage options for accessible versions" ON public.quotation_version_options FOR ALL
    USING (
      quotation_version_id IN (
        SELECT qv.id FROM quotation_versions qv
        JOIN quotes q ON qv.quote_id = q.id
        WHERE q.franchise_id = get_user_franchise_id(auth.uid()) OR q.owner_id = auth.uid()
      )
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_charge_sides_updated_at ON public.charge_sides;
CREATE TRIGGER update_charge_sides_updated_at BEFORE UPDATE ON public.charge_sides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_charge_categories_updated_at ON public.charge_categories;
CREATE TRIGGER update_charge_categories_updated_at BEFORE UPDATE ON public.charge_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_charge_bases_updated_at ON public.charge_bases;
CREATE TRIGGER update_charge_bases_updated_at BEFORE UPDATE ON public.charge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_currencies_updated_at ON public.currencies;
CREATE TRIGGER update_currencies_updated_at BEFORE UPDATE ON public.currencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_quote_number_config_tenant_updated_at ON public.quote_number_config_tenant;
CREATE TRIGGER update_quote_number_config_tenant_updated_at BEFORE UPDATE ON public.quote_number_config_tenant
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_quote_number_config_franchise_updated_at ON public.quote_number_config_franchise;
CREATE TRIGGER update_quote_number_config_franchise_updated_at BEFORE UPDATE ON public.quote_number_config_franchise
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS update_quote_number_sequences_updated_at ON public.quote_number_sequences;
CREATE TRIGGER update_quote_number_sequences_updated_at BEFORE UPDATE ON public.quote_number_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;-- RLS policies for quotation_versions to allow tenant-scoped access via parent quotes
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

-- Read policy: user can read versions of quotes they can access
CREATE POLICY quotation_versions_read
ON public.quotation_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Manage policy: user can insert/update/delete versions of quotes they can access
CREATE POLICY quotation_versions_manage
ON public.quotation_versions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);-- Master tables (no enums) for quotation system
CREATE TABLE IF NOT EXISTS public.charge_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  code text UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.charge_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  code text UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.charge_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  code text UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  code text NOT NULL UNIQUE,
  name text,
  symbol text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.container_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  code text UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.container_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  code text UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Quote Options (per version)
CREATE TABLE IF NOT EXISTS public.quote_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.carriers(id),
  service_type_id uuid REFERENCES public.service_types(id),
  service_id uuid REFERENCES public.services(id),
  container_type_id uuid REFERENCES public.container_types(id),
  container_size_id uuid REFERENCES public.container_sizes(id),
  package_category_id uuid REFERENCES public.package_categories(id),
  package_size_id uuid REFERENCES public.package_sizes(id),
  origin_port_id uuid REFERENCES public.ports_locations(id),
  destination_port_id uuid REFERENCES public.ports_locations(id),
  transit_time_days integer,
  free_time_days integer,
  validity_date timestamptz,
  currency_id uuid REFERENCES public.currencies(id),
  buy_subtotal numeric NOT NULL DEFAULT 0,
  sell_subtotal numeric NOT NULL DEFAULT 0,
  margin_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quote Charges (normalized lines)
CREATE TABLE IF NOT EXISTS public.quote_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_option_id uuid NOT NULL REFERENCES public.quote_options(id) ON DELETE CASCADE,
  charge_side_id uuid NOT NULL REFERENCES public.charge_sides(id),
  category_id uuid NOT NULL REFERENCES public.charge_categories(id),
  basis_id uuid NOT NULL REFERENCES public.charge_bases(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  rate numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  currency_id uuid REFERENCES public.currencies(id),
  min_amount numeric,
  max_amount numeric,
  note text,
  sort_order integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Customer selection
CREATE TABLE IF NOT EXISTS public.quote_selection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.quote_options(id) ON DELETE CASCADE,
  selected_by uuid REFERENCES public.profiles(id),
  reason text,
  selected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS quote_options_version_idx ON public.quote_options (quote_version_id);
CREATE INDEX IF NOT EXISTS quote_charges_option_idx ON public.quote_charges (quote_option_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'charge_categories' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.charge_categories ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'charge_bases' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.charge_bases ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'charge_sides' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.charge_sides ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'currencies' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.currencies ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_types' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.container_types ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_sizes' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.container_sizes ADD COLUMN IF NOT EXISTS tenant_id uuid;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.charge_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_sides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.container_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_selection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS charge_categories_read ON public.charge_categories;
DROP POLICY IF EXISTS charge_categories_manage ON public.charge_categories;
DROP POLICY IF EXISTS charge_bases_read ON public.charge_bases;
DROP POLICY IF EXISTS charge_bases_manage ON public.charge_bases;
DROP POLICY IF EXISTS charge_sides_read ON public.charge_sides;
DROP POLICY IF EXISTS charge_sides_manage ON public.charge_sides;
DROP POLICY IF EXISTS currencies_read ON public.currencies;
DROP POLICY IF EXISTS currencies_manage ON public.currencies;
DROP POLICY IF EXISTS container_types_read ON public.container_types;
DROP POLICY IF EXISTS container_types_manage ON public.container_types;
DROP POLICY IF EXISTS container_sizes_read ON public.container_sizes;
DROP POLICY IF EXISTS container_sizes_manage ON public.container_sizes;
DROP POLICY IF EXISTS quote_options_read ON public.quote_options;
DROP POLICY IF EXISTS quote_options_manage ON public.quote_options;
DROP POLICY IF EXISTS quote_charges_read ON public.quote_charges;
DROP POLICY IF EXISTS quote_charges_manage ON public.quote_charges;
DROP POLICY IF EXISTS quote_selection_read ON public.quote_selection;
DROP POLICY IF EXISTS quote_selection_manage ON public.quote_selection;

CREATE POLICY charge_categories_read ON public.charge_categories FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY charge_categories_manage ON public.charge_categories FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY charge_bases_read ON public.charge_bases FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY charge_bases_manage ON public.charge_bases FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY charge_sides_read ON public.charge_sides FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY charge_sides_manage ON public.charge_sides FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY currencies_read ON public.currencies FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY currencies_manage ON public.currencies FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY container_types_read ON public.container_types FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY container_types_manage ON public.container_types FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY container_sizes_read ON public.container_sizes FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY container_sizes_manage ON public.container_sizes FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY quote_options_read ON public.quote_options FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY quote_options_manage ON public.quote_options FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY quote_charges_read ON public.quote_charges FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY quote_charges_manage ON public.quote_charges FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY quote_selection_read ON public.quote_selection FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY quote_selection_manage ON public.quote_selection FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
-- RLS policies for quotation_versions to allow tenant-scoped access via parent quotes
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotation_versions_read ON public.quotation_versions;
DROP POLICY IF EXISTS quotation_versions_manage ON public.quotation_versions;

-- Read policy: user can read versions of quotes they can access
CREATE POLICY quotation_versions_read
ON public.quotation_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Manage policy: user can insert/update/delete versions of quotes they can access
CREATE POLICY quotation_versions_manage
ON public.quotation_versions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quotation_versions.quote_id
      AND q.tenant_id = get_user_tenant_id(auth.uid())
  )
);
-- Rename table quote_versions to quotation_versions if it exists and target does not already exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quote_versions'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quotation_versions'
  ) THEN
    ALTER TABLE public.quote_versions RENAME TO quotation_versions;
  END IF;
END $$;
-- Phase 1: Multimodal legs, margin controls, trade directions, provider types, FX, methods

-- Masters (tenant-scoped where appropriate)
CREATE TABLE IF NOT EXISTS public.provider_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trade_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL CHECK (code IN ('import','export','inland')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  from_currency_id uuid NOT NULL REFERENCES public.currencies(id),
  to_currency_id uuid NOT NULL REFERENCES public.currencies(id),
  rate numeric NOT NULL CHECK (rate > 0),
  effective_date date NOT NULL,
  source text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fx_rates_idx ON public.fx_rates (tenant_id, from_currency_id, to_currency_id, effective_date);

CREATE TABLE IF NOT EXISTS public.margin_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL CHECK (code IN ('fixed','percent')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.margin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  default_method_id uuid NOT NULL REFERENCES public.margin_methods(id),
  default_value numeric NOT NULL,
  rounding_rule text NULL,
  min_margin numeric NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quote option legs (per option segments)
CREATE TABLE IF NOT EXISTS public.quotation_version_option_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quotation_version_option_id uuid NOT NULL REFERENCES public.quotation_version_options(id) ON DELETE CASCADE,
  leg_order int NOT NULL DEFAULT 1,
  mode_id uuid NULL REFERENCES public.service_modes(id),
  service_id uuid NULL REFERENCES public.services(id),
  origin_location text NULL,
  destination_location text NULL,
  provider_id uuid NULL REFERENCES public.carriers(id),
  planned_departure timestamptz NULL,
  planned_arrival timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotation_version_option_legs_option_order_idx ON public.quotation_version_option_legs (quotation_version_option_id, leg_order);

-- Extend quotation_version_options with margin and context fields
ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS trade_direction_id uuid NULL REFERENCES public.trade_directions(id);

ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS provider_type_id uuid NULL REFERENCES public.provider_types(id);

ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS quote_currency_id uuid NULL REFERENCES public.currencies(id);

ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS margin_method_id uuid NULL REFERENCES public.margin_methods(id);

ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS margin_value numeric NULL;

ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS auto_margin_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS min_margin numeric NULL;

ALTER TABLE public.quotation_version_options
  ADD COLUMN IF NOT EXISTS rounding_rule text NULL;

-- RLS policies (tenant-scoped)
ALTER TABLE public.provider_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_version_option_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY provider_types_tenant_read ON public.provider_types FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY provider_types_tenant_write ON public.provider_types FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY trade_directions_tenant_read ON public.trade_directions FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY trade_directions_tenant_write ON public.trade_directions FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY service_modes_tenant_read ON public.service_modes FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY service_modes_tenant_write ON public.service_modes FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY fx_rates_tenant_read ON public.fx_rates FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY fx_rates_tenant_write ON public.fx_rates FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY margin_methods_tenant_read ON public.margin_methods FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY margin_methods_tenant_write ON public.margin_methods FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY margin_profiles_tenant_read ON public.margin_profiles FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY margin_profiles_tenant_write ON public.margin_profiles FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- quotation_version_option_legs: allow based on parent option tenant
DROP POLICY IF EXISTS quotation_version_option_legs_read ON public.quotation_version_option_legs;
CREATE POLICY quotation_version_option_legs_read ON public.quotation_version_option_legs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotation_version_options qvo
    WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
      AND qvo.tenant_id = get_user_tenant_id(auth.uid())
  )
);

DROP POLICY IF EXISTS quotation_version_option_legs_write ON public.quotation_version_option_legs;
CREATE POLICY quotation_version_option_legs_write ON public.quotation_version_option_legs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quotation_version_options qvo
    WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
      AND qvo.tenant_id = get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotation_version_options qvo
    WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
      AND qvo.tenant_id = get_user_tenant_id(auth.uid())
  )
);-- Create container_types table
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

DROP POLICY IF EXISTS "Tenant users can view container types" ON public.container_types;
CREATE POLICY "Tenant users can view container types" ON public.container_types FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage container types" ON public.container_types;
CREATE POLICY "Tenant admins can manage container types" ON public.container_types FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can manage all container types" ON public.container_types;
CREATE POLICY "Platform admins can manage all container types" ON public.container_types FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Enable RLS on container_sizes
ALTER TABLE public.container_sizes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can view container sizes" ON public.container_sizes;
CREATE POLICY "Tenant users can view container sizes" ON public.container_sizes FOR SELECT
  USING (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can manage container sizes" ON public.container_sizes;
CREATE POLICY "Tenant admins can manage container sizes" ON public.container_sizes FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can manage all container sizes" ON public.container_sizes;
CREATE POLICY "Platform admins can manage all container sizes" ON public.container_sizes FOR ALL
  USING (is_platform_admin(auth.uid()));

-- Enable RLS on quote_charges
ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view franchise quote charges" ON public.quote_charges;
CREATE POLICY "Users can view franchise quote charges" ON public.quote_charges FOR SELECT
  USING (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create franchise quote charges" ON public.quote_charges;
CREATE POLICY "Users can create franchise quote charges" ON public.quote_charges FOR INSERT
  WITH CHECK (
    quote_option_id IN (
      SELECT qvo.id FROM quotation_version_options qvo
      JOIN quotation_versions qv ON qvo.quotation_version_id = qv.id
      JOIN quotes q ON qv.quote_id = q.id
      WHERE q.franchise_id = get_user_franchise_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Tenant admins can manage tenant quote charges" ON public.quote_charges;
CREATE POLICY "Tenant admins can manage tenant quote charges" ON public.quote_charges FOR ALL
  USING (
    has_role(auth.uid(), 'tenant_admin'::app_role) 
    AND tenant_id = get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Platform admins can manage all quote charges" ON public.quote_charges;
CREATE POLICY "Platform admins can manage all quote charges" ON public.quote_charges FOR ALL
  USING (is_platform_admin(auth.uid()));-- Phase 1: Multimodal legs, margin controls, trade directions, provider types, FX, methods

-- Masters (tenant-scoped where appropriate)
CREATE TABLE IF NOT EXISTS public.provider_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trade_directions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL CHECK (code IN ('import','export','inland')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.service_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  from_currency_id uuid NOT NULL REFERENCES public.currencies(id),
  to_currency_id uuid NOT NULL REFERENCES public.currencies(id),
  rate numeric NOT NULL CHECK (rate > 0),
  effective_date date NOT NULL,
  source text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fx_rates_idx ON public.fx_rates (tenant_id, from_currency_id, to_currency_id, effective_date);

CREATE TABLE IF NOT EXISTS public.margin_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  code text NOT NULL CHECK (code IN ('fixed','percent')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.margin_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  default_method_id uuid NOT NULL REFERENCES public.margin_methods(id),
  default_value numeric NOT NULL,
  rounding_rule text NULL,
  min_margin numeric NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quote option legs (per option segments)
CREATE TABLE IF NOT EXISTS public.quote_option_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_option_id uuid NOT NULL REFERENCES public.quote_options(id) ON DELETE CASCADE,
  leg_order int NOT NULL DEFAULT 1,
  mode_id uuid NULL REFERENCES public.service_modes(id),
  service_id uuid NULL REFERENCES public.services(id),
  origin_location text NULL,
  destination_location text NULL,
  provider_id uuid NULL REFERENCES public.carriers(id),
  planned_departure timestamptz NULL,
  planned_arrival timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_option_legs_option_order_idx ON public.quote_option_legs (quote_option_id, leg_order);

-- Extend quote_options with margin and context fields
ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS trade_direction_id uuid NULL REFERENCES public.trade_directions(id);

ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS provider_type_id uuid NULL REFERENCES public.provider_types(id);

ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS quote_currency_id uuid NULL REFERENCES public.currencies(id);

ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS margin_method_id uuid NULL REFERENCES public.margin_methods(id);

ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS margin_value numeric NULL;

ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS auto_margin_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS min_margin numeric NULL;

ALTER TABLE public.quote_options
  ADD COLUMN IF NOT EXISTS rounding_rule text NULL;

-- Attach charges to legs optionally
ALTER TABLE public.quote_charges
  ADD COLUMN IF NOT EXISTS leg_id uuid NULL REFERENCES public.quote_option_legs(id) ON DELETE SET NULL;

-- RLS policies (tenant-scoped) using parent relationships
ALTER TABLE public.provider_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_directions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.margin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_option_legs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_types_tenant_read ON public.provider_types;
DROP POLICY IF EXISTS provider_types_tenant_write ON public.provider_types;
DROP POLICY IF EXISTS trade_directions_tenant_read ON public.trade_directions;
DROP POLICY IF EXISTS trade_directions_tenant_write ON public.trade_directions;
DROP POLICY IF EXISTS service_modes_tenant_read ON public.service_modes;
DROP POLICY IF EXISTS service_modes_tenant_write ON public.service_modes;
DROP POLICY IF EXISTS fx_rates_tenant_read ON public.fx_rates;
DROP POLICY IF EXISTS fx_rates_tenant_write ON public.fx_rates;
DROP POLICY IF EXISTS margin_methods_tenant_read ON public.margin_methods;
DROP POLICY IF EXISTS margin_methods_tenant_write ON public.margin_methods;
DROP POLICY IF EXISTS margin_profiles_tenant_read ON public.margin_profiles;
DROP POLICY IF EXISTS margin_profiles_tenant_write ON public.margin_profiles;
DROP POLICY IF EXISTS quote_option_legs_read ON public.quote_option_legs;
DROP POLICY IF EXISTS quote_option_legs_write ON public.quote_option_legs;

CREATE POLICY provider_types_tenant_read ON public.provider_types FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY provider_types_tenant_write ON public.provider_types FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY trade_directions_tenant_read ON public.trade_directions FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY trade_directions_tenant_write ON public.trade_directions FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY service_modes_tenant_read ON public.service_modes FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY service_modes_tenant_write ON public.service_modes FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY fx_rates_tenant_read ON public.fx_rates FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY fx_rates_tenant_write ON public.fx_rates FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY margin_methods_tenant_read ON public.margin_methods FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY margin_methods_tenant_write ON public.margin_methods FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY margin_profiles_tenant_read ON public.margin_profiles FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY margin_profiles_tenant_write ON public.margin_profiles FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- quote_option_legs: allow based on parent option tenant
CREATE POLICY quote_option_legs_read ON public.quote_option_legs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quote_options qo
    WHERE qo.id = quote_option_legs.quote_option_id
      AND qo.tenant_id = get_user_tenant_id(auth.uid())
  )
);

CREATE POLICY quote_option_legs_write ON public.quote_option_legs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quote_options qo
    WHERE qo.id = quote_option_legs.quote_option_id
      AND qo.tenant_id = get_user_tenant_id(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quote_options qo
    WHERE qo.id = quote_option_legs.quote_option_id
      AND qo.tenant_id = get_user_tenant_id(auth.uid())
  )
);
-- Extend quote_option_legs with leg-specific fields required by business flow

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS service_type_id uuid NULL REFERENCES public.service_types(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS container_type_id uuid NULL REFERENCES public.container_types(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS container_size_id uuid NULL REFERENCES public.container_sizes(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS trade_direction_id uuid NULL REFERENCES public.trade_directions(id);

ALTER TABLE public.quote_option_legs
  ADD COLUMN IF NOT EXISTS leg_currency_id uuid NULL REFERENCES public.currencies(id);

CREATE INDEX IF NOT EXISTS quote_option_legs_trade_dir_idx ON public.quote_option_legs (trade_direction_id);
CREATE INDEX IF NOT EXISTS quote_option_legs_container_idx ON public.quote_option_legs (container_type_id, container_size_id);
CREATE INDEX IF NOT EXISTS quote_option_legs_service_type_idx ON public.quote_option_legs (service_type_id);-- Modify container tables to support global entries and seed data

-- Modify container_types to allow NULL tenant_id for global entries
ALTER TABLE public.container_types 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Modify container_sizes to allow NULL tenant_id for global entries
ALTER TABLE public.container_sizes 
ALTER COLUMN tenant_id DROP NOT NULL;

-- Add unique constraints for code columns if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'container_types_code_key'
      AND conrelid = 'public.container_types'::regclass
  ) THEN
    ALTER TABLE public.container_types DROP CONSTRAINT IF EXISTS container_types_code_key;
ALTER TABLE public.container_types ADD CONSTRAINT container_types_code_key UNIQUE (code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'container_sizes_code_key'
      AND conrelid = 'public.container_sizes'::regclass
  ) THEN
    ALTER TABLE public.container_sizes DROP CONSTRAINT IF EXISTS container_sizes_code_key;
ALTER TABLE public.container_sizes ADD CONSTRAINT container_sizes_code_key UNIQUE (code);
  END IF;
END $$;

-- Update RLS policies for container_types to include global entries
DROP POLICY IF EXISTS "Tenant users can view container types" ON public.container_types;
DROP POLICY IF EXISTS "Tenant users can view container types" ON public.container_types;
CREATE POLICY "Tenant users can view container types" ON public.container_types
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR tenant_id IS NULL);

-- Update RLS policies for container_sizes to include global entries
DROP POLICY IF EXISTS "Tenant users can view container sizes" ON public.container_sizes;
DROP POLICY IF EXISTS "Tenant users can view container sizes" ON public.container_sizes;
CREATE POLICY "Tenant users can view container sizes" ON public.container_sizes
FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR tenant_id IS NULL);

-- Seed global container types
INSERT INTO public.container_types (tenant_id, name, code, is_active)
VALUES
  (NULL, 'Standard Dry', 'dry', true),
  (NULL, 'High Cube', 'hc', true),
  (NULL, 'Reefer (Refrigerated)', 'reefer', true),
  (NULL, 'Open Top', 'open_top', true),
  (NULL, 'Flat Rack', 'flat_rack', true),
  (NULL, 'ISO Tank', 'iso_tank', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active;

-- Seed global container sizes
INSERT INTO public.container_sizes (tenant_id, name, code, description, is_active)
VALUES
  (NULL, '20'' Standard', '20_std', '20-foot standard dry container', true),
  (NULL, '40'' Standard', '40_std', '40-foot standard dry container', true),
  (NULL, '40'' High Cube', '40_hc', '40-foot high cube dry container', true),
  (NULL, '45'' High Cube', '45_hc', '45-foot high cube dry container', true),
  (NULL, '20'' Reefer', '20_reefer', '20-foot refrigerated container', true),
  (NULL, '40'' Reefer', '40_reefer', '40-foot refrigerated container', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active;
-- Normalize service_type_mappings to reference service_types via FK

BEGIN;

-- Add FK column
ALTER TABLE public.service_type_mappings
  ADD COLUMN IF NOT EXISTS service_type_id uuid;

-- Backfill service_type_id by matching existing text to service_types code or name
UPDATE public.service_type_mappings stm
SET service_type_id = st.id
FROM public.service_types st
WHERE stm.service_type_id IS NULL
  AND (
    lower(st.code) = lower(stm.service_type)
    OR lower(st.name) = lower(stm.service_type)
  );

-- Enforce NOT NULL once backfilled
ALTER TABLE public.service_type_mappings
  ALTER COLUMN service_type_id SET NOT NULL;

-- Create unique constraint/index on tenant_id, service_type_id, service_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'service_type_mappings_unique_fk'
  ) THEN
    CREATE UNIQUE INDEX service_type_mappings_unique_fk
      ON public.service_type_mappings(tenant_id, service_type_id, service_id);
  END IF;
END$$;

-- Drop old unique constraint/index on (tenant_id, service_type, service_id) if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_type_mappings_unique_pair'
      AND conrelid = 'public.service_type_mappings'::regclass
  ) THEN
    ALTER TABLE public.service_type_mappings
      DROP CONSTRAINT service_type_mappings_unique_pair;
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'service_type_mappings_unique_pair'
  ) THEN
    DROP INDEX public.service_type_mappings_unique_pair;
  END IF;
END$$;

-- Drop legacy text column to ensure mapping only relies on modules/tables
ALTER TABLE public.service_type_mappings
  DROP COLUMN IF EXISTS service_type;

COMMIT;
-- Seed default service type mappings for tenant 9e2686ba
-- Ocean → International Ocean FCL, FCL (Full Container Load), LCL (Less than Container Load)

DO $$
DECLARE
  v_service_type_id uuid;
  v_service_intl_ocean_fcl uuid;
  v_service_fcl uuid;
  v_service_lcl uuid;
BEGIN
  -- Resolve Ocean service type id
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE lower(st.code) = 'ocean'
     OR lower(st.name) = 'ocean'
  LIMIT 1;

  IF v_service_type_id IS NULL THEN
    RAISE NOTICE 'Ocean service type not found. Skipping seed.';
    RETURN;
  END IF;

  -- Resolve service ids by name (case-insensitive)
  SELECT s.id INTO v_service_intl_ocean_fcl
  FROM public.services s
  WHERE lower(s.service_name) = 'international ocean fcl'
  LIMIT 1;

  SELECT s.id INTO v_service_fcl
  FROM public.services s
  WHERE lower(s.service_name) LIKE 'fcl%'
  LIMIT 1;

  SELECT s.id INTO v_service_lcl
  FROM public.services s
  WHERE lower(s.service_name) LIKE 'lcl%'
  LIMIT 1;

  -- Insert mappings with priorities; prefer International Ocean FCL as default
  IF v_service_intl_ocean_fcl IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    SELECT t.id, v_service_type_id, v_service_intl_ocean_fcl, true, 1, true
    FROM public.tenants t
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service International Ocean FCL not found.';
  END IF;

  IF v_service_fcl IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    SELECT t.id, v_service_type_id, v_service_fcl, false, 2, true
    FROM public.tenants t
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service FCL (Full Container Load) not found.';
  END IF;

  IF v_service_lcl IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    SELECT t.id, v_service_type_id, v_service_lcl, false, 0, true
    FROM public.tenants t
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service LCL (Less than Container Load) not found.';
  END IF;
END$$;
-- Seed default service type mappings for tenant 9e2686ba
-- Air → International Air, Express

DO $$
DECLARE
  v_service_type_id uuid;
  v_service_international_air uuid;
  v_service_express uuid;
BEGIN
  -- Resolve Air service type id
  SELECT st.id INTO v_service_type_id
  FROM public.service_types st
  WHERE lower(st.code) = 'air'
     OR lower(st.name) = 'air'
  LIMIT 1;

  IF v_service_type_id IS NULL THEN
    RAISE NOTICE 'Air service type not found. Skipping seed.';
    RETURN;
  END IF;

  -- Resolve service ids by name (case-insensitive exact or like)
  SELECT s.id INTO v_service_international_air
  FROM public.services s
  WHERE lower(s.service_name) = 'international air'
     OR lower(s.service_name) LIKE 'international air%'
  LIMIT 1;

  SELECT s.id INTO v_service_express
  FROM public.services s
  WHERE lower(s.service_name) = 'express'
     OR lower(s.service_name) LIKE 'express%'
  LIMIT 1;

  -- Insert mappings with priorities; prefer International Air as default
  IF v_service_international_air IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    SELECT t.id, v_service_type_id, v_service_international_air, true, 1, true
    FROM public.tenants t
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service International Air not found.';
  END IF;

  IF v_service_express IS NOT NULL THEN
    INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
    SELECT t.id, v_service_type_id, v_service_express, false, 2, true
    FROM public.tenants t
    ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
  ELSE
    RAISE NOTICE 'Service Express not found.';
  END IF;
END$$;
-- Seed global container types and sizes
-- These entries are tenant-agnostic (tenant_id NULL) and can be
-- referenced by all tenants due to RLS policies that allow NULL tenant_id.

BEGIN;

-- Container Types (global)
INSERT INTO public.container_types (tenant_id, name, code, is_active)
VALUES
  (NULL, 'Standard Dry', 'dry', true),
  (NULL, 'High Cube', 'hc', true),
  (NULL, 'Reefer (Refrigerated)', 'reefer', true),
  (NULL, 'Open Top', 'open_top', true),
  (NULL, 'Flat Rack', 'flat_rack', true),
  (NULL, 'ISO Tank', 'iso_tank', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      is_active = EXCLUDED.is_active;

-- Container Sizes (global)
INSERT INTO public.container_sizes (tenant_id, name, code, description, is_active)
VALUES
  (NULL, '20'' Standard', '20_std', '20-foot standard dry container', true),
  (NULL, '40'' Standard', '40_std', '40-foot standard dry container', true),
  (NULL, '40'' High Cube', '40_hc', '40-foot high cube dry container', true),
  (NULL, '45'' High Cube', '45_hc', '45-foot high cube dry container', true),
  (NULL, '20'' Reefer', '20_reefer', '20-foot refrigerated container', true),
  (NULL, '40'' Reefer', '40_reefer', '40-foot refrigerated container', true)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      is_active = EXCLUDED.is_active;

COMMIT;
-- Geography master tables: continents, countries, states, cities

BEGIN;

-- Continents
CREATE TABLE IF NOT EXISTS public.continents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code_international text UNIQUE,
  code_national text UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Countries
CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  continent_id uuid REFERENCES public.continents(id) ON DELETE SET NULL,
  name text NOT NULL,
  code_iso2 text UNIQUE,
  code_iso3 text UNIQUE,
  code_national text,
  phone_code text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- States/Provinces
CREATE TABLE IF NOT EXISTS public.states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES public.countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  code_iso text,
  code_national text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Cities
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  state_id uuid REFERENCES public.states(id) ON DELETE SET NULL,
  name text NOT NULL,
  code_national text,
  latitude numeric,
  longitude numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_countries_continent ON public.countries (continent_id);
CREATE INDEX IF NOT EXISTS idx_states_country ON public.states (country_id);
CREATE INDEX IF NOT EXISTS idx_cities_state_country ON public.cities (state_id, country_id);

-- Enable RLS
ALTER TABLE public.continents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: read global (tenant_id NULL) or same tenant, manage same tenant
-- Global-only RLS: allow read for authenticated users; manage limited to platform admins
CREATE POLICY continents_read ON public.continents FOR SELECT USING (true);
CREATE POLICY continents_manage ON public.continents FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY countries_read ON public.countries FOR SELECT USING (true);
CREATE POLICY countries_manage ON public.countries FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY states_read ON public.states FOR SELECT USING (true);
CREATE POLICY states_manage ON public.states FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

CREATE POLICY cities_read ON public.cities FOR SELECT USING (true);
CREATE POLICY cities_manage ON public.cities FOR ALL USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));

COMMIT;
-- Seed data for geography master tables: continents, countries, states, cities

BEGIN;

-- Continents (global)
INSERT INTO public.continents (name, code_international, code_national, is_active)
VALUES
  ('Africa', 'AF', NULL, true),
  ('Asia', 'AS', NULL, true),
  ('Europe', 'EU', NULL, true),
  ('North America', 'NA', NULL, true),
  ('South America', 'SA', NULL, true),
  ('Oceania', 'OC', NULL, true),
  ('Antarctica', 'AN', NULL, true)
ON CONFLICT (code_international) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- Countries (global)
INSERT INTO public.countries (continent_id, name, code_iso2, code_iso3, code_national, phone_code, is_active)
VALUES
  ((SELECT id FROM public.continents WHERE code_international = 'NA'), 'United States', 'US', 'USA', NULL, '+1', true),
  ((SELECT id FROM public.continents WHERE code_international = 'NA'), 'Canada', 'CA', 'CAN', NULL, '+1', true),
  ((SELECT id FROM public.continents WHERE code_international = 'EU'), 'United Kingdom', 'GB', 'GBR', NULL, '+44', true),
  ((SELECT id FROM public.continents WHERE code_international = 'AS'), 'India', 'IN', 'IND', NULL, '+91', true),
  ((SELECT id FROM public.continents WHERE code_international = 'AS'), 'China', 'CN', 'CHN', NULL, '+86', true),
  ((SELECT id FROM public.continents WHERE code_international = 'OC'), 'Australia', 'AU', 'AUS', NULL, '+61', true)
ON CONFLICT (code_iso2) DO UPDATE SET name = EXCLUDED.name, continent_id = EXCLUDED.continent_id, is_active = EXCLUDED.is_active;

-- States / Provinces (insert if not exists)
DO $$
DECLARE
  v_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
  v_ca uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CA');
  v_gb uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'GB');
  v_in uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'IN');
  v_cn uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CN');
  v_au uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'AU');
BEGIN
  -- United States
  IF v_us IS NOT NULL THEN
    INSERT INTO public.states (country_id, name, code_iso, code_national, is_active)
    SELECT v_us, s.name, s.code_iso, NULL, true FROM (VALUES
      ('California','CA'),
      ('New York','NY'),
      ('Texas','TX')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canada
  IF v_ca IS NOT NULL THEN
    INSERT INTO public.states (country_id, name, code_iso, code_national, is_active)
    SELECT v_ca, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Ontario','ON'),
      ('British Columbia','BC'),
      ('Quebec','QC')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- United Kingdom
  IF v_gb IS NOT NULL THEN
    INSERT INTO public.states (country_id, name, code_iso, code_national, is_active)
    SELECT v_gb, s.name, s.code_iso, NULL, true FROM (VALUES
      ('England','ENG'),
      ('Scotland','SCT'),
      ('Wales','WLS')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- India
  IF v_in IS NOT NULL THEN
    INSERT INTO public.states (country_id, name, code_iso, code_national, is_active)
    SELECT v_in, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Maharashtra','MH'),
      ('Karnataka','KA'),
      ('Delhi','DL')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- China
  IF v_cn IS NOT NULL THEN
    INSERT INTO public.states (country_id, name, code_iso, code_national, is_active)
    SELECT v_cn, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Guangdong','GD'),
      ('Beijing','BJ'),
      ('Shanghai','SH')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Australia
  IF v_au IS NOT NULL THEN
    INSERT INTO public.states (country_id, name, code_iso, code_national, is_active)
    SELECT v_au, s.name, s.code_iso, NULL, true FROM (VALUES
      ('New South Wales','NSW'),
      ('Victoria','VIC'),
      ('Queensland','QLD')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Cities (insert if not exists)
DO $$
DECLARE
  c_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
  c_ca uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CA');
  c_gb uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'GB');
  c_in uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'IN');
  c_cn uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CN');
  c_au uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'AU');
  s_ca uuid := (SELECT id FROM public.states WHERE name = 'California' AND country_id = c_us);
  s_ny uuid := (SELECT id FROM public.states WHERE name = 'New York' AND country_id = c_us);
  s_on uuid := (SELECT id FROM public.states WHERE name = 'Ontario' AND country_id = c_ca);
  s_bc uuid := (SELECT id FROM public.states WHERE name = 'British Columbia' AND country_id = c_ca);
  s_eng uuid := (SELECT id FROM public.states WHERE name = 'England' AND country_id = c_gb);
  s_mh uuid := (SELECT id FROM public.states WHERE name = 'Maharashtra' AND country_id = c_in);
  s_ka uuid := (SELECT id FROM public.states WHERE name = 'Karnataka' AND country_id = c_in);
  s_gd uuid := (SELECT id FROM public.states WHERE name = 'Guangdong' AND country_id = c_cn);
  s_bj uuid := (SELECT id FROM public.states WHERE name = 'Beijing' AND country_id = c_cn);
  s_nsw uuid := (SELECT id FROM public.states WHERE name = 'New South Wales' AND country_id = c_au);
  s_vic uuid := (SELECT id FROM public.states WHERE name = 'Victoria' AND country_id = c_au);
BEGIN
  -- US
  IF c_us IS NOT NULL THEN
    INSERT INTO public.cities (country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (c_us, s_ca, 'Los Angeles', NULL, 34.0522, -118.2437, true),
      (c_us, s_ny, 'New York', NULL, 40.7128, -74.0060, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canada
  IF c_ca IS NOT NULL THEN
    INSERT INTO public.cities (country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (c_ca, s_on, 'Toronto', NULL, 43.6532, -79.3832, true),
      (c_ca, s_bc, 'Vancouver', NULL, 49.2827, -123.1207, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- UK
  IF c_gb IS NOT NULL THEN
    INSERT INTO public.cities (country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (c_gb, s_eng, 'London', NULL, 51.5074, -0.1278, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- India
  IF c_in IS NOT NULL THEN
    INSERT INTO public.cities (country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (c_in, s_mh, 'Mumbai', NULL, 19.0760, 72.8777, true),
      (c_in, s_ka, 'Bengaluru', NULL, 12.9716, 77.5946, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- China
  IF c_cn IS NOT NULL THEN
    INSERT INTO public.cities (country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (c_cn, s_gd, 'Guangzhou', NULL, 23.1291, 113.2644, true),
      (c_cn, s_bj, 'Beijing', NULL, 39.9042, 116.4074, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Australia
  IF c_au IS NOT NULL THEN
    INSERT INTO public.cities (country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (c_au, s_nsw, 'Sydney', NULL, -33.8688, 151.2093, true),
      (c_au, s_vic, 'Melbourne', NULL, -37.8136, 144.9631, true)
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

COMMIT;
-- Seed all USA states (including District of Columbia) into public.states

BEGIN;

DO $$
DECLARE
  v_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
BEGIN
  IF v_us IS NULL THEN
    RAISE NOTICE 'United States (US) not found in public.countries; skipping states seed.';
    RETURN;
  END IF;

  WITH vals(name, code_iso) AS (
    VALUES
      ('Alabama','AL'),('Alaska','AK'),('Arizona','AZ'),('Arkansas','AR'),('California','CA'),('Colorado','CO'),
      ('Connecticut','CT'),('Delaware','DE'),('Florida','FL'),('Georgia','GA'),('Hawaii','HI'),('Idaho','ID'),
      ('Illinois','IL'),('Indiana','IN'),('Iowa','IA'),('Kansas','KS'),('Kentucky','KY'),('Louisiana','LA'),
      ('Maine','ME'),('Maryland','MD'),('Massachusetts','MA'),('Michigan','MI'),('Minnesota','MN'),('Mississippi','MS'),
      ('Missouri','MO'),('Montana','MT'),('Nebraska','NE'),('Nevada','NV'),('New Hampshire','NH'),('New Jersey','NJ'),
      ('New Mexico','NM'),('New York','NY'),('North Carolina','NC'),('North Dakota','ND'),('Ohio','OH'),('Oklahoma','OK'),
      ('Oregon','OR'),('Pennsylvania','PA'),('Rhode Island','RI'),('South Carolina','SC'),('South Dakota','SD'),('Tennessee','TN'),
      ('Texas','TX'),('Utah','UT'),('Vermont','VT'),('Virginia','VA'),('Washington','WA'),('West Virginia','WV'),('Wisconsin','WI'),('Wyoming','WY'),
      ('District of Columbia','DC')
  )
  INSERT INTO public.states (country_id, name, code_iso, code_national, is_active)
  SELECT v_us, v.name, v.code_iso, NULL, true
  FROM vals v
  LEFT JOIN public.states s
    ON s.country_id = v_us AND s.code_iso = v.code_iso
  WHERE s.id IS NULL;
END$$;

COMMIT;
create table if not exists margin_rules (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references tenants(id) not null,
    name text not null,
    condition_json jsonb not null default '{}'::jsonb,
    adjustment_type text not null check (adjustment_type in ('percent', 'fixed')),
    adjustment_value numeric not null,
    priority int not null default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

alter table margin_rules enable row level security;

DROP POLICY IF EXISTS "Tenants can view their own margin rules" ON margin_rules;
CREATE POLICY "Tenants can view their own margin rules" ON margin_rules for select
    using (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Tenants can manage their own margin rules" ON margin_rules;
CREATE POLICY "Tenants can manage their own margin rules" ON margin_rules for all
    using (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_margin_rules_tenant_id ON margin_rules(tenant_id);
-- Unique indexes for idempotent upserts on geography tables

BEGIN;

-- Ensure states are unique per country by ISO code (if provided)
CREATE UNIQUE INDEX IF NOT EXISTS states_country_iso_unique
ON public.states (country_id, code_iso)
WHERE code_iso IS NOT NULL;

-- Optionally also unique by (country_id, name) to avoid duplicates by name
CREATE UNIQUE INDEX IF NOT EXISTS states_country_name_unique
ON public.states (country_id, name);

-- Ensure cities unique per (country, state, name)
CREATE UNIQUE INDEX IF NOT EXISTS cities_country_state_name_unique
ON public.cities (country_id, state_id, name);

COMMIT;-- Geography master tables: continents, countries, states, cities

BEGIN;

-- Continents
CREATE TABLE IF NOT EXISTS public.continents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL,
  name text NOT NULL,
  code_international text UNIQUE,
  code_national text UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Countries
CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL,
  continent_id uuid REFERENCES public.continents(id) ON DELETE SET NULL,
  name text NOT NULL,
  code_iso2 text UNIQUE,
  code_iso3 text UNIQUE,
  code_national text,
  phone_code text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- States/Provinces
CREATE TABLE IF NOT EXISTS public.states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL,
  country_id uuid REFERENCES public.countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  code_iso text,
  code_national text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Cities
CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  state_id uuid REFERENCES public.states(id) ON DELETE SET NULL,
  name text NOT NULL,
  code_national text,
  latitude numeric,
  longitude numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.continents ADD COLUMN IF NOT EXISTS tenant_id uuid NULL;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS tenant_id uuid NULL;
ALTER TABLE public.states ADD COLUMN IF NOT EXISTS tenant_id uuid NULL;
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS tenant_id uuid NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_countries_continent ON public.countries (continent_id);
CREATE INDEX IF NOT EXISTS idx_states_country ON public.states (country_id);
CREATE INDEX IF NOT EXISTS idx_cities_state_country ON public.cities (state_id, country_id);

-- Enable RLS
ALTER TABLE public.continents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: read global (tenant_id NULL) or same tenant, manage same tenant
DROP POLICY IF EXISTS continents_read ON public.continents;
CREATE POLICY continents_read ON public.continents FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS continents_manage ON public.continents;
CREATE POLICY continents_manage ON public.continents FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS countries_read ON public.countries;
CREATE POLICY countries_read ON public.countries FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS countries_manage ON public.countries;
CREATE POLICY countries_manage ON public.countries FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS states_read ON public.states;
CREATE POLICY states_read ON public.states FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS states_manage ON public.states;
CREATE POLICY states_manage ON public.states FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS cities_read ON public.cities;
CREATE POLICY cities_read ON public.cities FOR SELECT USING (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
DROP POLICY IF EXISTS cities_manage ON public.cities;
CREATE POLICY cities_manage ON public.cities FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid())) WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

COMMIT;
-- Seed data for geography master tables: continents, countries, states, cities

BEGIN;

-- Continents (global)
INSERT INTO public.continents (tenant_id, name, code_international, code_national, is_active)
VALUES
  (NULL, 'Africa', 'AF', NULL, true),
  (NULL, 'Asia', 'AS', NULL, true),
  (NULL, 'Europe', 'EU', NULL, true),
  (NULL, 'North America', 'NA', NULL, true),
  (NULL, 'South America', 'SA', NULL, true),
  (NULL, 'Oceania', 'OC', NULL, true),
  (NULL, 'Antarctica', 'AN', NULL, true)
ON CONFLICT (code_international) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- Countries (global)
INSERT INTO public.countries (tenant_id, continent_id, name, code_iso2, code_iso3, code_national, phone_code, is_active)
VALUES
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'NA'), 'United States', 'US', 'USA', NULL, '+1', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'NA'), 'Canada', 'CA', 'CAN', NULL, '+1', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'EU'), 'United Kingdom', 'GB', 'GBR', NULL, '+44', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'AS'), 'India', 'IN', 'IND', NULL, '+91', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'AS'), 'China', 'CN', 'CHN', NULL, '+86', true),
  (NULL, (SELECT id FROM public.continents WHERE code_international = 'OC'), 'Australia', 'AU', 'AUS', NULL, '+61', true)
ON CONFLICT (code_iso2) DO UPDATE SET name = EXCLUDED.name, continent_id = EXCLUDED.continent_id, is_active = EXCLUDED.is_active;

-- States / Provinces (insert if not exists)
DO $$
DECLARE
  v_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
  v_ca uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CA');
  v_gb uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'GB');
  v_in uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'IN');
  v_cn uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CN');
  v_au uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'AU');
BEGIN
  -- United States
  IF v_us IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_us, s.name, s.code_iso, NULL, true FROM (VALUES
      ('California','CA'),
      ('New York','NY'),
      ('Texas','TX')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canada
  IF v_ca IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_ca, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Ontario','ON'),
      ('British Columbia','BC'),
      ('Quebec','QC')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- United Kingdom
  IF v_gb IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_gb, s.name, s.code_iso, NULL, true FROM (VALUES
      ('England','ENG'),
      ('Scotland','SCT'),
      ('Wales','WLS')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- India
  IF v_in IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_in, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Maharashtra','MH'),
      ('Karnataka','KA'),
      ('Delhi','DL')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- China
  IF v_cn IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_cn, s.name, s.code_iso, NULL, true FROM (VALUES
      ('Guangdong','GD'),
      ('Beijing','BJ'),
      ('Shanghai','SH')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Australia
  IF v_au IS NOT NULL THEN
    INSERT INTO public.states (tenant_id, country_id, name, code_iso, code_national, is_active)
    SELECT NULL, v_au, s.name, s.code_iso, NULL, true FROM (VALUES
      ('New South Wales','NSW'),
      ('Victoria','VIC'),
      ('Queensland','QLD')
    ) AS s(name, code_iso)
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

-- Cities (insert if not exists)
DO $$
DECLARE
  c_us uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'US');
  c_ca uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CA');
  c_gb uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'GB');
  c_in uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'IN');
  c_cn uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'CN');
  c_au uuid := (SELECT id FROM public.countries WHERE code_iso2 = 'AU');
  s_ca uuid := (SELECT id FROM public.states WHERE name = 'California' AND country_id = c_us);
  s_ny uuid := (SELECT id FROM public.states WHERE name = 'New York' AND country_id = c_us);
  s_on uuid := (SELECT id FROM public.states WHERE name = 'Ontario' AND country_id = c_ca);
  s_bc uuid := (SELECT id FROM public.states WHERE name = 'British Columbia' AND country_id = c_ca);
  s_eng uuid := (SELECT id FROM public.states WHERE name = 'England' AND country_id = c_gb);
  s_mh uuid := (SELECT id FROM public.states WHERE name = 'Maharashtra' AND country_id = c_in);
  s_ka uuid := (SELECT id FROM public.states WHERE name = 'Karnataka' AND country_id = c_in);
  s_gd uuid := (SELECT id FROM public.states WHERE name = 'Guangdong' AND country_id = c_cn);
  s_bj uuid := (SELECT id FROM public.states WHERE name = 'Beijing' AND country_id = c_cn);
  s_nsw uuid := (SELECT id FROM public.states WHERE name = 'New South Wales' AND country_id = c_au);
  s_vic uuid := (SELECT id FROM public.states WHERE name = 'Victoria' AND country_id = c_au);
BEGIN
  -- US
  IF c_us IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_us, s_ca, 'Los Angeles', NULL, 34.0522, -118.2437, true),
      (NULL, c_us, s_ny, 'New York', NULL, 40.7128, -74.0060, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Canada
  IF c_ca IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_ca, s_on, 'Toronto', NULL, 43.6532, -79.3832, true),
      (NULL, c_ca, s_bc, 'Vancouver', NULL, 49.2827, -123.1207, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- UK
  IF c_gb IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_gb, s_eng, 'London', NULL, 51.5074, -0.1278, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- India
  IF c_in IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_in, s_mh, 'Mumbai', NULL, 19.0760, 72.8777, true),
      (NULL, c_in, s_ka, 'Bengaluru', NULL, 12.9716, 77.5946, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- China
  IF c_cn IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_cn, s_gd, 'Guangzhou', NULL, 23.1291, 113.2644, true),
      (NULL, c_cn, s_bj, 'Beijing', NULL, 39.9042, 116.4074, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Australia
  IF c_au IS NOT NULL THEN
    INSERT INTO public.cities (tenant_id, country_id, state_id, name, code_national, latitude, longitude, is_active)
    VALUES
      (NULL, c_au, s_nsw, 'Sydney', NULL, -33.8688, 151.2093, true),
      (NULL, c_au, s_vic, 'Melbourne', NULL, -37.8136, 144.9631, true)
    ON CONFLICT DO NOTHING;
  END IF;
END$$;

COMMIT;-- Add unique constraints to geography tables for proper ON CONFLICT handling

-- Add unique constraint to states (country_id + code_iso should be unique)
ALTER TABLE public.states DROP CONSTRAINT IF EXISTS states_country_code_key;
ALTER TABLE public.states ADD CONSTRAINT states_country_code_key UNIQUE (country_id, code_iso);

-- Add unique constraint to cities (country_id + state_id + name should be unique)
ALTER TABLE public.cities DROP CONSTRAINT IF EXISTS cities_country_state_name_key;
ALTER TABLE public.cities ADD CONSTRAINT cities_country_state_name_key UNIQUE (country_id, state_id, name);-- Restructure aes_hts_codes table to include UOM1 and UOM2 for AES filing

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'aes_hts_codes'
  ) THEN
    ALTER TABLE public.aes_hts_codes ADD COLUMN IF NOT EXISTS uom1 VARCHAR(50);
    ALTER TABLE public.aes_hts_codes ADD COLUMN IF NOT EXISTS uom2 VARCHAR(50);

    UPDATE public.aes_hts_codes
    SET uom1 = unit_of_measure
    WHERE unit_of_measure IS NOT NULL AND uom1 IS NULL;

    ALTER TABLE public.aes_hts_codes DROP COLUMN IF EXISTS unit_of_measure;

    COMMENT ON COLUMN public.aes_hts_codes.uom1 IS 'First Unit of Measurement (Primary UOM) for AES filing - e.g., Number, Kilograms, Liters';
    COMMENT ON COLUMN public.aes_hts_codes.uom2 IS 'Second Unit of Measurement (Secondary UOM) for AES filing - optional, e.g., Pairs, Dozens, Square Meters';
  END IF;
END $$;
-- Enable RLS and add policies for aes_hts_codes table

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'aes_hts_codes'
  ) THEN
    ALTER TABLE public.aes_hts_codes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Platform admins can manage all HTS codes" ON public.aes_hts_codes;
    DROP POLICY IF EXISTS "Platform admins can manage all HTS codes" ON public.aes_hts_codes;
CREATE POLICY "Platform admins can manage all HTS codes" ON public.aes_hts_codes
    FOR ALL
    TO authenticated
    USING (is_platform_admin(auth.uid()))
    WITH CHECK (is_platform_admin(auth.uid()));

    DROP POLICY IF EXISTS "Authenticated users can view HTS codes" ON public.aes_hts_codes;
    DROP POLICY IF EXISTS "Authenticated users can view HTS codes" ON public.aes_hts_codes;
CREATE POLICY "Authenticated users can view HTS codes" ON public.aes_hts_codes
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
-- Seed carrier_service_types for globally seeded ocean carriers
-- Ensures Service Provider list populates for Ocean Freight even without explicit mappings
BEGIN;

-- Create mappings for global carriers (tenant_id IS NULL) with carrier_type or mode indicating ocean
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, is_primary, is_active)
SELECT NULL AS tenant_id,
       c.id AS carrier_id,
       'ocean' AS service_type,
       true AS is_primary,
       true AS is_active
FROM public.carriers c
WHERE c.tenant_id IS NULL
  AND (
    lower(coalesce(c.mode::text, '')) = 'ocean'
    OR lower(coalesce(c.carrier_type, '')) = 'ocean'
  )
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

COMMIT;BEGIN;

-- Allow viewing global carriers (tenant_id IS NULL)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'carriers' AND policyname = 'Users can view global carriers'
  ) THEN
    DROP POLICY IF EXISTS "Users can view global carriers" ON public.carriers;
CREATE POLICY "Users can view global carriers" ON public.carriers
    FOR SELECT
    USING (tenant_id IS NULL);
  END IF;
END $$;

-- Allow viewing global carrier/service type mappings (tenant_id IS NULL)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'carrier_service_types' AND policyname = 'Users can view global carrier type mappings'
  ) THEN
    DROP POLICY IF EXISTS "Users can view global carrier type mappings" ON public.carrier_service_types;
CREATE POLICY "Users can view global carrier type mappings" ON public.carrier_service_types
    FOR SELECT
    USING (tenant_id IS NULL);
  END IF;
END $$;

COMMIT;-- Migration 1: Allow global ports (tenant_id NULL) and seed USA/India
-- Makes tenant_id nullable, adds RLS policy, seeds USA and India ports

BEGIN;

-- 1) Make tenant_id nullable to support global entries
ALTER TABLE public.ports_locations
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2) RLS: allow all authenticated users to view global ports
DROP POLICY IF EXISTS "Users can view global ports" ON public.ports_locations;
CREATE POLICY "Users can view global ports" ON public.ports_locations FOR SELECT
  USING (tenant_id IS NULL);

-- 3) Seed global entries (tenant_id = NULL)
-- USA Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Los Angeles International Airport', 'LAX', 'airport', 'USA', 'Los Angeles', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'LAX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'John F. Kennedy International Airport', 'JFK', 'airport', 'USA', 'New York', 'New York', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'JFK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'O''Hare International Airport', 'ORD', 'airport', 'USA', 'Chicago', 'Illinois', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'ORD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'San Francisco International Airport', 'SFO', 'airport', 'USA', 'San Francisco', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SFO');

-- USA Seaports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Los Angeles', 'USLAX', 'seaport', 'USA', 'Los Angeles', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLAX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Long Beach', 'USLGB', 'seaport', 'USA', 'Long Beach', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLGB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of New York and New Jersey', 'USNYC', 'seaport', 'USA', 'New York', 'New York', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USNYC');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Savannah', 'USSAV', 'seaport', 'USA', 'Savannah', 'Georgia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USSAV');

-- USA Inland/Terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chicago Inland Port', 'USCHI', 'inland_port', 'USA', 'Chicago', 'Illinois', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USCHI');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Newark Port Terminal', 'USNWK', 'terminal', 'USA', 'Newark', 'New Jersey', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USNWK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Los Angeles Logistics Hub', 'USLAWH', 'warehouse', 'USA', 'Los Angeles', 'California', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLAWH');

-- India Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Indira Gandhi International Airport', 'DEL', 'airport', 'India', 'Delhi', 'Delhi', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'DEL');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chhatrapati Shivaji Maharaj International Airport', 'BOM', 'airport', 'India', 'Mumbai', 'Maharashtra', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'BOM');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chennai International Airport', 'MAA', 'airport', 'India', 'Chennai', 'Tamil Nadu', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MAA');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Kempegowda International Airport', 'BLR', 'airport', 'India', 'Bengaluru', 'Karnataka', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'BLR');

-- India Seaports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Jawaharlal Nehru Port (Nhava Sheva)', 'INJNP', 'seaport', 'India', 'Navi Mumbai', 'Maharashtra', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INJNP');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chennai Port', 'INMAA', 'seaport', 'India', 'Chennai', 'Tamil Nadu', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMAA');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mundra Port', 'INMUN', 'seaport', 'India', 'Mundra', 'Gujarat', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMUN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Kolkata Port', 'INCCU', 'seaport', 'India', 'Kolkata', 'West Bengal', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INCCU');

-- India Inland/Terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Tughlakabad', 'INTKD', 'terminal', 'India', 'Delhi', 'Delhi', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INTKD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Whitefield', 'INWFD', 'terminal', 'India', 'Bengaluru', 'Karnataka', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INWFD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mumbai Logistics Park', 'INMBWH', 'warehouse', 'India', 'Mumbai', 'Maharashtra', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMBWH');

-- Migration 2: North America and Asia ports
-- Canada Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Toronto Pearson International Airport', 'YYZ', 'airport', 'Canada', 'Toronto', 'Ontario', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YYZ');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Vancouver International Airport', 'YVR', 'airport', 'Canada', 'Vancouver', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YVR');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Montréal–Trudeau International Airport', 'YUL', 'airport', 'Canada', 'Montréal', 'Quebec', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YUL');

-- Canada Seaports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Vancouver', 'CAVAN', 'seaport', 'Canada', 'Vancouver', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAVAN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Montréal', 'CAMTR', 'seaport', 'Canada', 'Montréal', 'Quebec', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAMTR');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Prince Rupert', 'CAPRR', 'seaport', 'Canada', 'Prince Rupert', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAPRR');

-- Mexico Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mexico City International Airport', 'MEX', 'airport', 'Mexico', 'Mexico City', 'Mexico City', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MEX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Monterrey International Airport', 'MTY', 'airport', 'Mexico', 'Monterrey', 'Nuevo León', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MTY');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Guadalajara International Airport', 'GDL', 'airport', 'Mexico', 'Guadalajara', 'Jalisco', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'GDL');

-- Mexico Seaports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Manzanillo', 'MXMZO', 'seaport', 'Mexico', 'Manzanillo', 'Colima', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXMZO');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Veracruz', 'MXVER', 'seaport', 'Mexico', 'Veracruz', 'Veracruz', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXVER');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Lázaro Cárdenas', 'MXLZC', 'seaport', 'Mexico', 'Lázaro Cárdenas', 'Michoacán', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXLZC');

-- Hong Kong
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Hong Kong International Airport', 'HKG', 'airport', 'Hong Kong', 'Hong Kong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HKG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Hong Kong', 'HKHKG', 'seaport', 'Hong Kong', 'Hong Kong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HKHKG');

-- Singapore
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore Changi Airport', 'SIN', 'airport', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SIN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Singapore', 'SGSIN', 'seaport', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN');

-- China
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Shanghai Pudong International Airport', 'PVG', 'airport', 'China', 'Shanghai', 'Shanghai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'PVG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Beijing Capital International Airport', 'PEK', 'airport', 'China', 'Beijing', 'Beijing', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'PEK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Shanghai', 'CNSHG', 'seaport', 'China', 'Shanghai', 'Shanghai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSHG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Ningbo-Zhoushan', 'CNNGB', 'seaport', 'China', 'Ningbo', 'Zhejiang', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNNGB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Yantian (Shenzhen)', 'CNYTN', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNYTN');

-- Japan
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Tokyo Narita International Airport', 'NRT', 'airport', 'Japan', 'Tokyo', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'NRT');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Tokyo Haneda Airport', 'HND', 'airport', 'Japan', 'Tokyo', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HND');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Yokohama', 'JPYOK', 'seaport', 'Japan', 'Yokohama', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'JPYOK');

-- South Korea
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Incheon International Airport', 'ICN', 'airport', 'South Korea', 'Incheon', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'ICN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Busan', 'KRPUS', 'seaport', 'South Korea', 'Busan', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'KRPUS');

-- United Arab Emirates
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Dubai International Airport', 'DXB', 'airport', 'United Arab Emirates', 'Dubai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'DXB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Jebel Ali', 'AEJEA', 'seaport', 'United Arab Emirates', 'Dubai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'AEJEA');

-- Migration 3: Extended additions
-- Canada: YYC
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Calgary International Airport', 'YYC', 'airport', 'Canada', 'Calgary', 'Alberta', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YYC');

-- Mexico: additional terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Manzanillo Terminal (North)', 'MXMZO-T1', 'terminal', 'Mexico', 'Manzanillo', 'Colima', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXMZO-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Veracruz Terminal (Primary)', 'MXVER-T1', 'terminal', 'Mexico', 'Veracruz', 'Veracruz', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXVER-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Lázaro Cárdenas Terminal (APM)', 'MXLZC-T1', 'terminal', 'Mexico', 'Lázaro Cárdenas', 'Michoacán', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXLZC-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Altamira', 'MXATM', 'seaport', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Altamira Terminal (T1)', 'MXATM-T1', 'terminal', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM-T1');

-- Singapore terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 1', 'SGSIN-B1', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 2', 'SGSIN-B2', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B2');

-- Shenzhen variants
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Shenzhen', 'CNSZX', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSZX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Shekou Port (Shenzhen)', 'CNSHK', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSHK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chiwan Port (Shenzhen)', 'CNCWN', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNCWN');

COMMIT;-- Fix quote_charges to support per-leg charges and correct option FK
-- Idempotent guards ensure safe re-application

DO $$
BEGIN
  -- 1) Add leg_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_charges'
      AND column_name = 'leg_id'
  ) THEN
    ALTER TABLE public.quote_charges ADD COLUMN IF NOT EXISTS leg_id uuid NULL;
  END IF;

  -- 2) Attach FK for leg_id to quotation_version_option_legs if not present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_leg_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges ADD CONSTRAINT quote_charges_leg_id_fkey FOREIGN KEY (leg_id)
      REFERENCES public.quotation_version_option_legs(id)
      ON DELETE CASCADE;
  END IF;

  -- 3) Ensure quote_option_id references quotation_version_options, not quote_options
  -- Drop any existing FK on quote_option_id that might point to public.quote_options
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_quote_option_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges
      DROP CONSTRAINT quote_charges_quote_option_id_fkey;
  END IF;

  -- Recreate FK to public.quotation_version_options
  ALTER TABLE public.quote_charges ADD CONSTRAINT quote_charges_quote_option_id_fkey FOREIGN KEY (quote_option_id)
    REFERENCES public.quotation_version_options(id)
    ON DELETE CASCADE;
END $$;

-- Optional: simple tenant RLS alignment (keeps existing if already set)
ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_read'
  ) THEN
    CREATE POLICY quote_charges_read ON public.quote_charges FOR SELECT
      USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_manage'
  ) THEN
    CREATE POLICY quote_charges_manage ON public.quote_charges FOR ALL
      USING (tenant_id = get_user_tenant_id(auth.uid()))
      WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;-- Align quotation_version_options for composer usage
-- Make carrier_rate_id nullable and add totals columns used by UI

DO $$
BEGIN
  -- Drop NOT NULL on carrier_rate_id if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'carrier_rate_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ALTER COLUMN carrier_rate_id DROP NOT NULL;
  END IF;

  -- Add currency and totals columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'quote_currency_id'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS quote_currency_id uuid REFERENCES public.currencies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'buy_subtotal'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS buy_subtotal numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'sell_subtotal'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS sell_subtotal numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'margin_amount'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS margin_amount numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;-- Fix quote_charges to support per-leg charges and correct option FK
-- Idempotent guards ensure safe re-application

DO $$
BEGIN
  -- 1) Add leg_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_charges'
      AND column_name = 'leg_id'
  ) THEN
    ALTER TABLE public.quote_charges ADD COLUMN IF NOT EXISTS leg_id uuid NULL;
  END IF;

  -- 2) Attach FK for leg_id to quotation_version_option_legs if not present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_leg_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges ADD CONSTRAINT quote_charges_leg_id_fkey FOREIGN KEY (leg_id)
      REFERENCES public.quotation_version_option_legs(id)
      ON DELETE CASCADE;
  END IF;

  -- 3) Ensure quote_option_id references quotation_version_options, not quote_options
  -- Drop any existing FK on quote_option_id that might point to public.quote_options
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_quote_option_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges
      DROP CONSTRAINT quote_charges_quote_option_id_fkey;
  END IF;

  -- Recreate FK to public.quotation_version_options
  ALTER TABLE public.quote_charges ADD CONSTRAINT quote_charges_quote_option_id_fkey FOREIGN KEY (quote_option_id)
    REFERENCES public.quotation_version_options(id)
    ON DELETE CASCADE;
END $$;

-- Optional: simple tenant RLS alignment (keeps existing if already set)
ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_read'
  ) THEN
    CREATE POLICY quote_charges_read ON public.quote_charges FOR SELECT
      USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_manage'
  ) THEN
    CREATE POLICY quote_charges_manage ON public.quote_charges FOR ALL
      USING (tenant_id = get_user_tenant_id(auth.uid()))
      WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;-- Align RLS for quotation_version_option_legs with access rules used by options/versions/quotes
-- This resolves scenarios where users can create options (via franchise/tenant rules)
-- but are blocked creating legs due to stricter tenant-only leg policies.

DO $$
BEGIN
  -- Ensure RLS is enabled (idempotent)
  ALTER TABLE public.quotation_version_option_legs ENABLE ROW LEVEL SECURITY;

  -- Create a unified manage policy that allows actions when the parent option/version/quote
  -- is accessible by the current user through tenant membership OR franchise access OR platform admin.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotation_version_option_legs'
      AND policyname = 'quotation_version_option_legs_manage_alignment'
  ) THEN
    DROP POLICY IF EXISTS quotation_version_option_legs_manage_alignment ON public.quotation_version_option_legs;
CREATE POLICY quotation_version_option_legs_manage_alignment ON public.quotation_version_option_legs FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    );
  END IF;

  -- Optional: read policy aligned to the same access surface (keeps existing policies intact)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotation_version_option_legs'
      AND policyname = 'quotation_version_option_legs_read_alignment'
  ) THEN
    DROP POLICY IF EXISTS quotation_version_option_legs_read_alignment ON public.quotation_version_option_legs;
CREATE POLICY quotation_version_option_legs_read_alignment ON public.quotation_version_option_legs FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    );
  END IF;
END $$;-- Add unique constraint to email_accounts to prevent duplicate accounts for the same user and email address
ALTER TABLE public.email_accounts DROP CONSTRAINT IF EXISTS unique_user_email;
ALTER TABLE public.email_accounts ADD CONSTRAINT unique_user_email UNIQUE (user_id, email_address);
-- Create AES HTS Codes management table
-- Includes:
-- - Required fields and types
-- - Format check constraint for hts_code
-- - Uniqueness enforcement for hts_code
-- - Helpful indexes for lookups and search

-- Ensure pgcrypto exists for gen_random_uuid (commonly present)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.aes_hts_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hts_code VARCHAR(15) NOT NULL,
  schedule_b VARCHAR(15),
  category VARCHAR(100) NOT NULL,
  sub_category VARCHAR(100),
  sub_sub_category VARCHAR(100),
  description TEXT NOT NULL,
  unit_of_measure VARCHAR(50),
  duty_rate VARCHAR(50),
  special_provisions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hts_code_format_check CHECK (hts_code ~ '^[0-9]{4}(\.[0-9]{2}){0,3}$')
);

-- Enforce uniqueness of hts_code to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'aes_hts_codes_hts_code_unique'
  ) THEN
    ALTER TABLE public.aes_hts_codes DROP CONSTRAINT IF EXISTS aes_hts_codes_hts_code_unique;
ALTER TABLE public.aes_hts_codes ADD CONSTRAINT aes_hts_codes_hts_code_unique UNIQUE (hts_code);
  END IF;
END$$;

-- Lookup and search indexes
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_hts_code ON public.aes_hts_codes(hts_code);
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_category ON public.aes_hts_codes(category);
CREATE INDEX IF NOT EXISTS idx_aes_hts_codes_description_tsv ON public.aes_hts_codes USING GIN (to_tsvector('english', description));

COMMENT ON COLUMN public.aes_hts_codes.description IS 'Detailed description (required).';-- Seed carrier_service_types for globally seeded ocean carriers
-- Ensures Service Provider list populates for Ocean Freight even without explicit mappings
BEGIN;

-- Create mappings for global carriers (tenant_id IS NULL) with carrier_type or mode indicating ocean
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, is_primary, is_active)
SELECT NULL AS tenant_id,
       c.id AS carrier_id,
       'ocean' AS service_type,
       true AS is_primary,
       true AS is_active
FROM public.carriers c
WHERE c.tenant_id IS NULL
  AND (
    lower(coalesce(c.mode::text, '')) = 'ocean'
    OR lower(coalesce(c.carrier_type, '')) = 'ocean'
  )
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

COMMIT;-- Allow global ports (tenant_id NULL) and seed USA/India
-- This migration:
-- 1) Makes tenant_id nullable on ports_locations
-- 2) Adds a SELECT policy to expose global rows (tenant_id IS NULL)
-- 3) Seeds global ports/airports/terminals for USA and India

BEGIN;

-- 1) Make tenant_id nullable to support global entries
ALTER TABLE public.ports_locations
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2) RLS: allow all authenticated users to view global ports
-- Existing policies restrict SELECT to tenant rows; this adds visibility for global rows.
DROP POLICY IF EXISTS "Users can view global ports" ON public.ports_locations;
DROP POLICY IF EXISTS "Users can view global ports" ON public.ports_locations;
CREATE POLICY "Users can view global ports" ON public.ports_locations FOR SELECT
  USING (tenant_id IS NULL);

-- 3) Seed global entries (tenant_id = NULL)
-- USA Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Los Angeles International Airport', 'LAX', 'airport', 'USA', 'Los Angeles', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'LAX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'John F. Kennedy International Airport', 'JFK', 'airport', 'USA', 'New York', 'New York', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'JFK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'O''Hare International Airport', 'ORD', 'airport', 'USA', 'Chicago', 'Illinois', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'ORD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'San Francisco International Airport', 'SFO', 'airport', 'USA', 'San Francisco', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SFO');

-- USA Seaports (UN/LOCODE approximations)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Los Angeles', 'USLAX', 'seaport', 'USA', 'Los Angeles', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLAX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Long Beach', 'USLGB', 'seaport', 'USA', 'Long Beach', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLGB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of New York and New Jersey', 'USNYC', 'seaport', 'USA', 'New York', 'New York', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USNYC');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Savannah', 'USSAV', 'seaport', 'USA', 'Savannah', 'Georgia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USSAV');

-- USA Inland/Terminals/Warehouses
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chicago Inland Port', 'USCHI', 'inland_port', 'USA', 'Chicago', 'Illinois', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USCHI');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Newark Port Terminal', 'USNWK', 'terminal', 'USA', 'Newark', 'New Jersey', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USNWK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Los Angeles Logistics Hub', 'USLAWH', 'warehouse', 'USA', 'Los Angeles', 'California', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLAWH');

-- India Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Indira Gandhi International Airport', 'DEL', 'airport', 'India', 'Delhi', 'Delhi', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'DEL');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chhatrapati Shivaji Maharaj International Airport', 'BOM', 'airport', 'India', 'Mumbai', 'Maharashtra', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'BOM');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chennai International Airport', 'MAA', 'airport', 'India', 'Chennai', 'Tamil Nadu', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MAA');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Kempegowda International Airport', 'BLR', 'airport', 'India', 'Bengaluru', 'Karnataka', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'BLR');

-- India Seaports (UN/LOCODE approximations)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Jawaharlal Nehru Port (Nhava Sheva)', 'INJNP', 'seaport', 'India', 'Navi Mumbai', 'Maharashtra', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INJNP');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chennai Port', 'INMAA', 'seaport', 'India', 'Chennai', 'Tamil Nadu', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMAA');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mundra Port', 'INMUN', 'seaport', 'India', 'Mundra', 'Gujarat', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMUN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Kolkata Port', 'INCCU', 'seaport', 'India', 'Kolkata', 'West Bengal', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INCCU');

-- India Inland/Terminals/Warehouses
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Tughlakabad', 'INTKD', 'terminal', 'India', 'Delhi', 'Delhi', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INTKD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Whitefield', 'INWFD', 'terminal', 'India', 'Bengaluru', 'Karnataka', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INWFD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mumbai Logistics Park', 'INMBWH', 'warehouse', 'India', 'Mumbai', 'Maharashtra', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMBWH');

COMMIT;
-- Global ports/airports seeding for North America and Asia
-- Adds major hubs for Canada, Mexico, Hong Kong, Singapore, China, Japan, South Korea, UAE
-- All rows are tenant-neutral (tenant_id = NULL) and de-duplicated by location_code.

BEGIN;

-- Canada Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Toronto Pearson International Airport', 'YYZ', 'airport', 'Canada', 'Toronto', 'Ontario', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YYZ');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Vancouver International Airport', 'YVR', 'airport', 'Canada', 'Vancouver', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YVR');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Montréal–Trudeau International Airport', 'YUL', 'airport', 'Canada', 'Montréal', 'Quebec', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YUL');

-- Canada Seaports (UN/LOCODE approximations)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Vancouver', 'CAVAN', 'seaport', 'Canada', 'Vancouver', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAVAN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Montréal', 'CAMTR', 'seaport', 'Canada', 'Montréal', 'Quebec', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAMTR');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Prince Rupert', 'CAPRR', 'seaport', 'Canada', 'Prince Rupert', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAPRR');

-- Mexico Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mexico City International Airport', 'MEX', 'airport', 'Mexico', 'Mexico City', 'Mexico City', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MEX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Monterrey International Airport', 'MTY', 'airport', 'Mexico', 'Monterrey', 'Nuevo León', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MTY');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Guadalajara International Airport', 'GDL', 'airport', 'Mexico', 'Guadalajara', 'Jalisco', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'GDL');

-- Mexico Seaports (UN/LOCODE approximations)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Manzanillo', 'MXMZO', 'seaport', 'Mexico', 'Manzanillo', 'Colima', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXMZO');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Veracruz', 'MXVER', 'seaport', 'Mexico', 'Veracruz', 'Veracruz', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXVER');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Lázaro Cárdenas', 'MXLZC', 'seaport', 'Mexico', 'Lázaro Cárdenas', 'Michoacán', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXLZC');

-- Hong Kong
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Hong Kong International Airport', 'HKG', 'airport', 'Hong Kong', 'Hong Kong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HKG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Hong Kong', 'HKHKG', 'seaport', 'Hong Kong', 'Hong Kong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HKHKG');

-- Singapore
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore Changi Airport', 'SIN', 'airport', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SIN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Singapore', 'SGSIN', 'seaport', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN');

-- China
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Shanghai Pudong International Airport', 'PVG', 'airport', 'China', 'Shanghai', 'Shanghai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'PVG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Beijing Capital International Airport', 'PEK', 'airport', 'China', 'Beijing', 'Beijing', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'PEK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Shanghai', 'CNSHG', 'seaport', 'China', 'Shanghai', 'Shanghai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSHG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Ningbo-Zhoushan', 'CNNGB', 'seaport', 'China', 'Ningbo', 'Zhejiang', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNNGB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Yantian (Shenzhen)', 'CNYTN', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNYTN');

-- Japan
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Tokyo Narita International Airport', 'NRT', 'airport', 'Japan', 'Tokyo', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'NRT');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Tokyo Haneda Airport', 'HND', 'airport', 'Japan', 'Tokyo', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HND');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Yokohama', 'JPYOK', 'seaport', 'Japan', 'Yokohama', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'JPYOK');

-- South Korea
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Incheon International Airport', 'ICN', 'airport', 'South Korea', 'Incheon', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'ICN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Busan', 'KRPUS', 'seaport', 'South Korea', 'Busan', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'KRPUS');

-- United Arab Emirates
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Dubai International Airport', 'DXB', 'airport', 'United Arab Emirates', 'Dubai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'DXB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Jebel Ali', 'AEJEA', 'seaport', 'United Arab Emirates', 'Dubai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'AEJEA');

COMMIT;-- Extended global seeding: NA/Asia additions requested
-- Adds Canada YYC airport, Mexico terminal variants, and Singapore/Shenzhen port variants
-- All rows are global (tenant_id = NULL) and avoid duplicates via location_code checks.

BEGIN;

-- Canada: YYC
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Calgary International Airport', 'YYC', 'airport', 'Canada', 'Calgary', 'Alberta', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YYC');

-- Mexico: additional terminals for major ports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Manzanillo Terminal (North)', 'MXMZO-T1', 'terminal', 'Mexico', 'Manzanillo', 'Colima', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXMZO-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Veracruz Terminal (Primary)', 'MXVER-T1', 'terminal', 'Mexico', 'Veracruz', 'Veracruz', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXVER-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Lázaro Cárdenas Terminal (APM)', 'MXLZC-T1', 'terminal', 'Mexico', 'Lázaro Cárdenas', 'Michoacán', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXLZC-T1');

-- Altamira: add port + terminals (frequent Mexico coverage)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Altamira', 'MXATM', 'seaport', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Altamira Terminal (T1)', 'MXATM-T1', 'terminal', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM-T1');

-- Singapore: SGSIN berths/terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 1', 'SGSIN-B1', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 2', 'SGSIN-B2', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B2');

-- Shenzhen: city code variants and sub-ports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Shenzhen', 'CNSZX', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSZX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Shekou Port (Shenzhen)', 'CNSHK', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSHK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chiwan Port (Shenzhen)', 'CNCWN', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNCWN');

COMMIT;-- Fix quote_charges to support per-leg charges and correct option FK
-- Idempotent guards ensure safe re-application

DO $$
BEGIN
  -- 1) Add leg_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_charges'
      AND column_name = 'leg_id'
  ) THEN
    ALTER TABLE public.quote_charges ADD COLUMN IF NOT EXISTS leg_id uuid NULL;
  END IF;

  -- 2) Attach FK for leg_id to quotation_version_option_legs if not present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_leg_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges ADD CONSTRAINT quote_charges_leg_id_fkey FOREIGN KEY (leg_id)
      REFERENCES public.quotation_version_option_legs(id)
      ON DELETE CASCADE;
  END IF;

  -- 3) Ensure quote_option_id references quotation_version_options, not quote_options
  -- Drop any existing FK on quote_option_id that might point to public.quote_options
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'quote_charges'
      AND c.conname = 'quote_charges_quote_option_id_fkey'
  ) THEN
    ALTER TABLE public.quote_charges
      DROP CONSTRAINT quote_charges_quote_option_id_fkey;
  END IF;

  -- Recreate FK to public.quotation_version_options
  ALTER TABLE public.quote_charges ADD CONSTRAINT quote_charges_quote_option_id_fkey FOREIGN KEY (quote_option_id)
    REFERENCES public.quotation_version_options(id)
    ON DELETE CASCADE;
END $$;

-- Optional: simple tenant RLS alignment (keeps existing if already set)
ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_read'
  ) THEN
    CREATE POLICY quote_charges_read ON public.quote_charges FOR SELECT
      USING (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quote_charges'
      AND policyname = 'quote_charges_manage'
  ) THEN
    CREATE POLICY quote_charges_manage ON public.quote_charges FOR ALL
      USING (tenant_id = get_user_tenant_id(auth.uid()))
      WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
  END IF;
END $$;-- Align quotation_version_options for composer usage
-- Make carrier_rate_id nullable and add totals columns used by UI

DO $$
BEGIN
  -- Drop NOT NULL on carrier_rate_id if present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'carrier_rate_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.quotation_version_options
      ALTER COLUMN carrier_rate_id DROP NOT NULL;
  END IF;

  -- Add currency and totals columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'quote_currency_id'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS quote_currency_id uuid REFERENCES public.currencies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'buy_subtotal'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS buy_subtotal numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'sell_subtotal'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS sell_subtotal numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'margin_amount'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS margin_amount numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotation_version_options' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE public.quotation_version_options ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;-- Align RLS for quotation_version_option_legs with access rules used by options/versions/quotes
-- This resolves scenarios where users can create options (via franchise/tenant rules)
-- but are blocked creating legs due to stricter tenant-only leg policies.

DO $$
BEGIN
  -- Ensure RLS is enabled (idempotent)
  ALTER TABLE public.quotation_version_option_legs ENABLE ROW LEVEL SECURITY;

  -- Create a unified manage policy that allows actions when the parent option/version/quote
  -- is accessible by the current user through tenant membership OR franchise access OR platform admin.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotation_version_option_legs'
      AND policyname = 'quotation_version_option_legs_manage_alignment'
  ) THEN
    DROP POLICY IF EXISTS quotation_version_option_legs_manage_alignment ON public.quotation_version_option_legs;
CREATE POLICY quotation_version_option_legs_manage_alignment ON public.quotation_version_option_legs FOR ALL
    USING (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    );
  END IF;

  -- Optional: read policy aligned to the same access surface (keeps existing policies intact)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotation_version_option_legs'
      AND policyname = 'quotation_version_option_legs_read_alignment'
  ) THEN
    DROP POLICY IF EXISTS quotation_version_option_legs_read_alignment ON public.quotation_version_option_legs;
CREATE POLICY quotation_version_option_legs_read_alignment ON public.quotation_version_option_legs FOR SELECT
    USING (
      EXISTS (
        SELECT 1
        FROM public.quotation_version_options qvo
        JOIN public.quotation_versions qv ON qv.id = qvo.quotation_version_id
        JOIN public.quotes q ON q.id = qv.quote_id
        WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
          AND (
            q.tenant_id = get_user_tenant_id(auth.uid())
            OR q.franchise_id = get_user_franchise_id(auth.uid())
            OR is_platform_admin(auth.uid())
          )
      )
    );
  END IF;
END $$;-- Seed/align ocean sub-service types and optional mappings
-- Adds/updates service_types for Break Bulk, LCL, and RORO with codes

-- Step 1: Ensure service_types has `code` column
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;

-- Step 2: Populate codes for ALL existing records (so we can make it NOT NULL)
UPDATE public.service_types 
SET code = LOWER(REPLACE(name, ' ', '_')) 
WHERE code IS NULL OR code = '';

-- Step 3: Make code NOT NULL first
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Step 4: Now create a complete unique constraint (not partial)
DROP INDEX IF EXISTS service_types_code_unique;
ALTER TABLE public.service_types DROP CONSTRAINT IF EXISTS service_types_code_key;
ALTER TABLE public.service_types ADD CONSTRAINT service_types_code_key UNIQUE (code);

-- Step 5: Now we can safely upsert ocean sub-service types
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

-- Step 6: Add service_type_id to quotation_version_option_legs if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_version_option_legs'
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotation_version_option_legs ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
    
    CREATE INDEX IF NOT EXISTS quotation_version_option_legs_service_type_idx
      ON public.quotation_version_option_legs(service_type_id);
  END IF;
END $$;

-- Step 7: Link services to new service types where names indicate LCL/RORO/Break Bulk
DO $$
DECLARE
  lcl_id uuid;
  roro_id uuid;
  bb_id uuid;
BEGIN
  -- Get the IDs of the newly created service types
  SELECT id INTO lcl_id FROM public.service_types WHERE code = 'ocean_lcl' LIMIT 1;
  SELECT id INTO roro_id FROM public.service_types WHERE code = 'ocean_roro' LIMIT 1;
  SELECT id INTO bb_id FROM public.service_types WHERE code = 'ocean_breakbulk' LIMIT 1;

  -- Update services table if service_type_id column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type_id'
  ) THEN
    -- Update based on service_name containing keywords
    UPDATE public.services 
    SET service_type_id = lcl_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%lcl%';

    UPDATE public.services 
    SET service_type_id = roro_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%roro%';

    UPDATE public.services 
    SET service_type_id = bb_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND (LOWER(service_name) LIKE '%break bulk%' OR LOWER(service_name) LIKE '%break-bulk%');
  END IF;
END $$;-- Seed/align ocean sub-service types and optional mappings
-- Adds/updates service_types for Break Bulk, LCL, and RORO with codes

-- Step 1: Ensure service_types has `code` column
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;

-- Step 2: Populate codes for existing records that don't have one
UPDATE public.service_types 
SET code = LOWER(REPLACE(name, ' ', '_')) 
WHERE code IS NULL OR code = '';

-- Step 3: Make code NOT NULL before creating unique constraint
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Step 4: Create unique constraint (drop existing index first if needed)
DROP INDEX IF EXISTS service_types_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique ON public.service_types(code);

-- Step 5: Now safely upsert ocean sub-service types
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

-- Step 6: Add service_type_id to quotation_version_option_legs if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_version_option_legs'
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotation_version_option_legs ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
    
    CREATE INDEX IF NOT EXISTS quotation_version_option_legs_service_type_idx
      ON public.quotation_version_option_legs(service_type_id);
  END IF;
END $$;

-- Step 7: Link services to new service types
DO $$
DECLARE
  lcl_id uuid;
  roro_id uuid;
  bb_id uuid;
BEGIN
  SELECT id INTO lcl_id FROM public.service_types WHERE code = 'ocean_lcl' LIMIT 1;
  SELECT id INTO roro_id FROM public.service_types WHERE code = 'ocean_roro' LIMIT 1;
  SELECT id INTO bb_id FROM public.service_types WHERE code = 'ocean_breakbulk' LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type_id'
  ) THEN
    UPDATE public.services 
    SET service_type_id = lcl_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%lcl%';

    UPDATE public.services 
    SET service_type_id = roro_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%roro%';

    UPDATE public.services 
    SET service_type_id = bb_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND (LOWER(service_name) LIKE '%break bulk%' OR LOWER(service_name) LIKE '%break-bulk%');
  END IF;
END $$;-- Seed/align ocean sub-service types and optional mappings
-- Adds/updates service_types for Break Bulk, LCL, and RORO with codes

-- Step 1: Ensure service_types has `code` column
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;

-- Step 2: Populate codes for existing records that don't have one
UPDATE public.service_types 
SET code = LOWER(REPLACE(name, ' ', '_')) 
WHERE code IS NULL OR code = '';

-- Step 3: Make code NOT NULL before creating unique constraint
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Step 4: Create unique constraint (drop existing index first if needed)
DROP INDEX IF EXISTS service_types_code_unique;
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique ON public.service_types(code);

-- Step 5: Now safely upsert ocean sub-service types
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name, 
  description = EXCLUDED.description,
  is_active = true;

-- Step 6: Add service_type_id to quotation_version_option_legs if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_version_option_legs'
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotation_version_option_legs ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);
    
    CREATE INDEX IF NOT EXISTS quotation_version_option_legs_service_type_idx
      ON public.quotation_version_option_legs(service_type_id);
  END IF;
END $$;

-- Step 7: Link services to new service types
DO $$
DECLARE
  lcl_id uuid;
  roro_id uuid;
  bb_id uuid;
BEGIN
  SELECT id INTO lcl_id FROM public.service_types WHERE code = 'ocean_lcl' LIMIT 1;
  SELECT id INTO roro_id FROM public.service_types WHERE code = 'ocean_roro' LIMIT 1;
  SELECT id INTO bb_id FROM public.service_types WHERE code = 'ocean_breakbulk' LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type_id'
  ) THEN
    UPDATE public.services 
    SET service_type_id = lcl_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%lcl%';

    UPDATE public.services 
    SET service_type_id = roro_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND LOWER(service_name) LIKE '%roro%';

    UPDATE public.services 
    SET service_type_id = bb_id
    WHERE service_type_id IS NULL 
      AND service_type = 'ocean'
      AND (LOWER(service_name) LIKE '%break bulk%' OR LOWER(service_name) LIKE '%break-bulk%');
  END IF;
END $$;-- Add service_type_id FK to service_type_mappings and create ocean sub-service mappings

-- 1) Add service_type_id column to service_type_mappings
ALTER TABLE public.service_type_mappings 
ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);

-- 2) Create index for lookups
CREATE INDEX IF NOT EXISTS service_type_mappings_service_type_id_idx 
ON public.service_type_mappings(service_type_id);

-- 3) Populate service_type_id based on existing service_type text values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_type_mappings'
      AND column_name = 'service_type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.service_type_mappings stm
      SET service_type_id = st.id
      FROM public.service_types st
      WHERE stm.service_type_id IS NULL
        AND (
          st.code = stm.service_type
          OR LOWER(REPLACE(st.name, ' ', '_')) = LOWER(stm.service_type)
        )
    $sql$;
  END IF;
END $$;

-- 4) Create mappings for ocean sub-services using INSERT with NOT EXISTS checks

-- LCL → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%lcl%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%less%than%container%load%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- LCL → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- RORO → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%roro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%ro/ro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%roll%on%roll%off%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- RORO → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- Break Bulk → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%break bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%break-bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%breakbulk%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- Break Bulk → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_breakbulk')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );
-- Add service_type_id FK and create ocean sub-service mappings using text-based service_type

-- 1) Add service_type_id column for future FK-based lookups
ALTER TABLE public.service_type_mappings 
ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);

CREATE INDEX IF NOT EXISTS service_type_mappings_service_type_id_idx 
ON public.service_type_mappings(service_type_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_type_mappings'
      AND column_name = 'service_type'
  ) THEN
    -- 2) Create unique constraint on text-based columns (tenant_id, service_type, service_id)
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS service_type_mappings_tenant_type_service_text_unique
      ON public.service_type_mappings(tenant_id, service_type, service_id)
    ';

    -- 3) Populate service_type_id for existing records based on service_type text
    UPDATE public.service_type_mappings stm
    SET service_type_id = st.id
    FROM public.service_types st
    WHERE stm.service_type_id IS NULL
      AND (st.code = stm.service_type 
           OR LOWER(REPLACE(st.name, ' ', '_')) = LOWER(stm.service_type));

    -- 4) Create mappings for LCL services
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT s.tenant_id, 'ocean_lcl', s.id, false, 0, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND (LOWER(COALESCE(s.service_name, '')) LIKE '%lcl%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%less%than%container%load%')
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- LCL fallback
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT DISTINCT s.tenant_id, 'ocean_lcl', s.id, false, 10, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl')
      AND NOT EXISTS (
        SELECT 1 FROM public.service_type_mappings m
        WHERE m.tenant_id = s.tenant_id 
          AND m.service_type = 'ocean_lcl'
          AND m.service_id = s.id
      )
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- 5) Create mappings for RORO services
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT s.tenant_id, 'ocean_roro', s.id, false, 0, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND (LOWER(COALESCE(s.service_name, '')) LIKE '%roro%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%ro/ro%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%roll%on%roll%off%')
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- RORO fallback
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT DISTINCT s.tenant_id, 'ocean_roro', s.id, false, 10, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_roro')
      AND NOT EXISTS (
        SELECT 1 FROM public.service_type_mappings m
        WHERE m.tenant_id = s.tenant_id 
          AND m.service_type = 'ocean_roro'
          AND m.service_id = s.id
      )
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- 6) Create mappings for Break Bulk services
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT s.tenant_id, 'ocean_breakbulk', s.id, false, 0, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND (LOWER(COALESCE(s.service_name, '')) LIKE '%break bulk%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%break-bulk%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%breakbulk%')
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- Break Bulk fallback
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT DISTINCT s.tenant_id, 'ocean_breakbulk', s.id, false, 10, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_breakbulk')
      AND NOT EXISTS (
        SELECT 1 FROM public.service_type_mappings m
        WHERE m.tenant_id = s.tenant_id 
          AND m.service_type = 'ocean_breakbulk'
          AND m.service_id = s.id
      )
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- 7) Populate service_type_id for the newly inserted records
    UPDATE public.service_type_mappings stm
    SET service_type_id = st.id
    FROM public.service_types st
    WHERE stm.service_type_id IS NULL
      AND st.code = stm.service_type;
  END IF;
END $$;
-- Add service_type_id FK and create ocean sub-service mappings using text-based service_type

-- 1) Add service_type_id column for future FK-based lookups
ALTER TABLE public.service_type_mappings 
ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);

CREATE INDEX IF NOT EXISTS service_type_mappings_service_type_id_idx 
ON public.service_type_mappings(service_type_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_type_mappings'
      AND column_name = 'service_type'
  ) THEN
    -- 2) Create unique constraint on text-based columns (tenant_id, service_type, service_id)
    CREATE UNIQUE INDEX IF NOT EXISTS service_type_mappings_tenant_type_service_text_unique
    ON public.service_type_mappings(tenant_id, service_type, service_id);

    -- 3) Populate service_type_id for existing records based on service_type text
    UPDATE public.service_type_mappings stm
    SET service_type_id = st.id
    FROM public.service_types st
    WHERE stm.service_type_id IS NULL
      AND (st.code = stm.service_type 
           OR LOWER(REPLACE(st.name, ' ', '_')) = LOWER(stm.service_type));

    -- 4) Create mappings for LCL services
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT s.tenant_id, 'ocean_lcl', s.id, false, 0, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND (LOWER(COALESCE(s.service_name, '')) LIKE '%lcl%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%less%than%container%load%')
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- LCL fallback
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT DISTINCT s.tenant_id, 'ocean_lcl', s.id, false, 10, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl')
      AND NOT EXISTS (
        SELECT 1 FROM public.service_type_mappings m
        WHERE m.tenant_id = s.tenant_id 
          AND m.service_type = 'ocean_lcl'
          AND m.service_id = s.id
      )
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- 5) Create mappings for RORO services
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT s.tenant_id, 'ocean_roro', s.id, false, 0, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND (LOWER(COALESCE(s.service_name, '')) LIKE '%roro%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%ro/ro%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%roll%on%roll%off%')
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- RORO fallback
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT DISTINCT s.tenant_id, 'ocean_roro', s.id, false, 10, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_roro')
      AND NOT EXISTS (
        SELECT 1 FROM public.service_type_mappings m
        WHERE m.tenant_id = s.tenant_id 
          AND m.service_type = 'ocean_roro'
          AND m.service_id = s.id
      )
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- 6) Create mappings for Break Bulk services
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT s.tenant_id, 'ocean_breakbulk', s.id, false, 0, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND (LOWER(COALESCE(s.service_name, '')) LIKE '%break bulk%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%break-bulk%'
           OR LOWER(COALESCE(s.service_name, '')) LIKE '%breakbulk%')
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- Break Bulk fallback
    INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active)
    SELECT DISTINCT s.tenant_id, 'ocean_breakbulk', s.id, false, 10, true
    FROM public.services s
    WHERE s.tenant_id IS NOT NULL
      AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_breakbulk')
      AND NOT EXISTS (
        SELECT 1 FROM public.service_type_mappings m
        WHERE m.tenant_id = s.tenant_id 
          AND m.service_type = 'ocean_breakbulk'
          AND m.service_id = s.id
      )
    ON CONFLICT (tenant_id, service_type, service_id) DO NOTHING;

    -- 7) Populate service_type_id for the newly inserted records
    UPDATE public.service_type_mappings stm
    SET service_type_id = st.id
    FROM public.service_types st
    WHERE stm.service_type_id IS NULL
      AND st.code = stm.service_type;
  END IF;
END $$;
-- Add service_type_id FK to service_type_mappings and create ocean sub-service mappings

-- 1) Add service_type_id column to service_type_mappings
ALTER TABLE public.service_type_mappings 
ADD COLUMN IF NOT EXISTS service_type_id uuid REFERENCES public.service_types(id);

-- 2) Create index for lookups
CREATE INDEX IF NOT EXISTS service_type_mappings_service_type_id_idx 
ON public.service_type_mappings(service_type_id);

-- 3) Populate service_type_id based on existing service_type text values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_type_mappings'
      AND column_name = 'service_type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.service_type_mappings stm
      SET service_type_id = st.id
      FROM public.service_types st
      WHERE stm.service_type_id IS NULL
        AND (
          st.code = stm.service_type
          OR LOWER(REPLACE(st.name, ' ', '_')) = LOWER(stm.service_type)
        )
    $sql$;
  END IF;
END $$;

-- 4) Create mappings for ocean sub-services using INSERT with NOT EXISTS checks

-- LCL → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%lcl%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%less%than%container%load%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- LCL → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- RORO → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%roro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%ro/ro%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%roll%on%roll%off%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- RORO → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- Break Bulk → match service name first (priority 0)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND (LOWER(COALESCE(s.service_name, '')) LIKE '%break bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%break-bulk%'
       OR LOWER(COALESCE(s.service_name, '')) LIKE '%breakbulk%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );

-- Break Bulk → fallback to generic ocean services (priority 10)
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT DISTINCT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND LOWER(COALESCE(s.service_type, '')) IN ('ocean','ocean_freight','ocean_breakbulk')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id 
      AND m.service_type_id = st.id 
      AND m.service_id = s.id
  );
-- Seed/align ocean sub-service types and optional mappings
-- Adds/updates service_types for Break Bulk, LCL, and RORO with codes
-- Optionally links legs (`quotation_version_option_legs`) and services to service_type_id where applicable

BEGIN;

-- Ensure service_types has `code` and uniqueness (idempotent)
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique ON public.service_types(code);
UPDATE public.service_types SET code = LOWER(REPLACE(name, ' ', '_')) WHERE code IS NULL;
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Upsert ocean sub-service types by code
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true;

-- Add service_type_id to the current legs table (quotation_version_option_legs) if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_version_option_legs'
      AND column_name = 'service_type_id'
  ) THEN
    ALTER TABLE public.quotation_version_option_legs ADD COLUMN IF NOT EXISTS service_type_id uuid NULL REFERENCES public.service_types(id);
    CREATE INDEX IF NOT EXISTS quotation_version_option_legs_service_type_idx
      ON public.quotation_version_option_legs(service_type_id);
  END IF;
END $$;

-- Optionally link services to these new service types where names indicate LCL/RORO/Break Bulk
DO $$
DECLARE
  has_mode boolean;
  has_service_name boolean;
  has_service_type_id boolean;
  has_service_type_text boolean;
  lcl_id uuid;
  roro_id uuid;
  bb_id uuid;
BEGIN
  SELECT id INTO lcl_id FROM public.service_types WHERE code = 'ocean_lcl' LIMIT 1;
  SELECT id INTO roro_id FROM public.service_types WHERE code = 'ocean_roro' LIMIT 1;
  SELECT id INTO bb_id FROM public.service_types WHERE code = 'ocean_breakbulk' LIMIT 1;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'mode'
  ) INTO has_mode;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_name'
  ) INTO has_service_name;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type_id'
  ) INTO has_service_type_id;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'service_type'
  ) INTO has_service_type_text;

  IF has_service_type_id AND has_service_name THEN
    IF has_mode THEN
      UPDATE public.services s SET service_type_id = lcl_id
      WHERE s.service_type_id IS NULL
        AND s.mode::text = 'ocean'
        AND lower(coalesce(s.service_name, '')) LIKE '%lcl%';

      UPDATE public.services s SET service_type_id = roro_id
      WHERE s.service_type_id IS NULL
        AND s.mode::text = 'ocean'
        AND lower(coalesce(s.service_name, '')) LIKE '%roro%';

      UPDATE public.services s SET service_type_id = bb_id
      WHERE s.service_type_id IS NULL
        AND s.mode::text = 'ocean'
        AND (
          lower(coalesce(s.service_name, '')) LIKE '%break bulk%'
          OR lower(coalesce(s.service_name, '')) LIKE '%break-bulk%'
        );
    ELSIF has_service_type_text THEN
      UPDATE public.services s SET service_type_id = lcl_id
      WHERE s.service_type_id IS NULL
        AND s.service_type = 'ocean'
        AND lower(coalesce(s.service_name, '')) LIKE '%lcl%';

      UPDATE public.services s SET service_type_id = roro_id
      WHERE s.service_type_id IS NULL
        AND s.service_type = 'ocean'
        AND lower(coalesce(s.service_name, '')) LIKE '%roro%';

      UPDATE public.services s SET service_type_id = bb_id
      WHERE s.service_type_id IS NULL
        AND s.service_type = 'ocean'
        AND (
          lower(coalesce(s.service_name, '')) LIKE '%break bulk%'
          OR lower(coalesce(s.service_name, '')) LIKE '%break-bulk%'
        );
    END IF;
  END IF;
END $$;

COMMIT;
-- Map Ocean sub-services (Break Bulk, LCL, RORO) to service_type_mappings
-- Idempotently ensures service_types exist and creates tenant-scoped mappings
-- so Quote Composer can reflect these service types via FK lookups.

BEGIN;

-- 1) Ensure service_types has codes and entries for the three sub-services
ALTER TABLE public.service_types ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS service_types_code_unique ON public.service_types(code);
UPDATE public.service_types SET code = LOWER(REPLACE(name, ' ', '_')) WHERE code IS NULL;
ALTER TABLE public.service_types ALTER COLUMN code SET NOT NULL;

-- Upsert service types by code
INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('Break Bulk', 'ocean_breakbulk', 'Ocean break bulk (non-containerized)', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('LCL', 'ocean_lcl', 'Less than container load ocean freight', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

INSERT INTO public.service_types (name, code, description, is_active)
VALUES ('RORO', 'ocean_roro', 'Roll-on/roll-off vehicle cargo', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true;

-- Fetch IDs for later use
WITH st AS (
  SELECT id, code FROM public.service_types WHERE code IN ('ocean_breakbulk','ocean_lcl','ocean_roro')
)
SELECT 1;

-- 2) Create mappings for tenant services: pattern-first, with safe fallbacks to generic ocean
-- Assumptions:
-- - services.service_name contains the human label (used by UI)
-- - services.service_type contains broad mode values like 'ocean', 'ocean_freight', 'ocean_lcl', 'ocean_roro'
-- - service_type_mappings has been normalized to use service_type_id (FK) and unique index (tenant_id, service_type_id, service_id)

-- LCL → match name first
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND (lower(coalesce(s.service_name, '')) LIKE '%lcl%'
       OR lower(coalesce(s.service_name, '')) LIKE '%less%than%container%load%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- LCL → fallback to generic ocean services where no explicit LCL match exists
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_lcl'
WHERE s.tenant_id IS NOT NULL
  AND lower(coalesce(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- RORO → match name first
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND (lower(coalesce(s.service_name, '')) LIKE '%roro%'
       OR lower(coalesce(s.service_name, '')) LIKE '%ro/ro%'
       OR lower(coalesce(s.service_name, '')) LIKE '%roll%on%roll%off%')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- RORO → fallback to generic ocean services where no explicit RORO match exists
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_roro'
WHERE s.tenant_id IS NOT NULL
  AND lower(coalesce(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- Break Bulk → match name first
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 0, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND (
    lower(coalesce(s.service_name, '')) LIKE '%break bulk%'
    OR lower(coalesce(s.service_name, '')) LIKE '%break-bulk%'
    OR lower(coalesce(s.service_name, '')) LIKE '%breakbulk%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id AND m.service_id = s.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;

-- Break Bulk → fallback to generic ocean services where no explicit Break Bulk match exists
INSERT INTO public.service_type_mappings (tenant_id, service_type_id, service_id, is_default, priority, is_active)
SELECT s.tenant_id, st.id, s.id, false, 10, true
FROM public.services s
JOIN public.service_types st ON st.code = 'ocean_breakbulk'
WHERE s.tenant_id IS NOT NULL
  AND lower(coalesce(s.service_type, '')) IN ('ocean','ocean_freight','ocean_lcl','ocean_roro')
  AND NOT EXISTS (
    SELECT 1 FROM public.service_type_mappings m
    WHERE m.tenant_id = s.tenant_id AND m.service_type_id = st.id
  )
ON CONFLICT (tenant_id, service_type_id, service_id) DO NOTHING;
