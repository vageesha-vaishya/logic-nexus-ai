-- DB-VERIFICATION: amro-expanded-schema-controls-reviewed
-- DB-ARCH-APPROVAL: amro-lld-20-expanded-schema-controls-approved

CREATE TABLE IF NOT EXISTS public.work_order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  template_code text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  active boolean NOT NULL DEFAULT true,
  template_name text NOT NULL,
  maintenance_type public.maintenance_type NOT NULL,
  scope_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  tasks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  policy_snapshot_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_order_templates_tenant_franchise_code_version
  ON public.work_order_templates(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), template_code, version);
CREATE INDEX IF NOT EXISTS idx_work_order_templates_tenant_active
  ON public.work_order_templates(tenant_id, active)
  WHERE deleted_at IS NULL AND active = true;

CREATE TABLE IF NOT EXISTS public.policy_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  policy_type text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  policy_key text NOT NULL,
  rules_json jsonb NOT NULL,
  effective_at timestamptz NOT NULL,
  superseded_at timestamptz,
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_policy_snapshots_tenant_franchise_type_version
  ON public.policy_snapshots(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), policy_type, version);
CREATE UNIQUE INDEX IF NOT EXISTS uq_policy_snapshots_tenant_franchise_policy_key
  ON public.policy_snapshots(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), policy_key);
CREATE INDEX IF NOT EXISTS idx_policy_snapshots_tenant_effective_at
  ON public.policy_snapshots(tenant_id, effective_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_work_order_templates_policy_snapshot'
      AND conrelid = 'public.work_order_templates'::regclass
  ) THEN
    ALTER TABLE public.work_order_templates
      ADD CONSTRAINT fk_work_order_templates_policy_snapshot
      FOREIGN KEY (policy_snapshot_id) REFERENCES public.policy_snapshots(id) ON DELETE SET NULL
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.sync_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  conflict_ref text NOT NULL,
  conflict_class text NOT NULL,
  local_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  remote_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolution text NOT NULL DEFAULT 'pending' CHECK (resolution IN ('pending', 'manual_required', 'resolved_local', 'resolved_remote', 'merged', 'discarded')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_conflicts_tenant_franchise_conflict_ref
  ON public.sync_conflicts(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), conflict_ref);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_active_resolution
  ON public.sync_conflicts(tenant_id, detected_at DESC)
  WHERE deleted_at IS NULL AND resolution IN ('pending', 'manual_required');

CREATE TABLE IF NOT EXISTS public.regulator_dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  regulator_code text NOT NULL,
  dossier_ref text NOT NULL,
  dossier_uri text,
  manifest_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected', 'superseded')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_regulator_dossiers_tenant_franchise_regulator_ref
  ON public.regulator_dossiers(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), regulator_code, dossier_ref);
CREATE INDEX IF NOT EXISTS idx_regulator_dossiers_tenant_work_order
  ON public.regulator_dossiers(tenant_id, work_order_id);

CREATE TABLE IF NOT EXISTS public.forecast_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  asset_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  feature_vector jsonb NOT NULL,
  inference_time timestamptz NOT NULL,
  feature_hash text NOT NULL,
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_forecast_features_tenant_franchise_asset_inference
  ON public.forecast_features(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), asset_id, inference_time);
CREATE INDEX IF NOT EXISTS idx_forecast_features_tenant_asset_time_desc
  ON public.forecast_features(tenant_id, asset_id, inference_time DESC);

CREATE TABLE IF NOT EXISTS public.forecast_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  recommendation_id uuid NOT NULL REFERENCES public.forecast_outputs(id) ON DELETE CASCADE,
  policy_snapshot_id uuid REFERENCES public.policy_snapshots(id) ON DELETE RESTRICT,
  accepted boolean NOT NULL,
  outcome_metric numeric(10,2),
  outcome_notes text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_forecast_decisions_tenant_franchise_recommendation
  ON public.forecast_decisions(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), recommendation_id);
CREATE INDEX IF NOT EXISTS idx_forecast_decisions_tenant_decided_at_desc
  ON public.forecast_decisions(tenant_id, decided_at DESC);

CREATE TABLE IF NOT EXISTS public.task_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  maintenance_event_id uuid REFERENCES public.maintenance_events(id) ON DELETE SET NULL,
  evidence_type text NOT NULL,
  uri text NOT NULL,
  checksum text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  captured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

DO $$
DECLARE
  start_month date := date_trunc('month', now())::date;
  next_month date := (date_trunc('month', now()) + interval '1 month')::date;
  month_after_next date := (date_trunc('month', now()) + interval '2 month')::date;
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.task_evidence_%s PARTITION OF public.task_evidence FOR VALUES FROM (%L) TO (%L)',
    to_char(start_month, 'YYYYMM'),
    start_month::text,
    next_month::text
  );
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS public.task_evidence_%s PARTITION OF public.task_evidence FOR VALUES FROM (%L) TO (%L)',
    to_char(next_month, 'YYYYMM'),
    next_month::text,
    month_after_next::text
  );
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_task_evidence_tenant_franchise_task_integrity
  ON public.task_evidence(tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), task_id, evidence_type, checksum, captured_at);
CREATE INDEX IF NOT EXISTS idx_task_evidence_tenant_task_captured_desc
  ON public.task_evidence(tenant_id, task_id, captured_at DESC);

ALTER TABLE public.compliance_records
  ADD COLUMN IF NOT EXISTS policy_snapshot_id uuid REFERENCES public.policy_snapshots(id) ON DELETE RESTRICT;
ALTER TABLE public.certification_actions
  ADD COLUMN IF NOT EXISTS policy_snapshot_id uuid REFERENCES public.policy_snapshots(id) ON DELETE RESTRICT;

ALTER TABLE public.compliance_records
  DROP CONSTRAINT IF EXISTS ck_compliance_records_policy_snapshot_required;
ALTER TABLE public.compliance_records
  ADD CONSTRAINT ck_compliance_records_policy_snapshot_required
  CHECK (
    decision_status = 'pending'
    OR policy_snapshot_id IS NOT NULL
  );

ALTER TABLE public.certification_actions
  DROP CONSTRAINT IF EXISTS ck_certification_actions_policy_snapshot_required;
ALTER TABLE public.certification_actions
  ADD CONSTRAINT ck_certification_actions_policy_snapshot_required
  CHECK (
    action_status <> 'executed'
    OR policy_snapshot_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_tasks_active_statuses
  ON public.tasks(tenant_id, work_order_id, planned_start_date)
  WHERE deleted_at IS NULL AND status IN ('pending', 'not_started', 'in_progress', 'on_hold');
CREATE INDEX IF NOT EXISTS idx_compliance_obligations_active_statuses
  ON public.compliance_obligations(tenant_id, due_date)
  WHERE deleted_at IS NULL AND status IN ('open', 'in_progress', 'blocked', 'overdue');

CREATE OR REPLACE FUNCTION public.amro_prevent_mutation_on_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_amro_policy_snapshots_immutable ON public.policy_snapshots;
CREATE TRIGGER trg_amro_policy_snapshots_immutable
  BEFORE UPDATE OR DELETE ON public.policy_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.amro_prevent_mutation_on_immutable();

DROP TRIGGER IF EXISTS trg_amro_task_evidence_immutable ON public.task_evidence;
CREATE TRIGGER trg_amro_task_evidence_immutable
  BEFORE UPDATE OR DELETE ON public.task_evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.amro_prevent_mutation_on_immutable();

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'work_order_templates',
    'task_evidence',
    'policy_snapshots',
    'sync_conflicts',
    'regulator_dossiers',
    'forecast_features',
    'forecast_decisions'
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
