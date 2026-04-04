-- DB-VERIFICATION: auto-0m3ija-engine-seed-schema-overlap-reviewed
-- DB-ARCH-APPROVAL: auto-0m3ija-engine-seed-approved
-- EXTENSION-ASSESSMENT:
--   Existing AMRO entities (aircraft, components, maintenance_events, maintenance_schedule,
--   asset_health_signals, compliance_obligations, compliance_records, flight_logs, parts_inventory,
--   staff_qualifications) are reused as primary storage.
--   New tables are introduced only for gaps not covered by existing schema:
--   1) engine configuration versioning lifecycle
--   2) high-volume engine parameter historical tracking with effective date ranges
--   3) benchmark/audit run capture for repeatable seed-performance evidence
--
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE public.components
  ADD COLUMN IF NOT EXISTS parent_component_id uuid REFERENCES public.components(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS component_role text,
  ADD COLUMN IF NOT EXISTS engine_module_code text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_components_parent_component_id ON public.components(parent_component_id);
CREATE INDEX IF NOT EXISTS idx_components_engine_module_code ON public.components(engine_module_code);

ALTER TABLE public.maintenance_events
  ADD COLUMN IF NOT EXISTS event_status text NOT NULL DEFAULT 'scheduled' CHECK (event_status IN ('scheduled', 'in_progress', 'completed', 'overdue')),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_maintenance_events_event_status ON public.maintenance_events(tenant_id, event_status, event_timestamp DESC);

ALTER TABLE public.asset_health_signals
  ADD COLUMN IF NOT EXISTS flight_phase text CHECK (flight_phase IN ('takeoff', 'climb', 'cruise', 'descent', 'landing')),
  ADD COLUMN IF NOT EXISTS effective_from timestamptz,
  ADD COLUMN IF NOT EXISTS effective_to timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.compliance_obligations
  ADD COLUMN IF NOT EXISTS regulator_code text,
  ADD COLUMN IF NOT EXISTS due_hours numeric(14,2),
  ADD COLUMN IF NOT EXISTS due_cycles integer,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.compliance_records
  ADD COLUMN IF NOT EXISTS work_package_id uuid REFERENCES public.work_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approving_authority uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approving_authority_profile_id uuid REFERENCES public.regulator_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS policy_snapshot_id uuid REFERENCES public.policy_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.engine_configuration_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  version_no integer NOT NULL CHECK (version_no > 0),
  change_summary text NOT NULL,
  config_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_engine_configuration_versions UNIQUE (tenant_id, aircraft_id, component_id, version_no),
  CONSTRAINT ck_engine_configuration_versions_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_engine_configuration_versions_tenant_id ON public.engine_configuration_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_engine_configuration_versions_aircraft_id ON public.engine_configuration_versions(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_engine_configuration_versions_component_id ON public.engine_configuration_versions(component_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_engine_configuration_current
  ON public.engine_configuration_versions(tenant_id, component_id)
  WHERE is_current = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.engine_parameter_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  parameter_name text NOT NULL,
  parameter_value numeric(14,4) NOT NULL,
  unit text NOT NULL,
  flight_phase text NOT NULL CHECK (flight_phase IN ('takeoff', 'climb', 'cruise', 'descent', 'landing')),
  sample_time timestamptz NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  source text NOT NULL DEFAULT 'seed_rpc',
  quality_score numeric(5,2) CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ck_engine_parameter_history_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_engine_parameter_history_tenant_aircraft ON public.engine_parameter_history(tenant_id, aircraft_id, sample_time DESC);
CREATE INDEX IF NOT EXISTS idx_engine_parameter_history_component_param ON public.engine_parameter_history(component_id, parameter_name, sample_time DESC);

CREATE TABLE IF NOT EXISTS public.engine_seed_audit_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  seed_label text NOT NULL,
  iteration_no integer NOT NULL DEFAULT 1 CHECK (iteration_no > 0),
  execution_ms numeric(12,2) NOT NULL CHECK (execution_ms >= 0),
  parameter_count integer NOT NULL DEFAULT 0 CHECK (parameter_count >= 0),
  maintenance_count integer NOT NULL DEFAULT 0 CHECK (maintenance_count >= 0),
  performance_count integer NOT NULL DEFAULT 0 CHECK (performance_count >= 0),
  benchmark_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_engine_seed_audit_runs_tenant_aircraft ON public.engine_seed_audit_runs(tenant_id, aircraft_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.amro_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_engine_parameter_row(
  p_parameter_name text,
  p_value numeric
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_parameter_name = 'egt_c' THEN
    RETURN p_value BETWEEN 350 AND 980;
  ELSIF p_parameter_name = 'n1_pct' THEN
    RETURN p_value BETWEEN 18 AND 110;
  ELSIF p_parameter_name = 'n2_pct' THEN
    RETURN p_value BETWEEN 45 AND 110;
  ELSIF p_parameter_name = 'fuel_flow_lbh' THEN
    RETURN p_value BETWEEN 1200 AND 9200;
  ELSIF p_parameter_name = 'vibration_ips' THEN
    RETURN p_value BETWEEN 0.00 AND 4.50;
  ELSIF p_parameter_name = 'thrust_takeoff_lbf' THEN
    RETURN p_value BETWEEN 25000 AND 35000;
  ELSIF p_parameter_name = 'thrust_cruise_lbf' THEN
    RETURN p_value BETWEEN 5000 AND 8000;
  ELSIF p_parameter_name = 'sfc_lbf_per_lbf_hr' THEN
    RETURN p_value BETWEEN 0.35 AND 0.55;
  ELSIF p_parameter_name = 'oil_pressure_psi' THEN
    RETURN p_value BETWEEN 40 AND 120;
  ELSIF p_parameter_name = 'efficiency_pct' THEN
    RETURN p_value BETWEEN 70 AND 100;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_engine_reference_formats(
  p_part_number text,
  p_serial_number text,
  p_regulatory_ref text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_part_number IS NOT NULL AND p_part_number !~ '^[A-Z0-9]{2,10}(-[A-Z0-9]{1,10}){1,5}$' THEN
    RETURN false;
  END IF;
  IF p_serial_number IS NOT NULL AND p_serial_number !~ '^[A-Z0-9]{2,12}(-[A-Z0-9]{1,12}){2,6}$' THEN
    RETURN false;
  END IF;
  IF p_regulatory_ref IS NOT NULL AND p_regulatory_ref !~ '^(AD|SB)-[A-Z0-9]{2,12}-[0-9]{2,6}$' THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_engine_parameter_history_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT public.validate_engine_parameter_row(NEW.parameter_name, NEW.parameter_value) THEN
    RAISE EXCEPTION 'Engine parameter out of allowed range. parameter=%, value=%', NEW.parameter_name, NEW.parameter_value;
  END IF;

  IF NEW.effective_to IS NOT NULL AND NEW.effective_to < NEW.effective_from THEN
    RAISE EXCEPTION 'Invalid effective range for engine_parameter_history. effective_to < effective_from';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_maintenance_event_engine_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_latest_ts timestamptz;
  v_part_number text;
  v_serial_number text;
  v_reg_ref text;
BEGIN
  v_part_number := NEW.data ->> 'part_number';
  v_serial_number := NEW.data ->> 'serial_number';
  v_reg_ref := NEW.data ->> 'regulatory_reference';

  IF NOT public.validate_engine_reference_formats(v_part_number, v_serial_number, v_reg_ref) THEN
    RAISE EXCEPTION 'Invalid engine part/serial/regulatory reference format in maintenance_events.data';
  END IF;

  SELECT max(me.event_timestamp)
  INTO v_latest_ts
  FROM public.maintenance_events me
  WHERE me.tenant_id = NEW.tenant_id
    AND me.component_id IS NOT DISTINCT FROM NEW.component_id
    AND me.id <> NEW.id;

  IF v_latest_ts IS NOT NULL AND NEW.event_timestamp < v_latest_ts THEN
    RAISE EXCEPTION 'Maintenance event chronology violation. event_timestamp=% is older than latest=%', NEW.event_timestamp, v_latest_ts;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_engine_configuration_versions ON public.engine_configuration_versions;
CREATE TRIGGER trg_touch_engine_configuration_versions
BEFORE UPDATE ON public.engine_configuration_versions
FOR EACH ROW EXECUTE FUNCTION public.amro_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_engine_parameter_history ON public.engine_parameter_history;
CREATE TRIGGER trg_touch_engine_parameter_history
BEFORE UPDATE ON public.engine_parameter_history
FOR EACH ROW EXECUTE FUNCTION public.amro_touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_maintenance_events ON public.maintenance_events;
CREATE TRIGGER trg_touch_maintenance_events
BEFORE UPDATE ON public.maintenance_events
FOR EACH ROW EXECUTE FUNCTION public.amro_touch_updated_at();

DROP TRIGGER IF EXISTS trg_validate_engine_parameter_history ON public.engine_parameter_history;
CREATE TRIGGER trg_validate_engine_parameter_history
BEFORE INSERT OR UPDATE ON public.engine_parameter_history
FOR EACH ROW EXECUTE FUNCTION public.enforce_engine_parameter_history_rules();

DROP TRIGGER IF EXISTS trg_validate_maintenance_event_engine_rules ON public.maintenance_events;
CREATE TRIGGER trg_validate_maintenance_event_engine_rules
BEFORE INSERT OR UPDATE ON public.maintenance_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_maintenance_event_engine_rules();

ALTER TABLE public.engine_configuration_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_parameter_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_seed_audit_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.engine_configuration_versions;
CREATE POLICY amro_platform_admin_access
  ON public.engine_configuration_versions
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.engine_configuration_versions;
CREATE POLICY amro_tenant_franchise_scope
  ON public.engine_configuration_versions
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
  );

DROP POLICY IF EXISTS amro_platform_admin_access ON public.engine_parameter_history;
CREATE POLICY amro_platform_admin_access
  ON public.engine_parameter_history
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.engine_parameter_history;
CREATE POLICY amro_tenant_franchise_scope
  ON public.engine_parameter_history
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
  );

DROP POLICY IF EXISTS amro_platform_admin_access ON public.engine_seed_audit_runs;
CREATE POLICY amro_platform_admin_access
  ON public.engine_seed_audit_runs
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.engine_seed_audit_runs;
CREATE POLICY amro_tenant_franchise_scope
  ON public.engine_seed_audit_runs
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
  );

CREATE OR REPLACE FUNCTION public.seed_auto_0m3ija_engine_dataset(
  p_tenant_id uuid DEFAULT NULL,
  p_franchise_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_actor_user_id uuid;
  v_aircraft_id uuid;
  v_aircraft_exists boolean;
  v_started_at timestamptz := clock_timestamp();
  v_component_count integer;
  v_maintenance_count integer;
  v_parameter_count integer;
  v_performance_count integer;
BEGIN
  SELECT COALESCE(p_tenant_id, public.get_user_tenant_id(auth.uid()), (SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1))
  INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant_id resolved for AUTO-0M3IJA seed.';
  END IF;

  SELECT COALESCE(
    p_franchise_id,
    public.get_user_franchise_id(auth.uid()),
    (
      SELECT f.id
      FROM public.franchises f
      WHERE f.tenant_id = v_tenant_id
      ORDER BY f.created_at ASC
      LIMIT 1
    )
  )
  INTO v_franchise_id;

  SELECT COALESCE(
    p_actor_user_id,
    auth.uid(),
    (
      SELECT id
      FROM auth.users
      ORDER BY created_at ASC
      LIMIT 1
    )
  )
  INTO v_actor_user_id;

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row exists; AUTO-0M3IJA engine seed requires at least one user.';
  END IF;

  SELECT extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:aircraft', v_tenant_id::text))
  INTO v_aircraft_id;

  SELECT EXISTS(
    SELECT 1 FROM public.aircraft a WHERE a.id = v_aircraft_id
  ) INTO v_aircraft_exists;

  IF v_aircraft_exists AND NOT p_force THEN
    RETURN jsonb_build_object(
      'seed_label', 'AUTO-0M3IJA',
      'tenant_id', v_tenant_id,
      'franchise_id', v_franchise_id,
      'aircraft_id', v_aircraft_id,
      'skipped', true,
      'message', 'Aircraft seed already exists. Pass p_force=true to reseed.'
    );
  END IF;

  INSERT INTO public.aircraft (
    id, tenant_id, franchise_id, registration, tail_number, aircraft_type, model, manufacturer, aircraft_model,
    serial_number, status, engine_type, configuration_code, maintenance_program,
    current_flight_hours, current_cycles, current_flight_hours_since_new, current_cycles_since_new,
    created_by, updated_by
  )
  VALUES (
    v_aircraft_id, v_tenant_id, v_franchise_id,
    'AUTO-0M3IJA', 'AUTO-0M3IJA', 'auto_seeded', 'AMRO Bootstrap', 'AMRO Seed Systems', 'AMRO Bootstrap',
    'AUTO-0M3IJA-SN', 'active'::public.aircraft_status, 'Twin Turbofan', 'AUTO-ENG-CFG-01', 'AUTO-ENG-LIFECYCLE',
    7824.50, 3128, 7824.50, 3128,
    v_actor_user_id, v_actor_user_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    registration = EXCLUDED.registration,
    tail_number = EXCLUDED.tail_number,
    aircraft_type = EXCLUDED.aircraft_type,
    model = EXCLUDED.model,
    manufacturer = EXCLUDED.manufacturer,
    aircraft_model = EXCLUDED.aircraft_model,
    status = EXCLUDED.status,
    engine_type = EXCLUDED.engine_type,
    configuration_code = EXCLUDED.configuration_code,
    maintenance_program = EXCLUDED.maintenance_program,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  WITH component_seed AS (
    SELECT *
    FROM (
      VALUES
        ('ENG-L', NULL, 'engine_module', 'engine', 'turbine_assembly', 'AMRO-ENG-TA-0001', 'AUTOENG-L-MOD-001', 'Turbine Assembly (Left)', '72', 'AMRO Engines', 'AMRO-TA-L'),
        ('ENG-R', NULL, 'engine_module', 'engine', 'turbine_assembly', 'AMRO-ENG-TA-0002', 'AUTOENG-R-MOD-001', 'Turbine Assembly (Right)', '72', 'AMRO Engines', 'AMRO-TA-R'),
        ('FUEL-MANIFOLD-L', 'ENG-L', 'engine_subsystem', 'fuel', 'fuel_system', 'AMRO-FUEL-MAN-0101', 'AUTOENG-L-FS-101', 'Fuel Manifold L', '73', 'AMRO Fuel', 'FUEL-MAN-L'),
        ('FUEL-PUMP-L', 'ENG-L', 'engine_subsystem', 'fuel', 'fuel_system', 'AMRO-FUEL-PMP-0102', 'AUTOENG-L-FS-102', 'Fuel Pump L', '73', 'AMRO Fuel', 'FUEL-PMP-L'),
        ('LUBE-PUMP-L', 'ENG-L', 'engine_subsystem', 'lubrication', 'lubrication_system', 'AMRO-LUBE-PMP-0201', 'AUTOENG-L-LS-201', 'Lubrication Pump L', '79', 'AMRO Lube', 'LUBE-PMP-L'),
        ('IGNITION-EXCITER-L', 'ENG-L', 'engine_subsystem', 'ignition', 'ignition_system', 'AMRO-IGN-EXC-0301', 'AUTOENG-L-IG-301', 'Ignition Exciter L', '74', 'AMRO Ignition', 'IGN-EXC-L'),
        ('EXHAUST-MIXER-L', 'ENG-L', 'engine_subsystem', 'exhaust', 'exhaust_system', 'AMRO-EXH-MIX-0401', 'AUTOENG-L-EX-401', 'Exhaust Mixer L', '78', 'AMRO Exhaust', 'EXH-MIX-L'),
        ('N2-SPOOL-L', 'ENG-L', 'engine_subsystem', 'turbine', 'turbine_assembly', 'AMRO-TURB-N2-0501', 'AUTOENG-L-TA-501', 'N2 Spool L', '72', 'AMRO Turbine', 'N2-SPOOL-L'),
        ('FUEL-MANIFOLD-R', 'ENG-R', 'engine_subsystem', 'fuel', 'fuel_system', 'AMRO-FUEL-MAN-1101', 'AUTOENG-R-FS-101', 'Fuel Manifold R', '73', 'AMRO Fuel', 'FUEL-MAN-R'),
        ('FUEL-PUMP-R', 'ENG-R', 'engine_subsystem', 'fuel', 'fuel_system', 'AMRO-FUEL-PMP-1102', 'AUTOENG-R-FS-102', 'Fuel Pump R', '73', 'AMRO Fuel', 'FUEL-PMP-R'),
        ('LUBE-PUMP-R', 'ENG-R', 'engine_subsystem', 'lubrication', 'lubrication_system', 'AMRO-LUBE-PMP-1201', 'AUTOENG-R-LS-201', 'Lubrication Pump R', '79', 'AMRO Lube', 'LUBE-PMP-R'),
        ('IGNITION-EXCITER-R', 'ENG-R', 'engine_subsystem', 'ignition', 'ignition_system', 'AMRO-IGN-EXC-1301', 'AUTOENG-R-IG-301', 'Ignition Exciter R', '74', 'AMRO Ignition', 'IGN-EXC-R'),
        ('EXHAUST-MIXER-R', 'ENG-R', 'engine_subsystem', 'exhaust', 'exhaust_system', 'AMRO-EXH-MIX-1401', 'AUTOENG-R-EX-401', 'Exhaust Mixer R', '78', 'AMRO Exhaust', 'EXH-MIX-R'),
        ('N2-SPOOL-R', 'ENG-R', 'engine_subsystem', 'turbine', 'turbine_assembly', 'AMRO-TURB-N2-1501', 'AUTOENG-R-TA-501', 'N2 Spool R', '72', 'AMRO Turbine', 'N2-SPOOL-R'),
        ('HYD-INTERFACE', 'ENG-L', 'airframe_interface', 'interface', 'hydraulic_interface', 'AMRO-INT-HYD-9001', 'AUTOENG-L-IF-901', 'Hydraulic Interface', '29', 'AMRO Interface', 'IF-HYD'),
        ('ELEC-INTERFACE', 'ENG-L', 'airframe_interface', 'interface', 'electrical_interface', 'AMRO-INT-ELC-9002', 'AUTOENG-L-IF-902', 'Electrical Interface', '24', 'AMRO Interface', 'IF-ELC'),
        ('PNEU-INTERFACE', 'ENG-L', 'airframe_interface', 'interface', 'pneumatic_interface', 'AMRO-INT-PNE-9003', 'AUTOENG-L-IF-903', 'Pneumatic Interface', '36', 'AMRO Interface', 'IF-PNE')
    ) AS s(component_key, parent_key, component_type, category, component_role, part_number, serial_number, model, ata_chapter, manufacturer, engine_module_code)
  )
  INSERT INTO public.components (
    id, tenant_id, franchise_id, aircraft_id, parent_component_id, part_number, serial_number, alternate_part_numbers,
    component_type, category, manufacturer, model, ata_chapter, status, condition_code, installation_date,
    hours_since_new, cycles_since_new, location, component_role, engine_module_code, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:component:%s', v_tenant_id::text, s.component_key)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    CASE
      WHEN s.parent_key IS NULL THEN NULL
      ELSE extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:component:%s', v_tenant_id::text, s.parent_key))
    END,
    s.part_number,
    s.serial_number,
    ARRAY[format('%s-ALT', s.part_number)],
    s.component_type,
    s.category,
    s.manufacturer,
    s.model,
    s.ata_chapter,
    'installed'::public.component_status,
    'GOOD',
    now() - interval '180 days',
    7824.50,
    3128,
    'AUTO-ENG-BAY',
    s.component_role,
    s.engine_module_code,
    v_actor_user_id,
    v_actor_user_id
  FROM component_seed s
  ON CONFLICT (id) DO UPDATE
  SET
    parent_component_id = EXCLUDED.parent_component_id,
    part_number = EXCLUDED.part_number,
    serial_number = EXCLUDED.serial_number,
    component_type = EXCLUDED.component_type,
    category = EXCLUDED.category,
    model = EXCLUDED.model,
    manufacturer = EXCLUDED.manufacturer,
    ata_chapter = EXCLUDED.ata_chapter,
    component_role = EXCLUDED.component_role,
    engine_module_code = EXCLUDED.engine_module_code,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.engine_configuration_versions (
    id, tenant_id, franchise_id, aircraft_id, component_id, version_no, change_summary, config_snapshot,
    effective_from, effective_to, is_current, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:cfg:%s:v%s', v_tenant_id::text, c.id::text, v.version_no)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    c.id,
    v.version_no,
    v.change_summary,
    jsonb_build_object(
      'thrust_takeoff_lbf', 31200 + (v.version_no - 1) * 150,
      'thrust_cruise_lbf', 6700 + (v.version_no - 1) * 50,
      'sfc_lbf_per_lbf_hr', 0.46 + (v.version_no - 1) * 0.01,
      'regulatory_reference', format('SB-CFM56-%s', 7000 + v.version_no)
    ),
    now() - make_interval(days => (180 - v.version_no * 45)),
    CASE WHEN v.version_no = 3 THEN NULL ELSE now() - make_interval(days => (180 - (v.version_no + 1) * 45)) END,
    v.version_no = 3,
    v_actor_user_id,
    v_actor_user_id
  FROM public.components c
  CROSS JOIN (
    VALUES
      (1, 'Initial bootstrap configuration'),
      (2, 'Fuel and ignition tuning update'),
      (3, 'Current approved production configuration')
  ) AS v(version_no, change_summary)
  WHERE c.tenant_id = v_tenant_id
    AND c.aircraft_id = v_aircraft_id
    AND c.component_type IN ('engine_module', 'engine_subsystem')
  ON CONFLICT (tenant_id, aircraft_id, component_id, version_no) DO UPDATE
  SET
    change_summary = EXCLUDED.change_summary,
    config_snapshot = EXCLUDED.config_snapshot,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to,
    is_current = EXCLUDED.is_current,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.parts_inventory (
    id, tenant_id, franchise_id, part_number, serial_number, description, component_id,
    supplier_name, warehouse_location, quantity_on_hand, quantity_reserved,
    reorder_level, reorder_quantity, unit_cost, currency, status, category,
    condition_code, unit_of_measure, min_stock_level, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:inv:%s', v_tenant_id::text, c.id::text)),
    v_tenant_id,
    v_franchise_id,
    c.part_number,
    c.serial_number,
    format('Inventory record for %s', c.model),
    c.id,
    'AUTO AMRO Engine Supply',
    'AUTO-HGR-ENG-01',
    12,
    3,
    4,
    8,
    1850.00,
    'USD',
    'available',
    'rotable',
    'SERVICEABLE',
    'EA',
    2,
    v_actor_user_id,
    v_actor_user_id
  FROM public.components c
  WHERE c.tenant_id = v_tenant_id
    AND c.aircraft_id = v_aircraft_id
    AND c.component_type IN ('engine_subsystem', 'airframe_interface')
  ON CONFLICT (id) DO UPDATE
  SET
    description = EXCLUDED.description,
    supplier_name = EXCLUDED.supplier_name,
    warehouse_location = EXCLUDED.warehouse_location,
    quantity_on_hand = EXCLUDED.quantity_on_hand,
    quantity_reserved = EXCLUDED.quantity_reserved,
    reorder_level = EXCLUDED.reorder_level,
    reorder_quantity = EXCLUDED.reorder_quantity,
    unit_cost = EXCLUDED.unit_cost,
    status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.maintenance_schedule (
    id, tenant_id, franchise_id, aircraft_id, schedule_code, description, regulatory_authority,
    interval_hours, interval_cycles, last_done_hours, last_done_cycles, next_due_hours, next_due_cycles,
    near_due_buffer_hours, near_due_buffer_cycles, status, is_active, metadata, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:ms:%s', v_tenant_id::text, s.schedule_code)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    s.schedule_code,
    s.description,
    s.reg_authority,
    s.interval_hours,
    s.interval_cycles,
    s.last_done_hours,
    s.last_done_cycles,
    s.next_due_hours,
    s.next_due_cycles,
    120,
    80,
    s.status,
    true,
    jsonb_build_object('seed_source', 'AUTO-0M3IJA', 'maintenance_status_label', s.status_label),
    v_actor_user_id,
    v_actor_user_id
  FROM (
    VALUES
      ('AUTO-ENG-BORESCOPE', 'Scheduled borescope inspection', 'FAA', 800::numeric, 1600, 7000::numeric, 2900, 8200::numeric, 3400, 'planned', 'scheduled'),
      ('AUTO-ENG-OIL', 'Condition-based oil monitoring', 'EASA', 300::numeric, 600, 7600::numeric, 3050, 7900::numeric, 3300, 'near_due', 'in-progress'),
      ('AUTO-ENG-HOTSEC', 'Hot section intervention', 'FAA', 2400::numeric, 2600, 5200::numeric, 1800, 7600::numeric, 3200, 'due', 'scheduled'),
      ('AUTO-ENG-LLP', 'LLP replacement planning', 'EASA', 3200::numeric, 3000, 4500::numeric, 1200, 7600::numeric, 3050, 'overdue', 'overdue'),
      ('AUTO-ENG-WARRANTY', 'Warranty closure audit', 'FAA', 0::numeric, 0, 0::numeric, 0, 0::numeric, 0, 'completed', 'completed')
  ) AS s(schedule_code, description, reg_authority, interval_hours, interval_cycles, last_done_hours, last_done_cycles, next_due_hours, next_due_cycles, status, status_label)
  ON CONFLICT (tenant_id, aircraft_id, schedule_code) DO UPDATE
  SET
    description = EXCLUDED.description,
    regulatory_authority = EXCLUDED.regulatory_authority,
    interval_hours = EXCLUDED.interval_hours,
    interval_cycles = EXCLUDED.interval_cycles,
    last_done_hours = EXCLUDED.last_done_hours,
    last_done_cycles = EXCLUDED.last_done_cycles,
    next_due_hours = EXCLUDED.next_due_hours,
    next_due_cycles = EXCLUDED.next_due_cycles,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.work_packages (
    id, tenant_id, franchise_id, aircraft_id, work_order_number, work_package_number, title, description,
    work_type, maintenance_type, priority, source,
    planned_start_date, planned_end_date, planned_start, planned_end,
    status, assigned_to, supervisor_id, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:wp:%s', v_tenant_id::text, gs::text)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    format('AUTO-WO-0M3IJA-%s', lpad(gs::text, 3, '0')),
    format('AUTO-WP-0M3IJA-%s', lpad(gs::text, 3, '0')),
    format('AUTO Engine Package %s', gs),
    'AUTO-0M3IJA maintenance package for lifecycle demonstration',
    CASE WHEN gs % 3 = 0 THEN 'engine_overhaul' ELSE 'engine_maintenance' END,
    CASE WHEN gs % 4 = 0 THEN 'overhaul'::public.maintenance_type ELSE 'inspection'::public.maintenance_type END,
    1 + (gs % 5),
    'auto_seed',
    now() - make_interval(days => (60 - gs)),
    now() - make_interval(days => (58 - gs)),
    now() - make_interval(days => (60 - gs)),
    now() - make_interval(days => (58 - gs)),
    CASE
      WHEN gs % 5 = 0 THEN 'completed'::public.work_package_status
      WHEN gs % 5 = 1 THEN 'in_progress'::public.work_package_status
      WHEN gs % 5 = 2 THEN 'scheduled'::public.work_package_status
      WHEN gs % 5 = 3 THEN 'planning'::public.work_package_status
      ELSE 'approved'::public.work_package_status
    END,
    v_actor_user_id,
    v_actor_user_id,
    v_actor_user_id,
    v_actor_user_id
  FROM generate_series(1, 40) gs
  ON CONFLICT (work_order_number) DO UPDATE
  SET
    status = EXCLUDED.status,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.flight_logs (
    id, tenant_id, franchise_id, aircraft_id, flight_date, flight_number, departure_airport, arrival_airport,
    flight_hours, block_hours, flight_cycles, crew_details, fuel_burn_kg, oil_uplift_liters, regulatory_authority,
    metadata, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:fl:%s', v_tenant_id::text, gs::text)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    current_date - gs,
    format('AU0M3IJA%s', lpad(gs::text, 3, '0')),
    CASE WHEN gs % 2 = 0 THEN 'DXB' ELSE 'MCT' END,
    CASE WHEN gs % 2 = 0 THEN 'MCT' ELSE 'DXB' END,
    (1.8 + ((gs % 5) * 0.4))::numeric(10,2),
    (2.1 + ((gs % 5) * 0.4))::numeric(10,2),
    1,
    'AUTO Crew A',
    (5100 + gs * 22)::numeric(12,2),
    (4.0 + (gs % 4) * 0.5)::numeric(12,2),
    CASE WHEN gs % 2 = 0 THEN 'FAA' ELSE 'EASA' END,
    jsonb_build_object('seed_source', 'AUTO-0M3IJA', 'phase_profile', CASE WHEN gs % 3 = 0 THEN 'high_stress' ELSE 'nominal' END),
    v_actor_user_id,
    v_actor_user_id
  FROM generate_series(1, 80) gs
  ON CONFLICT (id) DO UPDATE
  SET
    fuel_burn_kg = EXCLUDED.fuel_burn_kg,
    oil_uplift_liters = EXCLUDED.oil_uplift_liters,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.asset_health_signals (
    id, tenant_id, franchise_id, aircraft_id, component_id, signal_type, signal_source, signal_timestamp,
    value_numeric, unit, quality_score, flight_phase, effective_from, effective_to, metadata, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:ahs:%s', v_tenant_id::text, gs::text)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    c.id,
    CASE (gs % 5)
      WHEN 0 THEN 'egt_c'
      WHEN 1 THEN 'n1_pct'
      WHEN 2 THEN 'n2_pct'
      WHEN 3 THEN 'fuel_flow_lbh'
      ELSE 'vibration_ips'
    END,
    'fa_decoding',
    now() - make_interval(minutes => gs * 15),
    CASE (gs % 5)
      WHEN 0 THEN (760 + (gs % 20) * 3.2)::numeric(14,4)
      WHEN 1 THEN (84 + (gs % 8) * 1.4)::numeric(14,4)
      WHEN 2 THEN (92 + (gs % 6) * 1.2)::numeric(14,4)
      WHEN 3 THEN (5200 + (gs % 18) * 110)::numeric(14,4)
      ELSE (1.1 + (gs % 7) * 0.18)::numeric(14,4)
    END,
    CASE (gs % 5)
      WHEN 0 THEN 'C'
      WHEN 1 THEN 'PCT'
      WHEN 2 THEN 'PCT'
      WHEN 3 THEN 'LBH'
      ELSE 'IPS'
    END,
    (95 - (gs % 10))::numeric(5,2),
    CASE (gs % 5)
      WHEN 0 THEN 'takeoff'
      WHEN 1 THEN 'climb'
      WHEN 2 THEN 'cruise'
      WHEN 3 THEN 'descent'
      ELSE 'landing'
    END,
    now() - make_interval(minutes => gs * 15),
    NULL,
    jsonb_build_object('seed_source', 'AUTO-0M3IJA', 'series', 'performance_monitoring'),
    v_actor_user_id,
    v_actor_user_id
  FROM generate_series(1, 240) gs
  CROSS JOIN LATERAL (
    SELECT c.id
    FROM public.components c
    WHERE c.tenant_id = v_tenant_id
      AND c.aircraft_id = v_aircraft_id
      AND c.component_type = 'engine_subsystem'
    ORDER BY c.serial_number
    LIMIT 1
  ) c
  ON CONFLICT (id) DO UPDATE
  SET
    value_numeric = EXCLUDED.value_numeric,
    quality_score = EXCLUDED.quality_score,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.engine_parameter_history (
    id, tenant_id, franchise_id, aircraft_id, component_id, parameter_name, parameter_value, unit,
    flight_phase, sample_time, effective_from, effective_to, source, quality_score, metadata, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:eph:%s', v_tenant_id::text, gs::text)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    c.id,
    CASE (gs % 10)
      WHEN 0 THEN 'egt_c'
      WHEN 1 THEN 'n1_pct'
      WHEN 2 THEN 'n2_pct'
      WHEN 3 THEN 'fuel_flow_lbh'
      WHEN 4 THEN 'vibration_ips'
      WHEN 5 THEN 'thrust_takeoff_lbf'
      WHEN 6 THEN 'thrust_cruise_lbf'
      WHEN 7 THEN 'sfc_lbf_per_lbf_hr'
      WHEN 8 THEN 'oil_pressure_psi'
      ELSE 'efficiency_pct'
    END,
    CASE (gs % 10)
      WHEN 0 THEN (730 + (gs % 35) * 2.8)::numeric(14,4)
      WHEN 1 THEN (83 + (gs % 9) * 1.6)::numeric(14,4)
      WHEN 2 THEN (90 + (gs % 8) * 1.4)::numeric(14,4)
      WHEN 3 THEN (5000 + (gs % 24) * 95)::numeric(14,4)
      WHEN 4 THEN (1.0 + (gs % 12) * 0.14)::numeric(14,4)
      WHEN 5 THEN (31000 - (gs * 0.8))::numeric(14,4)
      WHEN 6 THEN (6700 - (gs * 0.2))::numeric(14,4)
      WHEN 7 THEN (0.42 + ((gs % 10) * 0.01))::numeric(14,4)
      WHEN 8 THEN (78 - (gs % 20) * 0.7)::numeric(14,4)
      ELSE (98 - (gs * 0.01))::numeric(14,4)
    END,
    CASE (gs % 10)
      WHEN 0 THEN 'C'
      WHEN 1 THEN 'PCT'
      WHEN 2 THEN 'PCT'
      WHEN 3 THEN 'LBH'
      WHEN 4 THEN 'IPS'
      WHEN 5 THEN 'LBF'
      WHEN 6 THEN 'LBF'
      WHEN 7 THEN 'LBF/LBF/HR'
      WHEN 8 THEN 'PSI'
      ELSE 'PCT'
    END,
    CASE (gs % 5)
      WHEN 0 THEN 'takeoff'
      WHEN 1 THEN 'climb'
      WHEN 2 THEN 'cruise'
      WHEN 3 THEN 'descent'
      ELSE 'landing'
    END,
    now() - make_interval(minutes => gs * 10),
    now() - make_interval(minutes => gs * 10),
    NULL,
    'seed_rpc',
    (96 - (gs % 12))::numeric(5,2),
    jsonb_build_object(
      'seed_source', 'AUTO-0M3IJA',
      'degradation_curve_pct', GREATEST(0, 100 - round(gs * 0.02, 2)),
      'flight_log_reference', format('AU0M3IJA%s', lpad(((gs % 80) + 1)::text, 3, '0'))
    ),
    v_actor_user_id,
    v_actor_user_id
  FROM generate_series(1, 1000) gs
  CROSS JOIN LATERAL (
    SELECT c.id
    FROM public.components c
    WHERE c.tenant_id = v_tenant_id
      AND c.aircraft_id = v_aircraft_id
      AND c.component_type IN ('engine_module', 'engine_subsystem')
    ORDER BY c.serial_number
    OFFSET (gs % 10)
    LIMIT 1
  ) c
  ON CONFLICT (id) DO UPDATE
  SET
    parameter_value = EXCLUDED.parameter_value,
    quality_score = EXCLUDED.quality_score,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.compliance_obligations (
    id, tenant_id, franchise_id, regulator_profile_id, regulator_code, aircraft_id, work_package_id,
    obligation_code, obligation_type, title, description, due_date, due_hours, due_cycles,
    priority, status, source_reference, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:obl:%s', v_tenant_id::text, gs::text)),
    v_tenant_id,
    v_franchise_id,
    rp.id,
    CASE WHEN gs % 2 = 0 THEN 'FAA' ELSE 'EASA' END,
    v_aircraft_id,
    wp.id,
    format('AUTO-OBL-%s', lpad(gs::text, 3, '0')),
    CASE WHEN gs % 3 = 0 THEN 'ad_sb' ELSE 'llp' END,
    CASE WHEN gs % 2 = 0 THEN 'AD compliance closure' ELSE 'SB implementation review' END,
    'AUTO-0M3IJA compliance seed obligation',
    current_date + (gs % 45),
    7200 + (gs * 4),
    3000 + gs,
    CASE WHEN gs % 5 = 0 THEN 'critical' WHEN gs % 3 = 0 THEN 'high' ELSE 'medium' END,
    CASE WHEN gs % 7 = 0 THEN 'overdue' WHEN gs % 5 = 0 THEN 'in_progress' ELSE 'open' END,
    format('AD-CFM56-%s', 3000 + gs),
    v_actor_user_id,
    v_actor_user_id
  FROM generate_series(1, 30) gs
  JOIN LATERAL (
    SELECT rp.id
    FROM public.regulator_profiles rp
    WHERE rp.tenant_id = v_tenant_id
      AND rp.regulator_code = CASE WHEN gs % 2 = 0 THEN 'FAA' ELSE 'EASA' END
    ORDER BY rp.created_at ASC
    LIMIT 1
  ) rp ON true
  JOIN LATERAL (
    SELECT wp.id
    FROM public.work_packages wp
    WHERE wp.tenant_id = v_tenant_id
      AND wp.aircraft_id = v_aircraft_id
    ORDER BY wp.created_at DESC
    OFFSET (gs % 10)
    LIMIT 1
  ) wp ON true
  ON CONFLICT (tenant_id, obligation_code) DO UPDATE
  SET
    status = EXCLUDED.status,
    due_date = EXCLUDED.due_date,
    due_hours = EXCLUDED.due_hours,
    due_cycles = EXCLUDED.due_cycles,
    source_reference = EXCLUDED.source_reference,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.maintenance_events (
    id, tenant_id, franchise_id, aircraft_id, component_id, work_package_id, task_id,
    event_type, event_code, event_status, title, description,
    performed_by, approved_by, data, metadata, signature, signature_timestamp, signature_method,
    evidence_hash, regulatory_requirement, compliance_authority, event_timestamp, event_hash, previous_hash,
    created_at, updated_at, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:me:%s', v_tenant_id::text, gs::text)),
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    c.id,
    wp.id,
    NULL,
    CASE WHEN gs % 6 = 0 THEN 'engine_overhaul_completed' WHEN gs % 3 = 0 THEN 'engine_inspection' ELSE 'engine_monitoring' END,
    format('AUTO-ME-%s', lpad(gs::text, 4, '0')),
    CASE
      WHEN gs % 4 = 0 THEN 'scheduled'
      WHEN gs % 4 = 1 THEN 'in_progress'
      WHEN gs % 4 = 2 THEN 'completed'
      ELSE 'overdue'
    END,
    format('AUTO Engine Event %s', gs),
    'AUTO-0M3IJA engine maintenance lifecycle event',
    v_actor_user_id,
    CASE WHEN gs % 4 IN (2, 3) THEN v_actor_user_id ELSE NULL END,
    jsonb_build_object(
      'part_number', c.part_number,
      'serial_number', c.serial_number,
      'regulatory_reference', CASE WHEN gs % 2 = 0 THEN format('AD-CFM56-%s', 4000 + gs) ELSE format('SB-CFM56-%s', 5000 + gs) END,
      'maintenance_status', CASE WHEN gs % 4 = 0 THEN 'scheduled' WHEN gs % 4 = 1 THEN 'in_progress' WHEN gs % 4 = 2 THEN 'completed' ELSE 'overdue' END
    ),
    jsonb_build_object('seed_source', 'AUTO-0M3IJA', 'workflow', 'maintenance_tracking'),
    format('SIG-AUTO-%s', lpad(gs::text, 4, '0')),
    now() - make_interval(days => (500 - gs)),
    'digital'::public.signature_method,
    md5(format('%s:auto-0m3ija:evidence:%s', v_tenant_id::text, gs::text)),
    'ATA 72 maintenance compliance',
    CASE WHEN gs % 2 = 0 THEN 'FAA' ELSE 'EASA' END,
    now() - make_interval(days => (500 - gs)),
    md5(format('%s:auto-0m3ija:event:%s', v_tenant_id::text, gs::text)),
    CASE WHEN gs = 1 THEN NULL ELSE md5(format('%s:auto-0m3ija:event:%s', v_tenant_id::text, gs - 1)) END,
    now() - make_interval(days => (500 - gs)),
    now() - make_interval(days => (500 - gs)),
    v_actor_user_id,
    v_actor_user_id
  FROM generate_series(1, 500) gs
  JOIN LATERAL (
    SELECT c.id, c.part_number, c.serial_number
    FROM public.components c
    WHERE c.tenant_id = v_tenant_id
      AND c.aircraft_id = v_aircraft_id
      AND c.component_type IN ('engine_module', 'engine_subsystem')
    ORDER BY c.serial_number
    OFFSET (gs % 10)
    LIMIT 1
  ) c ON true
  JOIN LATERAL (
    SELECT wp.id
    FROM public.work_packages wp
    WHERE wp.tenant_id = v_tenant_id
      AND wp.aircraft_id = v_aircraft_id
    ORDER BY wp.created_at DESC
    OFFSET (gs % 10)
    LIMIT 1
  ) wp ON true
  ON CONFLICT (id) DO UPDATE
  SET
    event_status = EXCLUDED.event_status,
    data = EXCLUDED.data,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.compliance_records (
    id, tenant_id, franchise_id, obligation_id, maintenance_event_id, task_id, work_package_id,
    decision_status, decision_reason, evidence_reference, evidence_hash, reviewed_by, reviewed_at,
    approving_authority, approving_authority_profile_id, policy_snapshot_id, created_by, updated_by
  )
  SELECT
    extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:cr:%s', v_tenant_id::text, row_number() OVER (ORDER BY co.id))),
    v_tenant_id,
    v_franchise_id,
    co.id,
    me.id,
    NULL,
    co.work_package_id,
    CASE WHEN co.status = 'overdue' THEN 'deferred' ELSE 'approved' END,
    CASE WHEN co.status = 'overdue' THEN 'Deferred pending overdue closure package' ELSE 'Approved for release' END,
    format('AUTO-EVID-%s', right(co.obligation_code, 3)),
    md5(format('%s:auto-0m3ija:cr:%s', v_tenant_id::text, co.id::text)),
    v_actor_user_id,
    now() - interval '1 day',
    v_actor_user_id,
    co.regulator_profile_id,
    NULL,
    v_actor_user_id,
    v_actor_user_id
  FROM public.compliance_obligations co
  JOIN LATERAL (
    SELECT me.id
    FROM public.maintenance_events me
    WHERE me.tenant_id = v_tenant_id
      AND me.aircraft_id = v_aircraft_id
    ORDER BY me.event_timestamp DESC
    LIMIT 1
  ) me ON true
  WHERE co.tenant_id = v_tenant_id
    AND co.aircraft_id = v_aircraft_id
    AND co.obligation_code LIKE 'AUTO-OBL-%'
  ON CONFLICT (id) DO UPDATE
  SET
    decision_status = EXCLUDED.decision_status,
    decision_reason = EXCLUDED.decision_reason,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  SELECT count(*) INTO v_component_count
  FROM public.components
  WHERE tenant_id = v_tenant_id
    AND aircraft_id = v_aircraft_id
    AND component_type IN ('engine_module', 'engine_subsystem', 'airframe_interface')
    AND deleted_at IS NULL;

  SELECT count(*) INTO v_maintenance_count
  FROM public.maintenance_events
  WHERE tenant_id = v_tenant_id
    AND aircraft_id = v_aircraft_id
    AND metadata ->> 'seed_source' = 'AUTO-0M3IJA'
    AND deleted_at IS NULL;

  SELECT count(*) INTO v_parameter_count
  FROM public.engine_parameter_history
  WHERE tenant_id = v_tenant_id
    AND aircraft_id = v_aircraft_id
    AND metadata ->> 'seed_source' = 'AUTO-0M3IJA'
    AND deleted_at IS NULL;

  SELECT count(*) INTO v_performance_count
  FROM public.asset_health_signals
  WHERE tenant_id = v_tenant_id
    AND aircraft_id = v_aircraft_id
    AND metadata ->> 'seed_source' = 'AUTO-0M3IJA'
    AND deleted_at IS NULL;

  IF v_parameter_count < 1000 THEN
    RAISE EXCEPTION 'AUTO-0M3IJA seed validation failed: expected >=1000 engine_parameter_history rows, got %', v_parameter_count;
  END IF;

  IF v_maintenance_count < 500 THEN
    RAISE EXCEPTION 'AUTO-0M3IJA seed validation failed: expected >=500 maintenance_events rows, got %', v_maintenance_count;
  END IF;

  IF v_performance_count < 200 THEN
    RAISE EXCEPTION 'AUTO-0M3IJA seed validation failed: expected >=200 asset_health_signals rows, got %', v_performance_count;
  END IF;

  INSERT INTO public.engine_seed_audit_runs (
    tenant_id, franchise_id, aircraft_id, seed_label, iteration_no, execution_ms,
    parameter_count, maintenance_count, performance_count, benchmark_payload, created_by
  )
  VALUES (
    v_tenant_id,
    v_franchise_id,
    v_aircraft_id,
    'AUTO-0M3IJA',
    1,
    EXTRACT(epoch FROM (clock_timestamp() - v_started_at)) * 1000.0,
    v_parameter_count,
    v_maintenance_count,
    v_performance_count,
    jsonb_build_object('component_count', v_component_count, 'force_mode', p_force),
    v_actor_user_id
  );

  RETURN jsonb_build_object(
    'seed_label', 'AUTO-0M3IJA',
    'tenant_id', v_tenant_id,
    'franchise_id', v_franchise_id,
    'aircraft_id', v_aircraft_id,
    'component_count', v_component_count,
    'parameter_count', v_parameter_count,
    'maintenance_count', v_maintenance_count,
    'performance_count', v_performance_count,
    'execution_ms', EXTRACT(epoch FROM (clock_timestamp() - v_started_at)) * 1000.0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_auto_0m3ija_engine_seed(
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  check_name text,
  check_passed boolean,
  observed_value numeric,
  required_value numeric,
  detail text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_tenant_id uuid;
  v_aircraft_id uuid;
BEGIN
  SELECT COALESCE(p_tenant_id, public.get_user_tenant_id(auth.uid()), (SELECT id FROM public.tenants ORDER BY created_at ASC LIMIT 1))
  INTO v_tenant_id;

  SELECT extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:auto-0m3ija:aircraft', v_tenant_id::text))
  INTO v_aircraft_id;

  RETURN QUERY
  WITH checks AS (
    SELECT
      'aircraft_exists'::text AS check_name,
      (SELECT COUNT(*) FROM public.aircraft WHERE id = v_aircraft_id)::numeric AS observed_value,
      1::numeric AS required_value,
      'AUTO-0M3IJA aircraft row exists'::text AS detail
    UNION ALL
    SELECT
      'maintenance_events_min',
      (SELECT COUNT(*) FROM public.maintenance_events WHERE tenant_id = v_tenant_id AND aircraft_id = v_aircraft_id AND metadata ->> 'seed_source' = 'AUTO-0M3IJA' AND deleted_at IS NULL)::numeric,
      500::numeric,
      'Minimum maintenance event volume'
    UNION ALL
    SELECT
      'engine_parameter_history_min',
      (SELECT COUNT(*) FROM public.engine_parameter_history WHERE tenant_id = v_tenant_id AND aircraft_id = v_aircraft_id AND metadata ->> 'seed_source' = 'AUTO-0M3IJA' AND deleted_at IS NULL)::numeric,
      1000::numeric,
      'Minimum engine parameter history volume'
    UNION ALL
    SELECT
      'performance_monitoring_min',
      (SELECT COUNT(*) FROM public.asset_health_signals WHERE tenant_id = v_tenant_id AND aircraft_id = v_aircraft_id AND metadata ->> 'seed_source' = 'AUTO-0M3IJA' AND deleted_at IS NULL)::numeric,
      200::numeric,
      'Minimum performance monitoring volume'
    UNION ALL
    SELECT
      'component_hierarchy_links',
      (SELECT COUNT(*) FROM public.components WHERE tenant_id = v_tenant_id AND aircraft_id = v_aircraft_id AND parent_component_id IS NOT NULL AND deleted_at IS NULL)::numeric,
      8::numeric,
      'Parent-child component hierarchy coverage'
  )
  SELECT
    c.check_name,
    c.observed_value >= c.required_value,
    c.observed_value,
    c.required_value,
    c.detail
  FROM checks c;
END;
$$;

COMMIT;
