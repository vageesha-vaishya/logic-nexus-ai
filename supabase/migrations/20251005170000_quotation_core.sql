DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'transport_mode' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.transport_mode AS ENUM ('ocean','air','inland_trucking','courier','movers_packers');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['ocean','air','inland_trucking','courier','movers_packers'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'transport_mode' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.transport_mode ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'contract_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.contract_type AS ENUM ('spot','contracted');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['spot','contracted'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'contract_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.contract_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'quote_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.quote_status AS ENUM ('draft','sent','accepted','expired','cancelled');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['draft','sent','accepted','expired','cancelled'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'quote_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.quote_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'compliance_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.compliance_status AS ENUM ('pass','warn','fail');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['pass','warn','fail'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'compliance_status' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.compliance_status ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

DO $$
DECLARE lbl text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'document_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.document_type AS ENUM ('commercial_invoice','bill_of_lading','air_waybill','packing_list','customs_form','quote_pdf');
  ELSE
    FOREACH lbl IN ARRAY ARRAY['commercial_invoice','bill_of_lading','air_waybill','packing_list','customs_form','quote_pdf'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'document_type' AND n.nspname = 'public' AND e.enumlabel = lbl
      ) THEN
        EXECUTE 'ALTER TYPE public.document_type ADD VALUE ' || quote_literal(lbl) || ';';
      END IF;
    END LOOP;
  END IF;
END $$;

-- Carriers
CREATE TABLE public.carriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  mode public.transport_mode NOT NULL,
  name text NOT NULL,
  scac text,
  iata text,
  mc_dot text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

-- Services
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  mode public.transport_mode NOT NULL,
  name text NOT NULL,
  description text,
  transit_profile jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Service Details (mode-specific attributes)
CREATE TABLE public.service_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  attributes jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.service_details ENABLE ROW LEVEL SECURITY;

-- Rates
CREATE TABLE public.rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  mode public.transport_mode NOT NULL,
  carrier_id uuid REFERENCES public.carriers(id) ON DELETE SET NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  validity_start date,
  validity_end date,
  contract_type public.contract_type NOT NULL,
  base_price numeric,
  currency text DEFAULT 'USD',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX rates_lane_idx ON public.rates (mode, origin, destination);
CREATE INDEX rates_validity_idx ON public.rates (validity_start, validity_end);
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;

-- Rate Components (surcharges/accessorials)
CREATE TABLE public.rate_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  rate_id uuid NOT NULL REFERENCES public.rates(id) ON DELETE CASCADE,
  component_type text NOT NULL,
  calc_method text NOT NULL, -- flat | percent | per_unit
  value numeric NOT NULL,
  min_amount numeric,
  max_amount numeric,
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.rate_components ENABLE ROW LEVEL SECURITY;

-- Quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  franchise_id uuid,
  quote_number text UNIQUE,
  customer_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status public.quote_status DEFAULT 'draft'::public.quote_status,
  version_current integer DEFAULT 1,
  total numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'customer_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS quotes_customer_idx ON public.quotes (customer_id);
  END IF;
END $$;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Quote Items
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  mode public.transport_mode NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  dims jsonb, -- dimensions and units
  weight jsonb, -- weight and units
  incoterms text,
  base_cost numeric DEFAULT 0,
  surcharges_total numeric DEFAULT 0,
  accessorials_total numeric DEFAULT 0,
  total numeric DEFAULT 0,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX quote_items_quote_idx ON public.quote_items (quote_id);
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Quote Versions (snapshot)
CREATE TABLE public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  total numeric,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX quote_versions_unique ON public.quote_versions (quote_id, version_number);
ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;

-- Quote Events (audit)
CREATE TABLE public.quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- created | sent | revised | approved | converted | cancelled
  actor_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX quote_events_quote_idx ON public.quote_events (quote_id);
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;

-- Compliance Checks
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  mode public.transport_mode NOT NULL,
  checklist jsonb NOT NULL,
  status public.compliance_status NOT NULL,
  messages jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

-- Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  type public.document_type NOT NULL,
  status text DEFAULT 'generated',
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be added in a subsequent migration to match tenant scoping.