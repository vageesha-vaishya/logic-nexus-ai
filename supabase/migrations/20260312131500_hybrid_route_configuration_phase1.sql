BEGIN;

CREATE TABLE IF NOT EXISTS public.quote_route_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quotation_version_id uuid NOT NULL REFERENCES public.quotation_versions(id) ON DELETE CASCADE,
  quotation_version_option_id uuid NOT NULL REFERENCES public.quotation_version_options(id) ON DELETE CASCADE,
  route_mode text NOT NULL DEFAULT 'smart' CHECK (route_mode IN ('smart', 'manual', 'hybrid')),
  route_source text NOT NULL DEFAULT 'legacy_migration',
  route_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  route_hash text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quotation_version_option_id)
);

CREATE INDEX IF NOT EXISTS idx_quote_route_configurations_quote
  ON public.quote_route_configurations (quote_id, quotation_version_id);
CREATE INDEX IF NOT EXISTS idx_quote_route_configurations_tenant_created
  ON public.quote_route_configurations (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.quote_generation_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  request_id text NOT NULL,
  mode text NOT NULL,
  smart_mode boolean NOT NULL DEFAULT false,
  duration_ms numeric NOT NULL,
  total_options integer NOT NULL DEFAULT 0,
  issues_count integer NOT NULL DEFAULT 0,
  unknown_carrier_count integer NOT NULL DEFAULT 0,
  route_gap_count integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  error_message text,
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_generation_metrics_tenant_created
  ON public.quote_generation_metrics (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quote_generation_metrics_request
  ON public.quote_generation_metrics (request_id);

ALTER TABLE public.quote_route_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_generation_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY quote_route_configurations_read ON public.quote_route_configurations
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY quote_route_configurations_write ON public.quote_route_configurations
    FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()))
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY quote_generation_metrics_read ON public.quote_generation_metrics
    FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY quote_generation_metrics_write ON public.quote_generation_metrics
    FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()))
    WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.app_feature_flags (flag_key, is_enabled, description)
VALUES
  ('hybrid_route_configuration_v1', false, 'Enable hybrid route recompute for Smart Quote and manual overrides'),
  ('hybrid_route_metrics_dashboard_v1', false, 'Enable quote generation performance dashboard and telemetry')
ON CONFLICT (flag_key) DO UPDATE
SET description = EXCLUDED.description;

CREATE OR REPLACE FUNCTION public.migrate_legacy_quotes_to_hybrid_route_config(p_tenant_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted_rows integer := 0;
BEGIN
  INSERT INTO public.quote_route_configurations (
    tenant_id,
    quote_id,
    quotation_version_id,
    quotation_version_option_id,
    route_mode,
    route_source,
    route_snapshot,
    validation_snapshot,
    created_by
  )
  SELECT
    qvo.tenant_id,
    qv.quote_id,
    qv.id,
    qvo.id,
    'hybrid',
    'legacy_migration',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'leg_order', qvol.sort_order,
            'mode', sm.code,
            'origin', qvol.origin_location,
            'destination', qvol.destination_location,
            'carrier_id', qvol.provider_id,
            'carrier_name', c.carrier_name,
            'departure_date', qvol.planned_departure,
            'arrival_date', qvol.planned_arrival
          )
          ORDER BY qvol.sort_order
        )
        FROM public.quotation_version_option_legs qvol
        LEFT JOIN public.service_modes sm ON sm.id = qvol.mode_id
        LEFT JOIN public.carriers c ON c.id = qvol.provider_id
        WHERE qvol.quotation_version_option_id = qvo.id
      ),
      '[]'::jsonb
    ),
    jsonb_build_object(
      'migrated_at', now(),
      'carrier_rate_id', to_jsonb(qvo)->>'carrier_rate_id',
      'option_name', qvo.option_name
    ),
    qv.created_by
  FROM public.quotation_version_options qvo
  JOIN public.quotation_versions qv
    ON qv.id = qvo.quotation_version_id
  WHERE (p_tenant_id IS NULL OR qvo.tenant_id = p_tenant_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.quote_route_configurations qrc
      WHERE qrc.quotation_version_option_id = qvo.id
    );

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;
  RETURN inserted_rows;
END;
$$;

SELECT public.migrate_legacy_quotes_to_hybrid_route_config(NULL);

COMMIT;
