-- Main Template foundation for multi-rate options, multi-mode legs, and charge matrices.

CREATE TABLE IF NOT EXISTS public.quotation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_version_id uuid REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  template_name text NOT NULL DEFAULT 'Main-Template',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_version_id uuid REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.quotation_templates(id) ON DELETE SET NULL,
  option_name text,
  carrier_name text NOT NULL,
  transit_time_days integer,
  frequency_per_week integer,
  mode text NOT NULL DEFAULT 'multimodal',
  equipment_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  remarks text,
  status text NOT NULL DEFAULT 'draft',
  total_by_equipment jsonb NOT NULL DEFAULT '{}'::jsonb,
  grand_total numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_option_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_option_id uuid NOT NULL REFERENCES public.rate_options(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  sequence_no integer NOT NULL,
  transport_mode text NOT NULL,
  leg_type text NOT NULL DEFAULT 'transport',
  origin_code text,
  destination_code text,
  origin_name text,
  destination_name text,
  carrier_name text,
  transit_days integer,
  frequency_per_week integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_option_legs_transport_mode_check CHECK (transport_mode IN ('air', 'ocean', 'road', 'rail')),
  CONSTRAINT rate_option_legs_unique_seq UNIQUE (rate_option_id, sequence_no)
);

CREATE TABLE IF NOT EXISTS public.rate_charge_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_option_id uuid NOT NULL REFERENCES public.rate_options(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  row_code text,
  row_name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  basis text NOT NULL DEFAULT 'all_inclusive',
  include_in_total boolean NOT NULL DEFAULT true,
  remarks text,
  sort_order integer NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_charge_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_row_id uuid NOT NULL REFERENCES public.rate_charge_rows(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  equipment_key text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_charge_cells_unique_equipment UNIQUE (charge_row_id, equipment_key)
);

CREATE TABLE IF NOT EXISTS public.rate_option_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_option_id uuid NOT NULL REFERENCES public.rate_options(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  revision_no integer NOT NULL,
  event_type text NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_option_history_unique_revision UNIQUE (rate_option_id, revision_no)
);

CREATE TABLE IF NOT EXISTS public.quotation_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_version_id uuid REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  rate_option_id uuid REFERENCES public.rate_options(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid,
  actor_email text,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quotation_templates_tenant_quote ON public.quotation_templates (tenant_id, quote_id);
CREATE INDEX IF NOT EXISTS idx_rate_options_quote_version ON public.rate_options (quote_id, quote_version_id);
CREATE INDEX IF NOT EXISTS idx_rate_option_legs_option ON public.rate_option_legs (rate_option_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_rate_charge_rows_option ON public.rate_charge_rows (rate_option_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_rate_charge_cells_row ON public.rate_charge_cells (charge_row_id, equipment_key);
CREATE INDEX IF NOT EXISTS idx_rate_option_history_option ON public.rate_option_history (rate_option_id, revision_no DESC);
CREATE INDEX IF NOT EXISTS idx_quotation_audit_quote_version ON public.quotation_audit_logs (quote_id, quote_version_id, created_at DESC);

CREATE OR REPLACE VIEW public.rate_matrix_view AS
 SELECT
   o.id AS rate_option_id,
   o.tenant_id,
   o.quote_id,
   o.quote_version_id,
   o.template_id,
   o.option_name,
   o.carrier_name,
   o.transit_time_days,
   o.frequency_per_week,
   o.mode,
   o.equipment_columns,
   o.remarks,
   o.status,
   o.total_by_equipment,
   o.grand_total,
   o.created_by,
   o.updated_by,
   o.created_at,
   o.updated_at,
   jsonb_agg(
     jsonb_build_object(
       'id', l.id,
       'sequence_no', l.sequence_no,
       'transport_mode', l.transport_mode,
       'leg_type', l.leg_type,
       'origin_code', l.origin_code,
       'destination_code', l.destination_code,
       'origin_name', l.origin_name,
       'destination_name', l.destination_name,
       'carrier_name', l.carrier_name,
       'transit_days', l.transit_days,
       'frequency_per_week', l.frequency_per_week,
       'metadata', l.metadata
     ) ORDER BY l.sequence_no
   ) FILTER (WHERE l.id IS NOT NULL) AS legs,
   jsonb_agg(
     jsonb_build_object(
       'id', r.id,
       'row_code', r.row_code,
       'row_name', r.row_name,
       'currency', r.currency,
       'basis', r.basis,
       'include_in_total', r.include_in_total,
       'remarks', r.remarks,
       'sort_order', r.sort_order,
       'values_by_equipment', (
         SELECT jsonb_object_agg(c.equipment_key, c.amount)
         FROM public.rate_charge_cells c
         WHERE c.charge_row_id = r.id
       )
     ) ORDER BY r.sort_order
   ) FILTER (WHERE r.id IS NOT NULL) AS charge_rows
 FROM public.rate_options o
 LEFT JOIN public.rate_option_legs l ON l.rate_option_id = o.id
 LEFT JOIN public.rate_charge_rows r ON r.rate_option_id = o.id
 GROUP BY o.id;

CREATE OR REPLACE VIEW public.quotation_version_options_compat AS
SELECT
  o.id,
  o.quote_version_id AS quotation_version_id,
  o.option_name,
  o.carrier_name,
  o.transit_time_days,
  o.frequency_per_week,
  o.grand_total AS total_amount,
  o.status,
  o.created_at,
  o.updated_at,
  o.tenant_id
FROM public.rate_options o;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_option_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_charge_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_charge_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_option_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'templates',
      'rate_options',
       'rate_option_legs',
       'rate_charge_rows',
       'rate_charge_cells',
       'rate_option_history',
       'quotation_audit_logs'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select_policy" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_modify_policy" ON public.%I', tbl);

    EXECUTE format(
      'CREATE POLICY "tenant_select_policy" ON public.%I FOR SELECT USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()))',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY "tenant_modify_policy" ON public.%I FOR ALL USING (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid())) WITH CHECK (tenant_id IN (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()))',
      tbl
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_options TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_option_legs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_charge_rows TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_charge_cells TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_option_history TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_audit_logs TO authenticated, service_role;
GRANT SELECT ON public.rate_matrix_view TO authenticated, service_role;
GRANT SELECT ON public.quotation_version_options_compat TO authenticated, service_role;
