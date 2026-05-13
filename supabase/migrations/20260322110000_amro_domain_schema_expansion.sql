-- DB-VERIFICATION: amro-domain-schema-expansion-reviewed
-- DB-ARCH-APPROVAL: amro-lld-6-1-alignment-approved

CREATE TABLE IF NOT EXISTS public.component_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  position_code text NOT NULL,
  position_name text,
  station_code text,
  installed_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  installation_work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  removal_work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_component_positions_active_component
  ON public.component_positions(component_id)
  WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_component_positions_tenant_id ON public.component_positions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_component_positions_aircraft_id ON public.component_positions(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_component_positions_position_code ON public.component_positions(position_code);

CREATE TABLE IF NOT EXISTS public.shift_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  station_code text NOT NULL,
  shift_name text NOT NULL,
  shift_start_time time NOT NULL,
  shift_end_time time NOT NULL,
  capacity integer NOT NULL DEFAULT 1 CHECK (capacity > 0),
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_shift_calendars_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_shift_calendars_unique_shift
  ON public.shift_calendars(tenant_id, station_code, shift_name, effective_from);
CREATE INDEX IF NOT EXISTS idx_shift_calendars_tenant_id ON public.shift_calendars(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_calendars_station_code ON public.shift_calendars(station_code);

CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  shift_calendar_id uuid REFERENCES public.shift_calendars(id) ON DELETE SET NULL,
  station_code text NOT NULL,
  slot_start timestamptz NOT NULL,
  slot_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'in_progress', 'completed', 'cancelled', 'replanned')),
  priority integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  assigned_staff_count integer NOT NULL DEFAULT 0 CHECK (assigned_staff_count >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_schedules_slot_window CHECK (slot_end > slot_start)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_schedules_work_order_slot
  ON public.schedules(tenant_id, work_order_id, slot_start);
CREATE INDEX IF NOT EXISTS idx_schedules_tenant_id ON public.schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_work_order_id ON public.schedules(work_order_id);
CREATE INDEX IF NOT EXISTS idx_schedules_slot_window ON public.schedules(slot_start, slot_end);

CREATE TABLE IF NOT EXISTS public.schedule_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  schedule_id uuid NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  constraint_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'blocker')),
  rule_expression jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_satisfied boolean NOT NULL DEFAULT false,
  violation_count integer NOT NULL DEFAULT 0 CHECK (violation_count >= 0),
  last_evaluated_at timestamptz,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_constraints_tenant_id ON public.schedule_constraints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedule_constraints_schedule_id ON public.schedule_constraints(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_constraints_type ON public.schedule_constraints(constraint_type);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  supplier_code text NOT NULL,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  lead_time_days integer CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
  rating numeric(4, 2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_suppliers_tenant_code UNIQUE (tenant_id, supplier_code)
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);

CREATE TABLE IF NOT EXISTS public.parts_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  part_number text NOT NULL,
  serial_number text,
  description text,
  component_id uuid REFERENCES public.components(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  warehouse_location text NOT NULL,
  quantity_on_hand integer NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved integer NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_available integer GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  reorder_level integer NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  reorder_quantity integer NOT NULL DEFAULT 0 CHECK (reorder_quantity >= 0),
  unit_cost numeric(12, 2),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'low_stock', 'reserved', 'quarantined', 'unserviceable')),
  last_movement_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_parts_inventory_reserved_not_exceed_on_hand CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_parts_inventory_unique_item
  ON public.parts_inventory(tenant_id, part_number, COALESCE(serial_number, ''), warehouse_location);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_id ON public.parts_inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_part_number ON public.parts_inventory(part_number);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_supplier_id ON public.parts_inventory(supplier_id);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_status ON public.parts_inventory(status);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('receipt', 'issue', 'transfer', 'adjustment', 'return', 'scrap')),
  quantity integer NOT NULL CHECK (quantity > 0),
  from_location text,
  to_location text,
  reference_type text,
  reference_id uuid,
  moved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  movement_timestamp timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON public.stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_id ON public.stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_timestamp ON public.stock_movements(movement_timestamp);

CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  reserved_quantity integer NOT NULL CHECK (reserved_quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'released', 'expired', 'cancelled')),
  reserved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant_id ON public.reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservations_inventory_id ON public.reservations(inventory_id);
CREATE INDEX IF NOT EXISTS idx_reservations_work_order_id ON public.reservations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);

CREATE TABLE IF NOT EXISTS public.regulator_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  regulator_code text NOT NULL,
  regulator_name text NOT NULL,
  jurisdiction text NOT NULL,
  policy_version text NOT NULL,
  effective_from date NOT NULL DEFAULT current_date,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_regulator_profiles_tenant_code UNIQUE (tenant_id, regulator_code),
  CONSTRAINT ck_regulator_profiles_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_regulator_profiles_tenant_id ON public.regulator_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regulator_profiles_jurisdiction ON public.regulator_profiles(jurisdiction);

CREATE TABLE IF NOT EXISTS public.compliance_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  regulator_profile_id uuid REFERENCES public.regulator_profiles(id) ON DELETE SET NULL,
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  obligation_code text NOT NULL,
  obligation_type text NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'completed', 'waived', 'overdue')),
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_compliance_obligations_tenant_code UNIQUE (tenant_id, obligation_code)
);

