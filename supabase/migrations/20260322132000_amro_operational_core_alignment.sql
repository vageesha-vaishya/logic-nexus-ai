-- DB-VERIFICATION: amro-operational-core-alignment-reviewed
-- DB-ARCH-APPROVAL: amro-lld-6-2-through-6-8-alignment-approved

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS tail_number text,
  ADD COLUMN IF NOT EXISTS aircraft_model text,
  ADD COLUMN IF NOT EXISTS engine_type text,
  ADD COLUMN IF NOT EXISTS station_code text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.aircraft
SET
  tail_number = COALESCE(tail_number, registration),
  aircraft_model = COALESCE(aircraft_model, model),
  engine_type = COALESCE(engine_type, aircraft_type),
  station_code = COALESCE(station_code, base_location)
WHERE tail_number IS NULL
   OR aircraft_model IS NULL
   OR engine_type IS NULL
   OR station_code IS NULL;

ALTER TABLE public.aircraft
  ALTER COLUMN tail_number SET NOT NULL,
  ALTER COLUMN aircraft_model SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_aircraft_tenant_tail_number_active
  ON public.aircraft(tenant_id, tail_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aircraft_tenant_status ON public.aircraft(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_aircraft_tenant_station_code ON public.aircraft(tenant_id, station_code);
CREATE INDEX IF NOT EXISTS idx_aircraft_tenant_updated_at_desc ON public.aircraft(tenant_id, updated_at DESC);

ALTER TABLE public.work_packages
  ADD COLUMN IF NOT EXISTS work_package_number text,
  ADD COLUMN IF NOT EXISTS planned_start timestamptz,
  ADD COLUMN IF NOT EXISTS planned_end timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_downtime_minutes integer,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.work_packages
SET
  work_package_number = COALESCE(work_package_number, work_order_number),
  planned_start = COALESCE(planned_start, planned_start_date),
  planned_end = COALESCE(planned_end, planned_end_date)
WHERE work_package_number IS NULL
   OR planned_start IS NULL
   OR planned_end IS NULL;

ALTER TABLE public.work_packages
  ALTER COLUMN work_package_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_packages_tenant_number_active
  ON public.work_packages(tenant_id, work_package_number)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_packages_tenant_status_planned_start
  ON public.work_packages(tenant_id, status, planned_start);
CREATE INDEX IF NOT EXISTS idx_work_packages_tenant_aircraft
  ON public.work_packages(tenant_id, aircraft_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_active_statuses
  ON public.work_packages(tenant_id, planned_start)
  WHERE deleted_at IS NULL AND status IN ('planning', 'approved', 'in_progress');

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sequence integer,
  ADD COLUMN IF NOT EXISTS assigned_technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS steps_json jsonb,
  ADD COLUMN IF NOT EXISTS qualifications_json jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.tasks
SET
  sequence = COALESCE(sequence, sequence_order),
  assigned_technician_id = COALESCE(assigned_technician_id, assigned_to),
  steps_json = COALESCE(steps_json, steps),
  qualifications_json = COALESCE(qualifications_json, qualifications)
WHERE sequence IS NULL
   OR assigned_technician_id IS NULL
   OR steps_json IS NULL
   OR qualifications_json IS NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT ck_tasks_steps_json_array_or_object
    CHECK (steps_json IS NULL OR jsonb_typeof(steps_json) IN ('array', 'object')),
  ADD CONSTRAINT ck_tasks_qualifications_json_object
    CHECK (qualifications_json IS NULL OR jsonb_typeof(qualifications_json) = 'object');

CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_work_package_sequence_active
  ON public.tasks(work_package_id, sequence)
  WHERE deleted_at IS NULL AND sequence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_work_package_status
  ON public.tasks(tenant_id, work_package_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_steps_json_gin
  ON public.tasks USING GIN (steps_json jsonb_path_ops);

ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS condition_code text,
  ADD COLUMN IF NOT EXISTS uom text NOT NULL DEFAULT 'EA',
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parts_inventory_serialized_by_tenant_active
  ON public.parts_inventory(tenant_id, part_number, COALESCE(serial_number, ''), COALESCE(batch_number, ''))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_part_number
  ON public.parts_inventory(tenant_id, part_number);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_warehouse_location
  ON public.parts_inventory(tenant_id, warehouse_location);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_condition_code
  ON public.parts_inventory(tenant_id, condition_code);

ALTER TABLE public.compliance_obligations
  ADD COLUMN IF NOT EXISTS regulator_code text,
  ADD COLUMN IF NOT EXISTS due_hours integer,
  ADD COLUMN IF NOT EXISTS due_cycles integer,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.compliance_obligations co
SET regulator_code = rp.regulator_code
FROM public.regulator_profiles rp
WHERE co.regulator_profile_id = rp.id
  AND co.regulator_code IS NULL;

ALTER TABLE public.compliance_obligations
  ADD CONSTRAINT ck_compliance_obligations_due_rule_complete
    CHECK (
      due_date IS NOT NULL
      OR due_hours IS NOT NULL
      OR due_cycles IS NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_compliance_obligations_tenant_regulator_due
  ON public.compliance_obligations(tenant_id, regulator_code, due_date);
CREATE INDEX IF NOT EXISTS idx_compliance_obligations_tenant_status
  ON public.compliance_obligations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_compliance_obligations_tenant_aircraft_type
  ON public.compliance_obligations(tenant_id, aircraft_id, obligation_type);

ALTER TABLE public.compliance_records
  ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.work_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approving_authority uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approving_authority_profile_id uuid REFERENCES public.regulator_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.compliance_records
  ADD CONSTRAINT ck_compliance_records_authority_required
    CHECK (
      decision_status NOT IN ('approved', 'rejected', 'waived')
      OR approving_authority_profile_id IS NOT NULL
    );

CREATE INDEX IF NOT EXISTS idx_compliance_records_tenant_work_package
  ON public.compliance_records(tenant_id, work_package_id);

ALTER TABLE public.staff_qualifications
  ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS issuer_authority text,
  ADD COLUMN IF NOT EXISTS regulator_profile_id uuid REFERENCES public.regulator_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_to date,
  ADD COLUMN IF NOT EXISTS policy_reference text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.staff_qualifications
SET
  technician_id = COALESCE(technician_id, staff_id),
  issuer_authority = COALESCE(issuer_authority, issuing_authority),
  valid_from = COALESCE(valid_from, issue_date),
  valid_to = COALESCE(valid_to, expiration_date)
WHERE technician_id IS NULL
   OR issuer_authority IS NULL
   OR valid_from IS NULL
   OR valid_to IS NULL;

ALTER TABLE public.staff_qualifications
  ADD CONSTRAINT ck_staff_qualifications_regulator_profile_required_for_release
    CHECK (can_certify_release = false OR regulator_profile_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_staff_qualifications_tenant_technician_expiration
  ON public.staff_qualifications(tenant_id, technician_id, expiration_date);
CREATE INDEX IF NOT EXISTS idx_staff_qualifications_tenant_can_certify_release
  ON public.staff_qualifications(tenant_id, can_certify_release);

ALTER TABLE public.certification_actions
  ADD COLUMN IF NOT EXISTS release_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS policy_reference text,
  ADD COLUMN IF NOT EXISTS signer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signature_method public.signature_method,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.certification_actions
SET signer_id = COALESCE(signer_id, decided_by)
WHERE signer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_certification_actions_tenant_action_status
  ON public.certification_actions(tenant_id, action_status);

ALTER TABLE public.maintenance_events
  ADD COLUMN IF NOT EXISTS event_hash text,
  ADD COLUMN IF NOT EXISTS previous_hash text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.maintenance_events
SET event_hash = COALESCE(event_hash, md5(id::text || ':' || created_at::text || ':' || tenant_id::text))
WHERE event_hash IS NULL;

ALTER TABLE public.maintenance_events
  ALTER COLUMN event_hash SET NOT NULL,
  ADD CONSTRAINT ck_maintenance_events_signature_requirements
    CHECK (signature IS NULL OR (signature_method IS NOT NULL AND performed_by IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_maintenance_events_tenant_task_created_desc
  ON public.maintenance_events(tenant_id, task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_events_tenant_event_type_created
  ON public.maintenance_events(tenant_id, event_type, created_at);

ALTER TABLE public.work_package_materials
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.component_positions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.shift_calendars
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.schedule_constraints
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.regulator_profiles
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.integration_jobs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.integration_mappings
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.webhook_outbox
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.asset_health_signals
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.forecast_outputs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.task_qualification_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  staff_qualification_id uuid NOT NULL REFERENCES public.staff_qualifications(id) ON DELETE CASCADE,
  requirement_scope text,
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_task_qualification_requirements_active
  ON public.task_qualification_requirements(task_id, staff_qualification_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_qualification_requirements_tenant_task
  ON public.task_qualification_requirements(tenant_id, task_id);

CREATE OR REPLACE FUNCTION public.amro_validate_certification_action()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_expiration date;
  v_can_certify boolean;
  v_regulator_profile uuid;
BEGIN
  IF NEW.staff_qualification_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    expiration_date,
    can_certify_release,
    regulator_profile_id
  INTO
    v_expiration,
    v_can_certify,
    v_regulator_profile
  FROM public.staff_qualifications
  WHERE id = NEW.staff_qualification_id;

  IF NEW.action_type = 'approve' AND NEW.action_status = 'executed' THEN
    IF v_can_certify IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Qualification % cannot certify release', NEW.staff_qualification_id;
    END IF;
    IF v_expiration IS NOT NULL AND v_expiration < CURRENT_DATE THEN
      RAISE EXCEPTION 'Qualification % is expired for certifying release', NEW.staff_qualification_id;
    END IF;
    IF v_regulator_profile IS NULL THEN
      RAISE EXCEPTION 'Qualification % missing regulator profile linkage', NEW.staff_qualification_id;
    END IF;
  END IF;

  IF NEW.signature_method IS NOT NULL AND NEW.signer_id IS NULL THEN
    RAISE EXCEPTION 'Signer identity required when signature method is provided';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_amro_validate_certification_action ON public.certification_actions;
CREATE TRIGGER trg_amro_validate_certification_action
  BEFORE INSERT OR UPDATE ON public.certification_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.amro_validate_certification_action();

CREATE OR REPLACE FUNCTION public.amro_prevent_maintenance_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'maintenance_events is append-only';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'maintenance_events is append-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_amro_maintenance_events_immutable ON public.maintenance_events;
CREATE TRIGGER trg_amro_maintenance_events_immutable
  BEFORE UPDATE OR DELETE ON public.maintenance_events
  FOR EACH ROW
  EXECUTE FUNCTION public.amro_prevent_maintenance_event_mutation();

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'aircraft',
    'components',
    'work_packages',
    'tasks',
    'staff_qualifications',
    'maintenance_events',
    'work_package_materials',
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
    'forecast_outputs',
    'task_qualification_requirements'
  ];
  existing_policy text;
BEGIN
  FOREACH target_table IN ARRAY target_tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    FOR existing_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', existing_policy, target_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY amro_platform_admin_access ON public.%I
        FOR ALL
        TO authenticated
        USING (public.is_platform_admin(auth.uid()))
        WITH CHECK (public.is_platform_admin(auth.uid()))',
      target_table
    );

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
