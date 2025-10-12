-- Carrier Rate & Quotation Management Module (idempotent)
-- Core schema: carrier rates, charges, attachments, quotation versions, options, selections

BEGIN;

-- ===============
-- Charge Type Master
-- ===============
CREATE TABLE IF NOT EXISTS public.charge_types (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed standard charge types
INSERT INTO public.charge_types (code, name, description)
VALUES
  ('OFT', 'Ocean Freight', 'Base ocean freight'),
  ('AFT', 'Air Freight', 'Base air freight'),
  ('THC', 'Terminal Handling', 'Origin/Destination terminal handling'),
  ('BAF', 'Bunker Adjustment', 'Fuel surcharge'),
  ('CAF', 'Currency Adjustment', 'Currency fluctuation'),
  ('DOC', 'Documentation', 'Documentation fees'),
  ('AMS', 'Automated Manifest System', 'AMS filing'),
  ('ISF', 'Importer Security Filing', 'ISF filing'),
  ('ISPS', 'International Ship & Port Security', 'ISPS surcharge')
ON CONFLICT (code) DO NOTHING;

-- ===============
-- Carrier Rates
-- ===============
-- Extend existing carrier_rates table with module-specific columns
ALTER TABLE public.carrier_rates
  ADD COLUMN IF NOT EXISTS carrier_id uuid REFERENCES public.carriers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS origin_port_id uuid REFERENCES public.ports_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_port_id uuid REFERENCES public.ports_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS container_category_id uuid REFERENCES public.package_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS container_size_id uuid REFERENCES public.package_sizes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_name text,
  ADD COLUMN IF NOT EXISTS scac_code text,
  ADD COLUMN IF NOT EXISTS vessel_flight_no text,
  ADD COLUMN IF NOT EXISTS rate_reference_id text,
  ADD COLUMN IF NOT EXISTS exchange_rate numeric,
  ADD COLUMN IF NOT EXISTS markup_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charges_subtotal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS etd date,
  ADD COLUMN IF NOT EXISTS eta date,
  ADD COLUMN IF NOT EXISTS sailing_frequency text,
  ADD COLUMN IF NOT EXISTS cut_off_date date,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS free_time_days integer,
  ADD COLUMN IF NOT EXISTS demurrage_rate numeric,
  ADD COLUMN IF NOT EXISTS detention_rate numeric,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active','expiring','expired','removed','selected')),
  ADD COLUMN IF NOT EXISTS removed_reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_carrier_rates_route ON public.carrier_rates(origin_port_id, destination_port_id);
CREATE INDEX IF NOT EXISTS idx_carrier_rates_carrier ON public.carrier_rates(carrier_id);

-- RLS
ALTER TABLE public.carrier_rates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rates' AND policyname = 'Platform admins manage all carrier rates'
  ) THEN
    CREATE POLICY "Platform admins manage all carrier rates"
      ON public.carrier_rates FOR ALL
      USING (public.is_platform_admin(auth.uid()))
      WITH CHECK (public.is_platform_admin(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rates' AND policyname = 'Tenant admins manage tenant carrier rates'
  ) THEN
    CREATE POLICY "Tenant admins manage tenant carrier rates"
      ON public.carrier_rates FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rates' AND policyname = 'Users can view tenant carrier rates'
  ) THEN
    CREATE POLICY "Users can view tenant carrier rates"
      ON public.carrier_rates FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Charges
CREATE TABLE IF NOT EXISTS public.carrier_rate_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  carrier_rate_id uuid NOT NULL REFERENCES public.carrier_rates(id) ON DELETE CASCADE,
  charge_type text NOT NULL REFERENCES public.charge_types(code) ON UPDATE CASCADE,
  basis text,
  quantity numeric DEFAULT 1,
  amount numeric NOT NULL,
  currency text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carrier_rate_charges_rate ON public.carrier_rate_charges(carrier_rate_id);