CREATE INDEX IF NOT EXISTS idx_compliance_obligations_tenant_id ON public.compliance_obligations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_obligations_due_date ON public.compliance_obligations(due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_obligations_status ON public.compliance_obligations(status);

CREATE TABLE IF NOT EXISTS public.compliance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  obligation_id uuid NOT NULL REFERENCES public.compliance_obligations(id) ON DELETE CASCADE,
  maintenance_event_id uuid REFERENCES public.maintenance_events(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  decision_status text NOT NULL CHECK (decision_status IN ('approved', 'rejected', 'deferred', 'waived', 'pending')),
  decision_reason text,
  evidence_reference text,
  evidence_hash text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_records_tenant_id ON public.compliance_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_obligation_id ON public.compliance_records(obligation_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_status ON public.compliance_records(decision_status);

CREATE TABLE IF NOT EXISTS public.certification_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  staff_qualification_id uuid NOT NULL REFERENCES public.staff_qualifications(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('approve', 'reject', 'defer', 'revoke', 'suspend', 'reinstate')),
  action_status text NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending', 'executed', 'cancelled')),
  action_notes text,
  authority_scope text,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certification_actions_tenant_id ON public.certification_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_certification_actions_staff_qualification_id ON public.certification_actions(staff_qualification_id);
CREATE INDEX IF NOT EXISTS idx_certification_actions_status ON public.certification_actions(action_status);

CREATE TABLE IF NOT EXISTS public.integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  source_system text NOT NULL,
  target_system text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'retrying', 'cancelled')),
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb,
  error_message text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  next_retry_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_integration_jobs_tenant_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_jobs_tenant_id ON public.integration_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_status ON public.integration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_integration_jobs_source_system ON public.integration_jobs(source_system);

CREATE TABLE IF NOT EXISTS public.integration_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  source_system text NOT NULL,
  source_entity text NOT NULL,
  source_key text NOT NULL,
  target_table text NOT NULL,
  target_column text NOT NULL,
  mapping_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_integration_mappings_unique_rule UNIQUE (tenant_id, source_system, source_entity, source_key, target_table, target_column)
);

CREATE INDEX IF NOT EXISTS idx_integration_mappings_tenant_id ON public.integration_mappings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_mappings_source ON public.integration_mappings(source_system, source_entity);

CREATE TABLE IF NOT EXISTS public.webhook_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  integration_job_id uuid REFERENCES public.integration_jobs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  endpoint_url text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  response_status_code integer,
  response_body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_outbox_tenant_id ON public.webhook_outbox(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_status ON public.webhook_outbox(status);
CREATE INDEX IF NOT EXISTS idx_webhook_outbox_next_attempt ON public.webhook_outbox(next_attempt_at);

CREATE TABLE IF NOT EXISTS public.asset_health_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  component_id uuid REFERENCES public.components(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  signal_source text NOT NULL,
  signal_timestamp timestamptz NOT NULL DEFAULT now(),
  value_numeric numeric(14, 4),
  value_text text,
  unit text,
  quality_score numeric(5, 2) CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_health_signals_tenant_id ON public.asset_health_signals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_health_signals_aircraft_id ON public.asset_health_signals(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_asset_health_signals_component_id ON public.asset_health_signals(component_id);
CREATE INDEX IF NOT EXISTS idx_asset_health_signals_timestamp ON public.asset_health_signals(signal_timestamp);

CREATE TABLE IF NOT EXISTS public.forecast_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid REFERENCES public.aircraft(id) ON DELETE SET NULL,
  component_id uuid REFERENCES public.components(id) ON DELETE SET NULL,
  signal_id uuid REFERENCES public.asset_health_signals(id) ON DELETE SET NULL,
  forecast_type text NOT NULL,
  prediction_window_hours integer NOT NULL CHECK (prediction_window_hours > 0),
  risk_score numeric(5, 2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  confidence_score numeric(5, 2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  recommendation text,
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  accepted boolean,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecast_outputs_tenant_id ON public.forecast_outputs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forecast_outputs_aircraft_id ON public.forecast_outputs(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_forecast_outputs_component_id ON public.forecast_outputs(component_id);
CREATE INDEX IF NOT EXISTS idx_forecast_outputs_generated_at ON public.forecast_outputs(generated_at);
CREATE INDEX IF NOT EXISTS idx_forecast_outputs_risk_score ON public.forecast_outputs(risk_score);

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'component_positions',
    'schedules',
    'schedule_constraints',
    'shift_calendars',
    'parts_inventory',
    'stock_movements',
    'reservations',
    'suppliers',
    'compliance_obligations',
    'compliance_records',
    'regulator_profiles',
    'certification_actions',
    'integration_jobs',
    'integration_mappings',
    'webhook_outbox',
    'asset_health_signals',
    'forecast_outputs'
  ];
BEGIN
  FOREACH target_table IN ARRAY target_tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    EXECUTE format('DROP POLICY IF EXISTS amro_platform_admin ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY amro_platform_admin ON public.%I FOR ALL TO authenticated USING (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = %L
        )
      ) WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = %L
        )
      )',
      target_table,
      'platform_admin',
      'platform_admin'
    );

    EXECUTE format('DROP POLICY IF EXISTS amro_tenant_isolation ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY amro_tenant_isolation ON public.%I FOR ALL TO authenticated USING (
        tenant_id IN (
          SELECT ur.tenant_id
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.tenant_id IS NOT NULL
        )
      ) WITH CHECK (
        tenant_id IN (
          SELECT ur.tenant_id
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.tenant_id IS NOT NULL
        )
      )',
      target_table
    );
  END LOOP;
END
$$;
