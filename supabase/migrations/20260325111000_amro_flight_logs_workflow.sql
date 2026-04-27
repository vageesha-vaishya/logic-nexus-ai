-- DB-VERIFICATION: amro-flight-logs-workflow-reviewed
-- DB-ARCH-APPROVAL: amro-flight-logs-workflow-approved

CREATE TABLE IF NOT EXISTS public.flight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  flight_date date NOT NULL,
  flight_number text,
  departure_airport text NOT NULL,
  arrival_airport text NOT NULL,
  flight_hours decimal(10,2) NOT NULL DEFAULT 0 CHECK (flight_hours >= 0),
  block_hours decimal(10,2) NOT NULL DEFAULT 0 CHECK (block_hours >= 0),
  flight_cycles integer NOT NULL DEFAULT 0 CHECK (flight_cycles >= 0),
  crew_details text,
  fuel_burn_kg decimal(12,2) CHECK (fuel_burn_kg IS NULL OR fuel_burn_kg >= 0),
  oil_uplift_liters decimal(12,2) CHECK (oil_uplift_liters IS NULL OR oil_uplift_liters >= 0),
  pirep_discrepancy text,
  regulatory_authority text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_flight_logs_aircraft_flight_unique
  ON public.flight_logs (tenant_id, aircraft_id, flight_date, COALESCE(flight_number, ''));
CREATE INDEX IF NOT EXISTS idx_flight_logs_tenant_aircraft_date
  ON public.flight_logs (tenant_id, aircraft_id, flight_date DESC);