ALTER TABLE public.carrier_rate_charges ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_charges' AND policyname = 'Manage charges by tenant admins'
  ) THEN
    CREATE POLICY "Manage charges by tenant admins"
      ON public.carrier_rate_charges FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_charges' AND policyname = 'Users can view tenant charges'
  ) THEN
    CREATE POLICY "Users can view tenant charges"
      ON public.carrier_rate_charges FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Attachments
CREATE TABLE IF NOT EXISTS public.carrier_rate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  carrier_rate_id uuid NOT NULL REFERENCES public.carrier_rates(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.carrier_rate_attachments ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_attachments' AND policyname = 'Manage attachments by tenant admins'
  ) THEN
    CREATE POLICY "Manage attachments by tenant admins"
      ON public.carrier_rate_attachments FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'carrier_rate_attachments' AND policyname = 'Users can view tenant attachments'
  ) THEN
    CREATE POLICY "Users can view tenant attachments"
      ON public.carrier_rate_attachments FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Totals recalculation trigger for charges
CREATE OR REPLACE FUNCTION public.recalc_carrier_rate_total_trigger()
RETURNS trigger
AS $$
BEGIN
  IF TG_OP IN ('INSERT','UPDATE','DELETE') THEN
    UPDATE public.carrier_rates r
    SET charges_subtotal = (
      SELECT COALESCE(SUM(c.amount * COALESCE(c.quantity, 1)), 0)
      FROM public.carrier_rate_charges c
      WHERE c.carrier_rate_id = COALESCE(NEW.carrier_rate_id, OLD.carrier_rate_id)
    ),
    total_amount = COALESCE(base_rate, 0) + COALESCE(markup_amount, 0) + (
      SELECT COALESCE(SUM(c.amount * COALESCE(c.quantity, 1)), 0)
      FROM public.carrier_rate_charges c
      WHERE c.carrier_rate_id = COALESCE(NEW.carrier_rate_id, OLD.carrier_rate_id)
    ),
    updated_at = now()
    WHERE r.id = COALESCE(NEW.carrier_rate_id, OLD.carrier_rate_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_total_on_charge_ins ON public.carrier_rate_charges;
CREATE TRIGGER trg_recalc_total_on_charge_ins
  AFTER INSERT ON public.carrier_rate_charges
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_total_trigger();

DROP TRIGGER IF EXISTS trg_recalc_total_on_charge_upd ON public.carrier_rate_charges;
CREATE TRIGGER trg_recalc_total_on_charge_upd
  AFTER UPDATE ON public.carrier_rate_charges
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_total_trigger();

DROP TRIGGER IF EXISTS trg_recalc_total_on_charge_del ON public.carrier_rate_charges;
CREATE TRIGGER trg_recalc_total_on_charge_del
  AFTER DELETE ON public.carrier_rate_charges
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_total_trigger();

-- Recalc totals when base or markup changes
CREATE OR REPLACE FUNCTION public.recalc_carrier_rate_on_rate_update()
RETURNS trigger
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.charges_subtotal := (
      SELECT COALESCE(SUM(c.amount * COALESCE(c.quantity, 1)), 0)
      FROM public.carrier_rate_charges c
      WHERE c.carrier_rate_id = NEW.id
    );
    NEW.total_amount := COALESCE(NEW.base_rate, 0) + COALESCE(NEW.markup_amount, 0) + COALESCE(NEW.charges_subtotal, 0);
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_total_on_rate_upd ON public.carrier_rates;
CREATE TRIGGER trg_recalc_total_on_rate_upd
  BEFORE UPDATE ON public.carrier_rates
  FOR EACH ROW EXECUTE FUNCTION public.recalc_carrier_rate_on_rate_update();

-- ===============
-- Quotation Versioning & Selection
-- ===============
CREATE TABLE IF NOT EXISTS public.quotation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  major integer NOT NULL DEFAULT 1,
  minor integer NOT NULL DEFAULT 0,
  change_reason text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','selected','archived')),
  valid_until date,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_version ON public.quotation_versions(quote_id, major, minor);
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_versions' AND policyname = 'Tenant admins manage quotation versions'
  ) THEN
    CREATE POLICY "Tenant admins manage quotation versions"
      ON public.quotation_versions FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_versions' AND policyname = 'Users can view quotation versions'
  ) THEN
    CREATE POLICY "Users can view quotation versions"
      ON public.quotation_versions FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quotation_version_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quotation_version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  carrier_rate_id uuid NOT NULL REFERENCES public.carrier_rates(id) ON DELETE RESTRICT,
  recommended boolean DEFAULT false,
  notes text,
  total_amount numeric,
  transit_days integer,
  status text DEFAULT 'active' CHECK (status IN ('active','removed','selected')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qvo_version ON public.quotation_version_options(quotation_version_id);
ALTER TABLE public.quotation_version_options ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_version_options' AND policyname = 'Tenant admins manage version options'
  ) THEN
    CREATE POLICY "Tenant admins manage version options"
      ON public.quotation_version_options FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_version_options' AND policyname = 'Users can view version options'
  ) THEN
    CREATE POLICY "Users can view version options"
      ON public.quotation_version_options FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Populate option summary fields from carrier_rate
