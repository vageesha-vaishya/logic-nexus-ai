-- Master tables (no enums) for quotation system
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
    ALTER TABLE public.charge_categories ADD COLUMN tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'charge_bases' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.charge_bases ADD COLUMN tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'charge_sides' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.charge_sides ADD COLUMN tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'currencies' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.currencies ADD COLUMN tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_types' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.container_types ADD COLUMN tenant_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'container_sizes' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.container_sizes ADD COLUMN tenant_id uuid;
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