CREATE TABLE IF NOT EXISTS public.maintenance_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  aircraft_id uuid NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  schedule_code text NOT NULL,
  description text,
  regulatory_authority text,
  interval_hours decimal(12,2) NOT NULL DEFAULT 0 CHECK (interval_hours >= 0),
  interval_cycles integer NOT NULL DEFAULT 0 CHECK (interval_cycles >= 0),
  last_done_hours decimal(12,2) NOT NULL DEFAULT 0 CHECK (last_done_hours >= 0),
  last_done_cycles integer NOT NULL DEFAULT 0 CHECK (last_done_cycles >= 0),
  next_due_hours decimal(12,2) CHECK (next_due_hours IS NULL OR next_due_hours >= 0),
  next_due_cycles integer CHECK (next_due_cycles IS NULL OR next_due_cycles >= 0),
  near_due_buffer_hours decimal(12,2) NOT NULL DEFAULT 50 CHECK (near_due_buffer_hours >= 0),
  near_due_buffer_cycles integer NOT NULL DEFAULT 10 CHECK (near_due_buffer_cycles >= 0),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'near_due', 'due', 'overdue', 'completed')),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_maintenance_schedule_tenant_code UNIQUE (tenant_id, aircraft_id, schedule_code)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_tenant_aircraft
  ON public.maintenance_schedule (tenant_id, aircraft_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_status
  ON public.maintenance_schedule (tenant_id, status, is_active);

ALTER TABLE public.flight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS amro_platform_admin_access ON public.flight_logs;
CREATE POLICY amro_platform_admin_access ON public.flight_logs
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.flight_logs;
CREATE POLICY amro_tenant_franchise_scope ON public.flight_logs
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

DROP POLICY IF EXISTS amro_platform_admin_access ON public.maintenance_schedule;
CREATE POLICY amro_platform_admin_access ON public.maintenance_schedule
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS amro_tenant_franchise_scope ON public.maintenance_schedule;
CREATE POLICY amro_tenant_franchise_scope ON public.maintenance_schedule
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

CREATE OR REPLACE FUNCTION public.amro_record_flight_log(
  p_tenant_id uuid,
  p_franchise_id uuid,
  p_user_id uuid,
  p_aircraft_id uuid,
  p_flight_date date,
  p_flight_number text,
  p_departure_airport text,
  p_arrival_airport text,
  p_flight_hours numeric,
  p_block_hours numeric,
  p_flight_cycles integer,
  p_crew_details text,
  p_fuel_burn_kg numeric,
  p_oil_uplift_liters numeric,
  p_pirep_discrepancy text,
  p_regulatory_authority text,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_aircraft record;
  v_flight_log_id uuid;
  v_work_order_id uuid;
  v_task_id uuid;
  v_now timestamptz := now();
  v_near_due_records jsonb := '[]'::jsonb;
  v_work_order_number text;
BEGIN
  SELECT id, tail_number, current_flight_hours, current_cycles, current_flight_hours_since_new, current_cycles_since_new
  INTO v_aircraft
  FROM public.aircraft
  WHERE id = p_aircraft_id
    AND tenant_id = p_tenant_id
    AND (
      p_franchise_id IS NULL
      OR franchise_id IS NULL
      OR franchise_id = p_franchise_id
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aircraft not found for scoped tenant/franchise';
  END IF;

  INSERT INTO public.flight_logs (
    tenant_id,
    franchise_id,
    aircraft_id,
    flight_date,
    flight_number,
    departure_airport,
    arrival_airport,
    flight_hours,
    block_hours,
    flight_cycles,
    crew_details,
    fuel_burn_kg,
    oil_uplift_liters,
    pirep_discrepancy,
    regulatory_authority,
    metadata,
    created_by,
    updated_by
  )
  VALUES (
    p_tenant_id,
    p_franchise_id,
    p_aircraft_id,
    p_flight_date,
    NULLIF(trim(coalesce(p_flight_number, '')), ''),
    trim(p_departure_airport),
    trim(p_arrival_airport),
    GREATEST(coalesce(p_flight_hours, 0), 0),
    GREATEST(coalesce(p_block_hours, 0), 0),
    GREATEST(coalesce(p_flight_cycles, 0), 0),
    NULLIF(trim(coalesce(p_crew_details, '')), ''),
    CASE WHEN p_fuel_burn_kg IS NULL THEN NULL ELSE GREATEST(p_fuel_burn_kg, 0) END,
    CASE WHEN p_oil_uplift_liters IS NULL THEN NULL ELSE GREATEST(p_oil_uplift_liters, 0) END,
    NULLIF(trim(coalesce(p_pirep_discrepancy, '')), ''),
    NULLIF(trim(coalesce(p_regulatory_authority, '')), ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_flight_log_id;

  UPDATE public.aircraft
  SET
    current_flight_hours = coalesce(current_flight_hours, 0) + GREATEST(coalesce(p_flight_hours, 0), 0),
    current_cycles = coalesce(current_cycles, 0) + GREATEST(coalesce(p_flight_cycles, 0), 0),
    current_flight_hours_since_new = coalesce(current_flight_hours_since_new, 0) + GREATEST(coalesce(p_flight_hours, 0), 0),
    current_cycles_since_new = coalesce(current_cycles_since_new, 0) + GREATEST(coalesce(p_flight_cycles, 0), 0),
    updated_at = v_now,
    updated_by = p_user_id
  WHERE id = p_aircraft_id;

  UPDATE public.components
  SET
    hours_since_new = coalesce(hours_since_new, 0) + GREATEST(coalesce(p_block_hours, 0), 0),
    cycles_since_new = coalesce(cycles_since_new, 0) + GREATEST(coalesce(p_flight_cycles, 0), 0),
    updated_at = v_now,
    updated_by = p_user_id
  WHERE tenant_id = p_tenant_id
    AND aircraft_id = p_aircraft_id
    AND (
      p_franchise_id IS NULL
      OR franchise_id IS NULL
      OR franchise_id = p_franchise_id
    );

  UPDATE public.maintenance_schedule
  SET
    next_due_hours = CASE
      WHEN coalesce(next_due_hours, 0) = 0 AND interval_hours > 0 THEN coalesce(last_done_hours, 0) + interval_hours
      ELSE next_due_hours
    END,
    next_due_cycles = CASE
      WHEN coalesce(next_due_cycles, 0) = 0 AND interval_cycles > 0 THEN coalesce(last_done_cycles, 0) + interval_cycles
      ELSE next_due_cycles
    END,
    status = CASE
      WHEN (
        (coalesce(next_due_hours, 0) > 0 AND coalesce(v_aircraft.current_flight_hours, 0) + GREATEST(coalesce(p_flight_hours, 0), 0) > coalesce(next_due_hours, 0))
        OR (coalesce(next_due_cycles, 0) > 0 AND coalesce(v_aircraft.current_cycles, 0) + GREATEST(coalesce(p_flight_cycles, 0), 0) > coalesce(next_due_cycles, 0))
      ) THEN 'overdue'
      WHEN (
        (coalesce(next_due_hours, 0) > 0 AND coalesce(v_aircraft.current_flight_hours, 0) + GREATEST(coalesce(p_flight_hours, 0), 0) = coalesce(next_due_hours, 0))
        OR (coalesce(next_due_cycles, 0) > 0 AND coalesce(v_aircraft.current_cycles, 0) + GREATEST(coalesce(p_flight_cycles, 0), 0) = coalesce(next_due_cycles, 0))
      ) THEN 'due'
      WHEN (
        (coalesce(next_due_hours, 0) > 0 AND coalesce(next_due_hours, 0) - (coalesce(v_aircraft.current_flight_hours, 0) + GREATEST(coalesce(p_flight_hours, 0), 0)) <= near_due_buffer_hours)
        OR (coalesce(next_due_cycles, 0) > 0 AND coalesce(next_due_cycles, 0) - (coalesce(v_aircraft.current_cycles, 0) + GREATEST(coalesce(p_flight_cycles, 0), 0)) <= near_due_buffer_cycles)
      ) THEN 'near_due'
      ELSE 'planned'
    END,
    updated_at = v_now,
    updated_by = p_user_id
  WHERE tenant_id = p_tenant_id
    AND aircraft_id = p_aircraft_id
    AND is_active = true
    AND (
      p_franchise_id IS NULL
      OR franchise_id IS NULL
      OR franchise_id = p_franchise_id
    );

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ms.id,
        'schedule_code', ms.schedule_code,
        'status', ms.status,
        'next_due_hours', ms.next_due_hours,
        'next_due_cycles', ms.next_due_cycles,
        'regulatory_authority', ms.regulatory_authority
      )
    ),
    '[]'::jsonb
  )
  INTO v_near_due_records
  FROM public.maintenance_schedule ms
  WHERE ms.tenant_id = p_tenant_id
    AND ms.aircraft_id = p_aircraft_id
    AND ms.is_active = true
    AND ms.status IN ('near_due', 'due', 'overdue')
    AND (
      p_franchise_id IS NULL
      OR ms.franchise_id IS NULL
      OR ms.franchise_id = p_franchise_id
    );

  IF NULLIF(trim(coalesce(p_pirep_discrepancy, '')), '') IS NOT NULL THEN
    v_work_order_number := format(
      'SNAG-%s-%s',
      to_char(v_now, 'YYYYMMDDHH24MISSMS'),
      substr(md5(random()::text), 1, 6)
    );

    INSERT INTO public.work_orders (
      tenant_id,
      franchise_id,
      aircraft_id,
      work_order_number,
      title,
      description,
      work_type,
      maintenance_type,
      priority,
      source,
      planned_start_date,
      status,
      notes,
      external_reference,
      created_by,
      updated_by
    )
    VALUES (
      p_tenant_id,
      p_franchise_id,
      p_aircraft_id,
      v_work_order_number,
      format('Non-routine snag from flight log %s', v_flight_log_id),
      p_pirep_discrepancy,
      'non_routine',
      'line',
      2,
      'flight_log_pirep',
      v_now,
      'planning',
      p_pirep_discrepancy,
      v_flight_log_id::text,
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_work_order_id;

    INSERT INTO public.tasks (
      tenant_id,
      franchise_id,
      work_order_id,
      task_number,
      title,
      description,
      task_category,
      status,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_tenant_id,
      p_franchise_id,
      v_work_order_id,
      'SNAG-1',
      'Inspect and rectify pilot reported discrepancy',
      p_pirep_discrepancy,
      'non_routine_snag',
      'pending',
      p_pirep_discrepancy,
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_task_id;
  END IF;

  RETURN jsonb_build_object(
    'flight_log_id', v_flight_log_id,
    'snag_work_order_id', v_work_order_id,
    'snag_task_id', v_task_id,
    'aircraft_counter', jsonb_build_object(
      'current_flight_hours', coalesce(v_aircraft.current_flight_hours, 0) + GREATEST(coalesce(p_flight_hours, 0), 0),
      'current_cycles', coalesce(v_aircraft.current_cycles, 0) + GREATEST(coalesce(p_flight_cycles, 0), 0)
    ),
    'maintenance_flags', v_near_due_records
  );
END;
$$;
