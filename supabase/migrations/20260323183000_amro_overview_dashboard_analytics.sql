-- DB-VERIFICATION: amro-overview-dashboard-analytics-reviewed
-- DB-ARCH-APPROVAL: amro-overview-dashboard-analytics-approved

CREATE TABLE IF NOT EXISTS public.amro_overview_kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  persona text NOT NULL CHECK (persona IN ('management', 'planner', 'compliance_lead')),
  date_range_start date NOT NULL,
  date_range_end date NOT NULL CHECK (date_range_end >= date_range_start),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  open_work_orders integer NOT NULL DEFAULT 0 CHECK (open_work_orders >= 0),
  in_progress_tasks integer NOT NULL DEFAULT 0 CHECK (in_progress_tasks >= 0),
  deferred_items integer NOT NULL DEFAULT 0 CHECK (deferred_items >= 0),
  compliance_alerts integer NOT NULL DEFAULT 0 CHECK (compliance_alerts >= 0),
  aog_count integer NOT NULL DEFAULT 0 CHECK (aog_count >= 0),
  sla_breach_count integer NOT NULL DEFAULT 0 CHECK (sla_breach_count >= 0),
  risk_heatmap jsonb NOT NULL DEFAULT '{}'::jsonb,
  trend_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  anomaly_alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  cache_fresh_until timestamptz,
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_amro_overview_kpi_snapshots_scope_persona_window
  ON public.amro_overview_kpi_snapshots(
    tenant_id,
    franchise_id,
    persona,
    date_range_start,
    date_range_end,
    snapshot_at
  );
CREATE INDEX IF NOT EXISTS idx_amro_overview_kpi_snapshots_tenant_snapshot_desc
  ON public.amro_overview_kpi_snapshots(tenant_id, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS public.amro_sla_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  sla_code text NOT NULL,
  service_tier text NOT NULL,
  metric_key text NOT NULL,
  comparator text NOT NULL CHECK (comparator IN ('gte', 'lte', 'eq')),
  target_value numeric(12, 4) NOT NULL,
  evaluation_window_minutes integer NOT NULL CHECK (evaluation_window_minutes > 0),
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date CHECK (effective_to IS NULL OR effective_to >= effective_from),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_amro_sla_definitions_scope_code
  ON public.amro_sla_definitions(
    tenant_id,
    franchise_id,
    sla_code
  );
CREATE INDEX IF NOT EXISTS idx_amro_sla_definitions_tenant_active
  ON public.amro_sla_definitions(tenant_id, is_active)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.amro_operational_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  source_record_key text NOT NULL,
  telemetry_source text NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric(14, 4) NOT NULL,
  metric_unit text,
  recorded_at timestamptz NOT NULL,
  seasonal_bucket text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_operational_telemetry_scope_metric_time
  ON public.amro_operational_telemetry(tenant_id, metric_key, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_amro_operational_telemetry_work_order
  ON public.amro_operational_telemetry(work_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_amro_operational_telemetry_scope_record_key
  ON public.amro_operational_telemetry(
    tenant_id,
    franchise_id,
    source_record_key
  );

CREATE TABLE IF NOT EXISTS public.amro_compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  obligation_id uuid REFERENCES public.compliance_obligations(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  maintenance_event_id uuid REFERENCES public.maintenance_events(id) ON DELETE SET NULL,
  event_code text NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  event_status text NOT NULL DEFAULT 'open' CHECK (event_status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_amro_compliance_events_scope_detected_desc
  ON public.amro_compliance_events(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_amro_compliance_events_scope_status_severity
  ON public.amro_compliance_events(tenant_id, event_status, severity);
CREATE UNIQUE INDEX IF NOT EXISTS uq_amro_compliance_events_scope_event_code
  ON public.amro_compliance_events(
    tenant_id,
    franchise_id,
    event_code
  );

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'amro_overview_kpi_snapshots',
    'amro_sla_definitions',
    'amro_operational_telemetry',
    'amro_compliance_events'
  ];
BEGIN
  FOREACH target_table IN ARRAY target_tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('DROP POLICY IF EXISTS amro_platform_admin_access ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY amro_platform_admin_access ON public.%I
      FOR ALL
      TO authenticated
      USING (public.is_platform_admin(auth.uid()))
      WITH CHECK (public.is_platform_admin(auth.uid()))',
      target_table
    );
    EXECUTE format('DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY amro_tenant_franchise_scope ON public.%I
      FOR ALL
      TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.get_user_franchise_id(auth.uid()) IS NULL
          OR franchise_id IS NULL
          OR franchise_id = public.get_user_franchise_id(auth.uid())
        )
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
          public.get_user_franchise_id(auth.uid()) IS NULL
          OR franchise_id IS NULL
          OR franchise_id = public.get_user_franchise_id(auth.uid())
        )
      )',
      target_table
    );
  END LOOP;
END
$$;
