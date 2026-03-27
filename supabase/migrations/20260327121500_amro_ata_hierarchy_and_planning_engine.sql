CREATE TABLE ata_codes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  franchise_id uuid null,
  code VARCHAR(20) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES ata_codes(id),
  level SMALLINT,
  chapter_code VARCHAR(2),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, code),
  constraint ata_codes_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE,
  constraint ata_codes_franchise_id_fkey foreign KEY (franchise_id) references franchises (id) on delete set null
);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS ata_code_id uuid,
  ADD COLUMN IF NOT EXISTS mtoss_code varchar(20),
  ADD COLUMN IF NOT EXISTS skill_type varchar(50),
  ADD COLUMN IF NOT EXISTS version_number integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_by_id uuid,
  ADD COLUMN IF NOT EXISTS effective_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS obsolete_date date,
  ADD COLUMN IF NOT EXISTS applicability_rules jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_type varchar(50),
  ADD COLUMN IF NOT EXISTS source_ref varchar(100),
  ADD COLUMN IF NOT EXISTS revision_date date;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_ata_code_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_ata_code_id_fkey
  FOREIGN KEY (ata_code_id) REFERENCES public.ata_codes(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_superseded_by_id_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_superseded_by_id_fkey
  FOREIGN KEY (superseded_by_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_ata_code ON public.tasks(ata_code_id);
CREATE INDEX IF NOT EXISTS idx_tasks_mtoss_code ON public.tasks(mtoss_code);
CREATE INDEX IF NOT EXISTS idx_tasks_source_type ON public.tasks(source_type);
CREATE INDEX IF NOT EXISTS idx_task_applicability_rules ON public.tasks USING GIN (applicability_rules);
CREATE INDEX IF NOT EXISTS idx_tenant_isolation_tasks ON public.tasks(tenant_id, franchise_id);
CREATE INDEX IF NOT EXISTS idx_task_created_at ON public.tasks(created_at DESC);

CREATE TABLE IF NOT EXISTS public.task_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  interval_type varchar(50) NOT NULL,
  interval_value integer NOT NULL,
  grace_period_type varchar(20),
  grace_period_value integer,
  effective_from_interval integer NOT NULL DEFAULT 0,
  repeat_count integer,
  depends_on_interval_id uuid REFERENCES public.task_intervals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_task_intervals ON public.task_intervals(task_id, interval_type, is_active);
CREATE INDEX IF NOT EXISTS idx_task_intervals_tenant_franchise ON public.task_intervals(tenant_id, franchise_id);

CREATE TABLE IF NOT EXISTS public.aircraft_maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_activated_date date NOT NULL,
  primary_interval_id uuid REFERENCES public.task_intervals(id) ON DELETE SET NULL,
  primary_interval_type varchar(50),
  primary_interval_value integer,
  last_completed_date date,
  last_completed_flight_hours decimal(10,1),
  last_completed_landings integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_aircraft_maintenance_tasks UNIQUE (tenant_id, aircraft_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_aircraft_task_completion ON public.aircraft_maintenance_tasks(aircraft_id, last_completed_date, last_completed_flight_hours);
CREATE INDEX IF NOT EXISTS idx_aircraft_maintenance_tasks_tenant_franchise ON public.aircraft_maintenance_tasks(tenant_id, franchise_id);

CREATE TABLE IF NOT EXISTS public.maintenance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  check_type varchar(50) NOT NULL,
  check_code varchar(20) NOT NULL,
  description text,
  typical_duration_hours decimal(8,2),
  primary_interval_id uuid REFERENCES public.task_intervals(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT uq_maintenance_checks_tenant_code UNIQUE (tenant_id, check_code)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_checks_tenant_franchise ON public.maintenance_checks(tenant_id, franchise_id);

CREATE TABLE IF NOT EXISTS public.check_task_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  check_id uuid NOT NULL REFERENCES public.maintenance_checks(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_sequence integer,
  mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_check_task_mappings UNIQUE (check_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_check_task_mappings_tenant_franchise ON public.check_task_mappings(tenant_id, franchise_id);

CREATE TABLE IF NOT EXISTS public.mtoss_functions (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  code varchar(3) NOT NULL,
  description varchar(100),
  category varchar(50),
  CONSTRAINT uq_mtoss_functions_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_mtoss_functions_tenant_franchise ON public.mtoss_functions(tenant_id, franchise_id);

INSERT INTO public.mtoss_functions (tenant_id, franchise_id, code, description, category)
SELECT
  t.id AS tenant_id,
  NULL::uuid AS franchise_id,
  seed.code,
  seed.description,
  seed.category
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('040', 'Cleaning', 'Maintenance'),
    ('050', 'Inspection', 'Maintenance'),
    ('060', 'Overhaul', 'Maintenance'),
    ('070', 'Removal', 'Maintenance'),
    ('080', 'Installation', 'Maintenance'),
    ('090', 'Test', 'Verification')
) AS seed(code, description, category)
ON CONFLICT (tenant_id, code) DO UPDATE
SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;

CREATE TABLE IF NOT EXISTS public.skill_types (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  code varchar(50) NOT NULL,
  description varchar(100),
  certification_required boolean,
  min_experience_years integer,
  average_hourly_cost decimal(10,2),
  CONSTRAINT uq_skill_types_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_skill_types_tenant_franchise ON public.skill_types(tenant_id, franchise_id);

INSERT INTO public.skill_types (tenant_id, franchise_id, code, description, certification_required, min_experience_years, average_hourly_cost)
SELECT
  t.id AS tenant_id,
  NULL::uuid AS franchise_id,
  seed.code,
  seed.description,
  seed.certification_required,
  seed.min_experience_years,
  seed.average_hourly_cost
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('AIRFRAME', 'Airframe Technician', true, 5, 85.00::decimal(10,2)),
    ('ENGINE', 'Engine Technician', true, 8, 95.00::decimal(10,2)),
    ('AVIONICS', 'Avionics Technician', true, 6, 110.00::decimal(10,2)),
    ('HYDRAULIC', 'Hydraulic Systems', true, 5, 90.00::decimal(10,2))
) AS seed(code, description, certification_required, min_experience_years, average_hourly_cost)
ON CONFLICT (tenant_id, code) DO UPDATE
SET
  description = EXCLUDED.description,
  certification_required = EXCLUDED.certification_required,
  min_experience_years = EXCLUDED.min_experience_years,
  average_hourly_cost = EXCLUDED.average_hourly_cost;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_skill_type_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_skill_type_fkey
  FOREIGN KEY (tenant_id, skill_type) REFERENCES public.skill_types(tenant_id, code);

ALTER TABLE public.aircraft
  ADD COLUMN IF NOT EXISTS engine_type text,
  ADD COLUMN IF NOT EXISTS manufacturing_date date;

CREATE INDEX IF NOT EXISTS idx_aircraft_model_engine ON public.aircraft(model, engine_type, tenant_id);

CREATE OR REPLACE FUNCTION public.is_task_applicable(
  p_task_id uuid,
  p_aircraft_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_aircraft_model text;
  v_aircraft_sn text;
  v_aircraft_engine_type text;
  v_mfg_date date;
  v_applicability jsonb;
  v_rule jsonb;
  v_serial_match boolean;
BEGIN
  SELECT model, serial_number, engine_type, manufacturing_date
  INTO v_aircraft_model, v_aircraft_sn, v_aircraft_engine_type, v_mfg_date
  FROM public.aircraft
  WHERE id = p_aircraft_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  SELECT applicability_rules
  INTO v_applicability
  FROM public.tasks
  WHERE id = p_task_id
    AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_applicability IS NULL OR v_applicability = '{}'::jsonb THEN
    RETURN TRUE;
  END IF;

  IF v_applicability -> 'inclusive_conditions' IS NOT NULL THEN
    IF v_applicability -> 'inclusive_conditions' -> 'engine_types' IS NOT NULL
       AND jsonb_typeof(v_applicability -> 'inclusive_conditions' -> 'engine_types') = 'array'
       AND jsonb_array_length(v_applicability -> 'inclusive_conditions' -> 'engine_types') > 0 THEN
      IF v_aircraft_engine_type IS NULL
         OR NOT ((v_applicability -> 'inclusive_conditions' -> 'engine_types') ? v_aircraft_engine_type) THEN
        RETURN FALSE;
      END IF;
    END IF;

    IF v_applicability -> 'inclusive_conditions' -> 'aircraft_models' IS NOT NULL
       AND jsonb_typeof(v_applicability -> 'inclusive_conditions' -> 'aircraft_models') = 'array'
       AND jsonb_array_length(v_applicability -> 'inclusive_conditions' -> 'aircraft_models') > 0 THEN
      IF v_aircraft_model IS NULL
         OR NOT ((v_applicability -> 'inclusive_conditions' -> 'aircraft_models') ? v_aircraft_model) THEN
        RETURN FALSE;
      END IF;
    END IF;

    IF v_applicability -> 'inclusive_conditions' -> 'serial_number_ranges' IS NOT NULL
       AND jsonb_typeof(v_applicability -> 'inclusive_conditions' -> 'serial_number_ranges') = 'array'
       AND jsonb_array_length(v_applicability -> 'inclusive_conditions' -> 'serial_number_ranges') > 0 THEN
      v_serial_match := FALSE;
      IF v_aircraft_sn ~ '^[0-9]+$' THEN
        FOR v_rule IN
          SELECT jsonb_array_elements(v_applicability -> 'inclusive_conditions' -> 'serial_number_ranges')
        LOOP
          IF v_aircraft_sn::integer BETWEEN COALESCE((v_rule ->> 'min')::integer, v_aircraft_sn::integer)
                                       AND COALESCE((v_rule ->> 'max')::integer, v_aircraft_sn::integer) THEN
            v_serial_match := TRUE;
            EXIT;
          END IF;
        END LOOP;
      END IF;
      IF NOT v_serial_match THEN
        RETURN FALSE;
      END IF;
    END IF;

    IF v_applicability -> 'inclusive_conditions' -> 'manufacturing_date_range' IS NOT NULL
       AND jsonb_typeof(v_applicability -> 'inclusive_conditions' -> 'manufacturing_date_range') = 'object' THEN
      IF v_mfg_date IS NULL THEN
        RETURN FALSE;
      END IF;
      IF (v_applicability -> 'inclusive_conditions' -> 'manufacturing_date_range' ->> 'from') IS NOT NULL
         AND v_mfg_date < (v_applicability -> 'inclusive_conditions' -> 'manufacturing_date_range' ->> 'from')::date THEN
        RETURN FALSE;
      END IF;
      IF (v_applicability -> 'inclusive_conditions' -> 'manufacturing_date_range' ->> 'to') IS NOT NULL
         AND v_mfg_date > (v_applicability -> 'inclusive_conditions' -> 'manufacturing_date_range' ->> 'to')::date THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  IF v_applicability -> 'exclusive_conditions' IS NOT NULL THEN
    IF v_applicability -> 'exclusive_conditions' -> 'engine_types' IS NOT NULL
       AND jsonb_typeof(v_applicability -> 'exclusive_conditions' -> 'engine_types') = 'array'
       AND v_aircraft_engine_type IS NOT NULL
       AND ((v_applicability -> 'exclusive_conditions' -> 'engine_types') ? v_aircraft_engine_type) THEN
      RETURN FALSE;
    END IF;
    IF v_applicability -> 'exclusive_conditions' -> 'aircraft_models' IS NOT NULL
       AND jsonb_typeof(v_applicability -> 'exclusive_conditions' -> 'aircraft_models') = 'array'
       AND v_aircraft_model IS NOT NULL
       AND ((v_applicability -> 'exclusive_conditions' -> 'aircraft_models') ? v_aircraft_model) THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_next_due(
  p_aircraft_task_id uuid,
  p_current_flight_hours decimal,
  p_current_calendar_date date
)
RETURNS TABLE(
  interval_id uuid,
  interval_type varchar,
  next_due_value integer,
  next_due_date date,
  next_due_hours decimal,
  remaining_hours decimal,
  remaining_days integer,
  due_status varchar,
  which_comes_first varchar
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH interval_data AS (
    SELECT
      ti.id,
      ti.interval_type,
      ti.interval_value,
      ti.grace_period_type,
      ti.grace_period_value,
      amt.last_completed_flight_hours,
      amt.last_completed_date
    FROM public.task_intervals ti
    JOIN public.aircraft_maintenance_tasks amt
      ON ti.task_id = amt.task_id
    WHERE amt.id = p_aircraft_task_id
      AND ti.is_active = TRUE
      AND amt.is_active = TRUE
  ),
  due_calculations AS (
    SELECT
      id,
      interval_type,
      interval_value,
      CASE
        WHEN interval_type = 'FLIGHT_HOURS' THEN COALESCE(last_completed_flight_hours, 0) + interval_value
        ELSE NULL
      END::decimal AS next_due_hours,
      CASE
        WHEN interval_type = 'CALENDAR_MONTHS' THEN (COALESCE(last_completed_date, p_current_calendar_date) + (interval_value || ' months')::interval)::date
        ELSE NULL
      END::date AS next_due_date,
      CASE
        WHEN grace_period_type = 'PERCENT' THEN (interval_value * COALESCE(grace_period_value, 0) / 100)
        WHEN grace_period_type = 'DAYS' AND interval_type = 'CALENDAR_MONTHS' THEN COALESCE(grace_period_value, 0)
        ELSE 0
      END::integer AS grace_value
    FROM interval_data
  )
  SELECT
    dc.id AS interval_id,
    dc.interval_type,
    dc.interval_value AS next_due_value,
    dc.next_due_date,
    dc.next_due_hours,
    CASE
      WHEN dc.next_due_hours IS NOT NULL THEN (dc.next_due_hours - p_current_flight_hours)::decimal
      ELSE NULL
    END AS remaining_hours,
    CASE
      WHEN dc.next_due_date IS NOT NULL THEN (dc.next_due_date - p_current_calendar_date)::integer
      ELSE NULL
    END AS remaining_days,
    CASE
      WHEN dc.interval_type = 'FLIGHT_HOURS' THEN
        CASE
          WHEN p_current_flight_hours >= dc.next_due_hours THEN 'RED'
          WHEN p_current_flight_hours >= (dc.next_due_hours - dc.grace_value) THEN 'YELLOW'
          ELSE 'GREEN'
        END
      WHEN dc.interval_type = 'CALENDAR_MONTHS' THEN
        CASE
          WHEN p_current_calendar_date >= dc.next_due_date THEN 'RED'
          WHEN p_current_calendar_date >= (dc.next_due_date - (dc.grace_value || ' days')::interval)::date THEN 'YELLOW'
          ELSE 'GREEN'
        END
      ELSE 'GREEN'
    END::varchar AS due_status,
    CASE
      WHEN dc.next_due_hours IS NOT NULL AND dc.next_due_date IS NOT NULL THEN
        CASE
          WHEN (dc.next_due_hours - p_current_flight_hours) <= (dc.next_due_date - p_current_calendar_date)::decimal
          THEN 'HOURS'
          ELSE 'CALENDAR'
        END
      WHEN dc.next_due_hours IS NOT NULL THEN 'HOURS'
      WHEN dc.next_due_date IS NOT NULL THEN 'CALENDAR'
      ELSE NULL
    END::varchar AS which_comes_first
  FROM due_calculations dc
  ORDER BY
    CASE
      WHEN dc.interval_type = 'FLIGHT_HOURS' THEN COALESCE(dc.next_due_hours, 999999)
      WHEN dc.interval_type = 'CALENDAR_MONTHS' THEN COALESCE(EXTRACT(DAY FROM (dc.next_due_date - p_current_calendar_date)), 999999)
      ELSE 999999
    END ASC;
END;
$$;

CREATE OR REPLACE VIEW public.v_aircraft_maintenance_status AS
SELECT
  a.registration AS tail_number,
  t.task_number AS task_code,
  COALESCE(t.description, t.title) AS description,
  cnd.next_due_hours,
  cnd.next_due_date,
  cnd.remaining_hours,
  cnd.remaining_days,
  cnd.which_comes_first,
  cnd.due_status,
  CASE
    WHEN cnd.due_status = 'RED' THEN CONCAT(t.task_number, ' OVERDUE')
    WHEN cnd.due_status = 'YELLOW' THEN CONCAT(t.task_number, ' - ', COALESCE(cnd.which_comes_first, 'N/A'), ' in ', LEAST(COALESCE(cnd.remaining_hours, 999999)::integer, COALESCE(cnd.remaining_days, 999999)), ' units')
    ELSE CONCAT(t.task_number, ' - GREEN')
  END AS alert_message
FROM public.aircraft a
JOIN public.aircraft_maintenance_tasks amt ON a.id = amt.aircraft_id
JOIN public.tasks t ON amt.task_id = t.id
CROSS JOIN LATERAL public.calculate_next_due(
  amt.id,
  COALESCE(a.current_flight_hours, 0),
  CURRENT_DATE
) cnd
WHERE amt.is_active = TRUE
ORDER BY
  CASE
    WHEN cnd.due_status = 'RED' THEN 0
    WHEN cnd.due_status = 'YELLOW' THEN 1
    ELSE 2
  END,
  LEAST(COALESCE(cnd.remaining_hours, 999999)::integer, COALESCE(cnd.remaining_days, 999999)) ASC;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  entity_type varchar(50),
  entity_id uuid,
  action varchar(20),
  old_values jsonb,
  new_values jsonb,
  changed_by_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  target_table text;
  target_tables text[] := ARRAY[
    'ata_codes',
    'task_intervals',
    'aircraft_maintenance_tasks',
    'maintenance_checks',
    'check_task_mappings',
    'mtoss_functions',
    'skill_types',
    'audit_log'
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
END;
$$;