CREATE OR REPLACE FUNCTION public.populate_option_from_rate()
RETURNS trigger
AS $$
DECLARE
  v_total numeric;
  v_transit integer;
BEGIN
  SELECT r.total_amount, r.transit_time_days INTO v_total, v_transit
  FROM public.carrier_rates r WHERE r.id = NEW.carrier_rate_id;
  NEW.total_amount := v_total;
  NEW.transit_days := v_transit;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_qvo_populate ON public.quotation_version_options;
CREATE TRIGGER trg_qvo_populate
  BEFORE INSERT ON public.quotation_version_options
  FOR EACH ROW EXECUTE FUNCTION public.populate_option_from_rate();

-- Selection events
CREATE TABLE IF NOT EXISTS public.quotation_selection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quotation_version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  selected_option_id uuid NOT NULL REFERENCES public.quotation_version_options(id) ON DELETE RESTRICT,
  reason text,
  selected_by uuid,
  selected_at timestamptz DEFAULT now()
);
ALTER TABLE public.quotation_selection_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_selection_events' AND policyname = 'Tenant admins manage selection events'
  ) THEN
    CREATE POLICY "Tenant admins manage selection events"
      ON public.quotation_selection_events FOR ALL
      USING (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()))
      WITH CHECK (public.has_role(auth.uid(), 'tenant_admin'::public.app_role) AND tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotation_selection_events' AND policyname = 'Users can view selection events'
  ) THEN
    CREATE POLICY "Users can view selection events"
      ON public.quotation_selection_events FOR SELECT
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

-- Helper: record customer selection and update statuses
CREATE OR REPLACE FUNCTION public.record_customer_selection(
  p_tenant_id uuid,
  p_quote_id uuid,
  p_version_id uuid,
  p_option_id uuid,
  p_reason text,
  p_user_id uuid
) RETURNS void
AS $$
BEGIN
  INSERT INTO public.quotation_selection_events (tenant_id, quote_id, quotation_version_id, selected_option_id, reason, selected_by)
  VALUES (p_tenant_id, p_quote_id, p_version_id, p_option_id, p_reason, p_user_id);

  -- Mark selected option and carrier rate
  UPDATE public.quotation_version_options SET status = 'selected' WHERE id = p_option_id;
  UPDATE public.carrier_rates r
  SET status = 'selected'
  WHERE r.id = (SELECT carrier_rate_id FROM public.quotation_version_options WHERE id = p_option_id);

  -- Set other options in the version to removed
  UPDATE public.quotation_version_options SET status = 'removed'
  WHERE quotation_version_id = p_version_id AND id <> p_option_id;

  -- Update version status
  UPDATE public.quotation_versions SET status = 'selected' WHERE id = p_version_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;