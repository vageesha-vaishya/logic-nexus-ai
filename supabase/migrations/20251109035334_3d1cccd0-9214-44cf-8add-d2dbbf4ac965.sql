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
CREATE POLICY quotation_version_option_legs_read ON public.quotation_version_option_legs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotation_version_options qvo
    WHERE qvo.id = quotation_version_option_legs.quotation_version_option_id
      AND qvo.tenant_id = get_user_tenant_id(auth.uid())
  )
);

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
);