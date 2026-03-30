BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
  t RECORD;
  tenant_key text;
  selected_franchise_id uuid;
  actor_user_id uuid;
  dxb_airport_id uuid;
  mia_airport_id uuid;
  lhr_airport_id uuid;
  sin_airport_id uuid;
  fallback_airport_id uuid;
  faa_profile_id uuid;
  easa_profile_id uuid;
  policy_snapshot_id uuid;
  seeded_aircraft_count integer;
  seeded_work_package_count integer;
  seeded_flight_log_count integer;
  seeded_event_count integer;
  seeded_signal_count integer;
BEGIN
  SELECT id
  INTO actor_user_id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF actor_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row exists; engine operations lifecycle seed requires at least one user';
  END IF;

  INSERT INTO public.manufacturers (
    manufacturer_code,
    name,
    is_active,
    metadata,
    created_by,
    updated_by
  )
  VALUES
    ('AIR', 'Airbus', true, jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'), actor_user_id, actor_user_id),
    ('BOE', 'Boeing', true, jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'), actor_user_id, actor_user_id),
    ('EMB', 'Embraer', true, jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'), actor_user_id, actor_user_id),
    ('ATR', 'ATR', true, jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'), actor_user_id, actor_user_id)
  ON CONFLICT (manufacturer_code) WHERE deleted_at IS NULL DO UPDATE
  SET
    name = EXCLUDED.name,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now(),
    deleted_at = NULL;

  INSERT INTO public.assembly_types (
    assembly_code,
    name,
    description,
    is_active,
    metadata,
    created_by,
    updated_by
  )
  VALUES
    (
      'AIRFRAME',
      'Airframe',
      'Aircraft structure and certified type-level configuration for fuselage, wings, and control surfaces.',
      true,
      jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'),
      actor_user_id,
      actor_user_id
    )
  ON CONFLICT (assembly_code) DO UPDATE
  SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  WITH airframe_type AS (
    SELECT id FROM public.assembly_types WHERE assembly_code = 'AIRFRAME' LIMIT 1
  ),
  model_seed AS (
    SELECT manufacturer_code, model_code, model_name FROM (VALUES
      ('AIR', 'A321NEO', 'A321neo'),
      ('BOE', 'B787-9', 'B787-9'),
      ('EMB', 'E190-E2', 'E190-E2'),
      ('ATR', 'ATR72-600', 'ATR72-600')
    ) AS data(manufacturer_code, model_code, model_name)
  )
  INSERT INTO public.assembly_models (
    manufacturer_id,
    assembly_type_id,
    model_code,
    name,
    primary_model,
    description,
    is_active,
    metadata,
    created_by,
    updated_by
  )
  SELECT
    manufacturer.id,
    airframe_type.id,
    model_seed.model_code,
    model_seed.model_name,
    model_seed.model_name,
    format('%s airframe model reference', model_seed.model_name),
    true,
    jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'),
    actor_user_id,
    actor_user_id
  FROM model_seed
  JOIN public.manufacturers AS manufacturer
    ON manufacturer.manufacturer_code = model_seed.manufacturer_code
   AND manufacturer.deleted_at IS NULL
  CROSS JOIN airframe_type
  ON CONFLICT (manufacturer_id, assembly_type_id, model_code) DO UPDATE
  SET
    name = EXCLUDED.name,
    primary_model = EXCLUDED.primary_model,
    description = EXCLUDED.description,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  FOR t IN SELECT id FROM public.tenants LOOP
    tenant_key := upper(substring(replace(t.id::text, '-', '') from 1 for 6));

    SELECT id
    INTO selected_franchise_id
    FROM public.franchises
    WHERE tenant_id = t.id
    ORDER BY created_at ASC
    LIMIT 1;

    INSERT INTO public.aircraft (
      id,
      tenant_id,
      franchise_id,
      registration,
      tail_number,
      serial_number,
      msn,
      line_number,
      aircraft_type,
      aircraft_model,
      manufacturer,
      manufacturer_id,
      model,
      status,
      operator_code,
      station_code,
      base_location,
      engine_type,
      configuration_code,
      maintenance_program,
      owner_name,
      defect_count,
      first_limit_remaining,
      restrictions,
      current_flight_hours,
      current_cycles,
      current_flight_hours_since_new,
      current_cycles_since_new,
      engine_install_history,
      thrust_rating_change_log,
      on_wing_lifecycle_records,
      manufacturing_date,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:aircraft:%s', t.id::text, gs::text)),
      t.id,
      selected_franchise_id,
      format('EOP-%s-%s', tenant_key, lpad(gs::text, 3, '0')),
      format('EOP%s', lpad(gs::text, 4, '0')),
      format('EOPS-%s-%s', tenant_key, lpad(gs::text, 3, '0')),
      format('EOPS-MSN-%s-%s', tenant_key, lpad(gs::text, 3, '0')),
      format('EOPS-LN-%s', lpad(gs::text, 3, '0')),
      CASE WHEN gs % 2 = 0 THEN 'NarrowBody' ELSE 'WideBody' END,
      CASE WHEN gs % 2 = 0 THEN 'A321neo' ELSE 'B787-9' END,
      CASE WHEN gs % 2 = 0 THEN 'Airbus' ELSE 'Boeing' END,
      manufacturer_ref.id,
      CASE WHEN gs % 2 = 0 THEN 'A321neo' ELSE '787-9' END,
      CASE
        WHEN gs % 8 = 0 THEN 'storage'::public.aircraft_status
        WHEN gs % 7 = 0 THEN 'grounded'::public.aircraft_status
        WHEN gs % 5 = 0 THEN 'maintenance'::public.aircraft_status
        ELSE 'active'::public.aircraft_status
      END,
      format('OP-%s', substring(tenant_key from 1 for 3)),
      CASE
        WHEN gs % 4 = 0 THEN 'DXB'
        WHEN gs % 4 = 1 THEN 'MIA'
        WHEN gs % 4 = 2 THEN 'LHR'
        ELSE 'SIN'
      END,
      CASE
        WHEN gs % 4 = 0 THEN 'DXB'
        WHEN gs % 4 = 1 THEN 'MIA'
        WHEN gs % 4 = 2 THEN 'LHR'
        ELSE 'SIN'
      END,
      CASE WHEN gs % 2 = 0 THEN 'CFM LEAP-1A33' ELSE 'GE GEnx-1B74' END,
      format('CFG-ENG-%s', lpad(((gs % 5) + 1)::text, 2, '0')),
      CASE WHEN gs % 3 = 0 THEN 'ENGINE-LIFECYCLE-EXTENDED' ELSE 'ENGINE-CORE-PROGRAM' END,
      CASE WHEN gs % 4 = 0 THEN 'Leased Fleet Holdings' ELSE 'Global Ops Air' END,
      1 + (gs % 12),
      (2200 - gs * 65)::numeric(15,2),
      CASE WHEN gs % 6 = 0 THEN 'ETOPS restriction active' WHEN gs % 5 = 0 THEN 'Reduced thrust profile' ELSE NULL END,
      (15000 + gs * 375)::numeric(15,2),
      8000 + gs * 155,
      (18000 + gs * 420)::numeric(15,2),
      9200 + gs * 170,
      jsonb_build_array(
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-L', tenant_key, lpad(gs::text, 3, '0')),
          'engine_position', 'L',
          'installed_at', (current_date - make_interval(days => (190 + gs * 4)::int))::text,
          'removed_at', NULL,
          'removal_reason', NULL
        ),
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-R', tenant_key, lpad(gs::text, 3, '0')),
          'engine_position', 'R',
          'installed_at', (current_date - make_interval(days => (182 + gs * 4)::int))::text,
          'removed_at', NULL,
          'removal_reason', NULL
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-L', tenant_key, lpad(gs::text, 3, '0')),
          'rated_thrust', 27400 + (gs * 10),
          'derate_mode', CASE WHEN gs % 3 = 0 THEN 'CLB2' WHEN gs % 2 = 0 THEN 'CLB1' ELSE 'TO' END,
          'authority_basis', CASE WHEN gs % 2 = 0 THEN 'OEM-SB-2026-A' ELSE 'MRO-ENG-POLICY-21' END,
          'effective_from', (current_date - make_interval(days => (95 + gs * 2)::int))::text
        ),
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-R', tenant_key, lpad(gs::text, 3, '0')),
          'rated_thrust', 27400 + (gs * 10),
          'derate_mode', CASE WHEN gs % 4 = 0 THEN 'CLB2' ELSE 'CLB1' END,
          'authority_basis', CASE WHEN gs % 2 = 0 THEN 'OEM-SB-2026-A' ELSE 'MRO-ENG-POLICY-21' END,
          'effective_from', (current_date - make_interval(days => (93 + gs * 2)::int))::text
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-L', tenant_key, lpad(gs::text, 3, '0')),
          'event_type', 'install',
          'event_at', (current_date - make_interval(days => (190 + gs * 4)::int))::text,
          'event_status', 'completed',
          'flight_hours_at_event', (14500 + gs * 360)::numeric(15,2),
          'cycles_at_event', 7800 + gs * 150
        ),
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-R', tenant_key, lpad(gs::text, 3, '0')),
          'event_type', 'install',
          'event_at', (current_date - make_interval(days => (182 + gs * 4)::int))::text,
          'event_status', 'completed',
          'flight_hours_at_event', (14600 + gs * 360)::numeric(15,2),
          'cycles_at_event', 7850 + gs * 150
        )
      ),
      current_date - make_interval(days => (3650 + gs * 35)::int),
      actor_user_id,
      actor_user_id
    FROM generate_series(1, 12) AS gs
    LEFT JOIN LATERAL (
      SELECT id
      FROM public.manufacturers
      WHERE deleted_at IS NULL
        AND lower(name) = CASE WHEN gs % 2 = 0 THEN 'airbus' ELSE 'boeing' END
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    ) AS manufacturer_ref ON TRUE
    ON CONFLICT (id) DO UPDATE
    SET
      tenant_id = EXCLUDED.tenant_id,
      franchise_id = EXCLUDED.franchise_id,
      registration = EXCLUDED.registration,
      tail_number = EXCLUDED.tail_number,
      msn = EXCLUDED.msn,
      line_number = EXCLUDED.line_number,
      aircraft_type = EXCLUDED.aircraft_type,
      aircraft_model = EXCLUDED.aircraft_model,
      manufacturer = EXCLUDED.manufacturer,
      manufacturer_id = EXCLUDED.manufacturer_id,
      model = EXCLUDED.model,
      status = EXCLUDED.status,
      operator_code = EXCLUDED.operator_code,
      station_code = EXCLUDED.station_code,
      base_location = EXCLUDED.base_location,
      engine_type = EXCLUDED.engine_type,
      configuration_code = EXCLUDED.configuration_code,
      maintenance_program = EXCLUDED.maintenance_program,
      owner_name = EXCLUDED.owner_name,
      defect_count = EXCLUDED.defect_count,
      first_limit_remaining = EXCLUDED.first_limit_remaining,
      restrictions = EXCLUDED.restrictions,
      current_flight_hours = EXCLUDED.current_flight_hours,
      current_cycles = EXCLUDED.current_cycles,
      current_flight_hours_since_new = EXCLUDED.current_flight_hours_since_new,
      current_cycles_since_new = EXCLUDED.current_cycles_since_new,
      engine_install_history = EXCLUDED.engine_install_history,
      thrust_rating_change_log = EXCLUDED.thrust_rating_change_log,
      on_wing_lifecycle_records = EXCLUDED.on_wing_lifecycle_records,
      manufacturing_date = EXCLUDED.manufacturing_date,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    SELECT id INTO dxb_airport_id FROM public.airports WHERE iata_code = 'DXB' LIMIT 1;
    SELECT id INTO mia_airport_id FROM public.airports WHERE iata_code = 'MIA' LIMIT 1;
    SELECT id INTO lhr_airport_id FROM public.airports WHERE iata_code = 'LHR' LIMIT 1;
    SELECT id INTO sin_airport_id FROM public.airports WHERE iata_code = 'SIN' LIMIT 1;
    SELECT id INTO fallback_airport_id FROM public.airports ORDER BY created_at ASC LIMIT 1;

    IF dxb_airport_id IS NULL THEN dxb_airport_id := fallback_airport_id; END IF;
    IF mia_airport_id IS NULL THEN mia_airport_id := fallback_airport_id; END IF;
    IF lhr_airport_id IS NULL THEN lhr_airport_id := fallback_airport_id; END IF;
    IF sin_airport_id IS NULL THEN sin_airport_id := fallback_airport_id; END IF;

    INSERT INTO public.regulator_profiles (
      id,
      tenant_id,
      franchise_id,
      regulator_code,
      regulator_name,
      jurisdiction,
      policy_version,
      effective_from,
      is_active,
      metadata,
      created_by,
      updated_by
    )
    VALUES
      (
        extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s-reg-faa', t.id::text)),
        t.id,
        selected_franchise_id,
        'FAA',
        'Federal Aviation Administration',
        'US',
        '2026.1',
        current_date - 365,
        true,
        jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'),
        actor_user_id,
        actor_user_id
      ),
      (
        extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s-reg-easa', t.id::text)),
        t.id,
        selected_franchise_id,
        'EASA',
        'European Union Aviation Safety Agency',
        'EU',
        '2026.1',
        current_date - 365,
        true,
        jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1'),
        actor_user_id,
        actor_user_id
      )
    ON CONFLICT (tenant_id, COALESCE(franchise_id, '00000000-0000-0000-0000-000000000000'::uuid), regulator_code, policy_version) WHERE deleted_at IS NULL DO UPDATE
    SET
      regulator_name = EXCLUDED.regulator_name,
      jurisdiction = EXCLUDED.jurisdiction,
      policy_version = EXCLUDED.policy_version,
      effective_from = EXCLUDED.effective_from,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    SELECT id INTO faa_profile_id
    FROM public.regulator_profiles
    WHERE tenant_id = t.id
      AND franchise_id IS NOT DISTINCT FROM selected_franchise_id
      AND regulator_code = 'FAA'
      AND policy_version = '2026.1'
    LIMIT 1;
    SELECT id INTO easa_profile_id
    FROM public.regulator_profiles
    WHERE tenant_id = t.id
      AND franchise_id IS NOT DISTINCT FROM selected_franchise_id
      AND regulator_code = 'EASA'
      AND policy_version = '2026.1'
    LIMIT 1;

    INSERT INTO public.policy_snapshots (
      id,
      tenant_id,
      franchise_id,
      policy_type,
      version,
      policy_key,
      rules_json,
      effective_at,
      checksum,
      created_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s-policy-engine-release-v1', t.id::text)),
      t.id,
      selected_franchise_id,
      'engine_release_gate',
      1,
      format('eng-release-%s-v1', tenant_key),
      jsonb_build_object(
        'minimum_health_score', 65,
        'required_signatures', 2,
        'allow_expired_warranty_release', false,
        'required_regulators', jsonb_build_array('FAA', 'EASA'),
        'seed_source', 'engine_ops_lifecycle_v1'
      ),
      now() - interval '60 days',
      md5(format('%s:%s:%s', t.id::text, 'engine_release_gate', 'v1')),
      actor_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.policy_snapshots ps
      WHERE ps.tenant_id = t.id
        AND ps.policy_key = format('eng-release-%s-v1', tenant_key)
    );

    SELECT id
    INTO policy_snapshot_id
    FROM public.policy_snapshots
    WHERE tenant_id = t.id
      AND policy_key = format('eng-release-%s-v1', tenant_key)
    LIMIT 1;

    INSERT INTO public.components (
      id,
      tenant_id,
      franchise_id,
      aircraft_id,
      part_number,
      serial_number,
      alternate_part_numbers,
      component_type,
      category,
      manufacturer,
      model,
      ata_chapter,
      is_llp_part,
      llp_hours,
      llp_cycles,
      llp_calendar_days,
      status,
      condition_code,
      installation_date,
      removal_date,
      hours_since_new,
      cycles_since_new,
      location,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:%s:%s', t.id::text, a.id::text, side.engine_position)),
      t.id,
      selected_franchise_id,
      a.id,
      CASE WHEN side.engine_position = 'L' THEN 'ENG-ASSY-LH' ELSE 'ENG-ASSY-RH' END,
      format('ENG-%s-%s-%s', tenant_key, right(a.tail_number, 4), side.engine_position),
      ARRAY[
        format('ENG-ALT-%s-%s', right(a.tail_number, 4), side.engine_position),
        format('ENG-CFG-%s', CASE WHEN a.engine_type ILIKE '%LEAP%' THEN 'LEAP' ELSE 'GENX' END)
      ],
      'engine_module',
      'engine',
      CASE WHEN a.engine_type ILIKE '%LEAP%' THEN 'CFM International' ELSE 'GE Aerospace' END,
      CASE WHEN a.engine_type ILIKE '%LEAP%' THEN 'LEAP-1A' ELSE 'GEnx-1B' END,
      '72',
      true,
      (22000 + side.position_index * 450)::numeric(10,2),
      18500 + side.position_index * 550,
      4380,
      CASE
        WHEN side.position_index % 9 = 0 THEN 'under_repair'::public.component_status
        WHEN side.position_index % 7 = 0 THEN 'repair_queue'::public.component_status
        ELSE 'installed'::public.component_status
      END,
      CASE
        WHEN side.position_index % 9 = 0 THEN 'UNSERVICEABLE'
        WHEN side.position_index % 5 = 0 THEN 'FAIR'
        ELSE 'GOOD'
      END,
      now() - make_interval(days => (450 + side.position_index * 15)::int),
      CASE WHEN side.position_index % 9 = 0 THEN now() - make_interval(days => (5 + side.position_index % 3)::int) ELSE NULL END,
      (6200 + side.position_index * 110)::numeric(15,2),
      3600 + side.position_index * 70,
      CASE WHEN side.position_index % 9 = 0 THEN 'ENG_SHOP_QUEUE' ELSE format('WING_%s', side.engine_position) END,
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        a.id,
        a.tail_number,
        a.engine_type,
        row_number() OVER (ORDER BY a.tail_number) AS aircraft_rank
      FROM public.aircraft a
      WHERE a.tenant_id = t.id
        AND a.serial_number LIKE format('EOPS-%s-%%', tenant_key)
      ORDER BY a.tail_number
    ) a
    CROSS JOIN LATERAL (
      VALUES
        ('L', (a.aircraft_rank * 2) - 1),
        ('R', a.aircraft_rank * 2)
    ) AS side(engine_position, position_index)
    ON CONFLICT (id) DO UPDATE
    SET
      part_number = EXCLUDED.part_number,
      serial_number = EXCLUDED.serial_number,
      alternate_part_numbers = EXCLUDED.alternate_part_numbers,
      component_type = EXCLUDED.component_type,
      category = EXCLUDED.category,
      manufacturer = EXCLUDED.manufacturer,
      model = EXCLUDED.model,
      ata_chapter = EXCLUDED.ata_chapter,
      is_llp_part = EXCLUDED.is_llp_part,
      llp_hours = EXCLUDED.llp_hours,
      llp_cycles = EXCLUDED.llp_cycles,
      llp_calendar_days = EXCLUDED.llp_calendar_days,
      status = EXCLUDED.status,
      condition_code = EXCLUDED.condition_code,
      installation_date = EXCLUDED.installation_date,
      removal_date = EXCLUDED.removal_date,
      hours_since_new = EXCLUDED.hours_since_new,
      cycles_since_new = EXCLUDED.cycles_since_new,
      location = EXCLUDED.location,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

    INSERT INTO public.maintenance_schedule (
      id,
      tenant_id,
      franchise_id,
      aircraft_id,
      schedule_code,
      description,
      regulatory_authority,
      interval_hours,
      interval_cycles,
      last_done_hours,
      last_done_cycles,
      next_due_hours,
      next_due_cycles,
      near_due_buffer_hours,
      near_due_buffer_cycles,
      status,
      is_active,
      metadata,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:%s:%s', t.id::text, a.id::text, s.schedule_code)),
      t.id,
      selected_franchise_id,
      a.id,
      s.schedule_code,
      s.description,
      s.regulatory_authority,
      s.interval_hours,
      s.interval_cycles,
      GREATEST(a.current_flight_hours - s.last_done_offset_hours, 0),
      GREATEST(a.current_cycles - s.last_done_offset_cycles, 0),
      GREATEST(a.current_flight_hours + s.next_due_delta_hours, 0),
      GREATEST(a.current_cycles + s.next_due_delta_cycles, 0),
      s.near_due_buffer_hours,
      s.near_due_buffer_cycles,
      s.schedule_status,
      true,
      jsonb_build_object(
        'seed_source', 'engine_ops_lifecycle_v1',
        'warranty_status', CASE WHEN a.aircraft_rank % 4 = 0 THEN 'expired' ELSE 'active' END,
        'program', a.maintenance_program
      ),
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        a.id,
        a.current_flight_hours,
        a.current_cycles,
        a.maintenance_program,
        row_number() OVER (ORDER BY a.tail_number) AS aircraft_rank
      FROM public.aircraft a
      WHERE a.tenant_id = t.id
        AND a.serial_number LIKE format('EOPS-%s-%%', tenant_key)
    ) a
    CROSS JOIN LATERAL (
      VALUES
        ('ENG-BORESCOPE-90D', 'Engine borescope and compressor stage visual inspection', 'FAA', 550::numeric, 320, 420::numeric, 230, 35::numeric, 18, 45::numeric, 10, 'near_due'),
        ('ENG-OIL-ANALYSIS-30D', 'Spectrometric oil analysis and filter debris check', 'EASA', 180::numeric, 95, 120::numeric, 55, -6::numeric, -4, 18::numeric, 5, 'overdue'),
        ('ENG-HOT-SECTION-CHK', 'Hot-section trend restoration planning gate', 'FAA', 2400::numeric, 1300, 2200::numeric, 1180, 240::numeric, 120, 80::numeric, 20, 'planned'),
        ('ENG-LLP-CYCLE-AUDIT', 'Life-limited part cycle audit and projection', 'EASA', 0::numeric, 500, 0::numeric, 450, 0::numeric, 20, 0::numeric, 12, 'due')
    ) AS s(
      schedule_code,
      description,
      regulatory_authority,
      interval_hours,
      interval_cycles,
      last_done_offset_hours,
      last_done_offset_cycles,
      next_due_delta_hours,
      next_due_delta_cycles,
      near_due_buffer_hours,
      near_due_buffer_cycles,
      schedule_status
    )
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
      near_due_buffer_hours = EXCLUDED.near_due_buffer_hours,
      near_due_buffer_cycles = EXCLUDED.near_due_buffer_cycles,
      status = EXCLUDED.status,
      metadata = EXCLUDED.metadata,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

    INSERT INTO public.work_packages (
      id,
      tenant_id,
      franchise_id,
      aircraft_id,
      work_order_number,
      work_package_number,
      title,
      description,
      work_type,
      maintenance_type,
      priority,
      source,
      planned_start_date,
      planned_end_date,
      planned_start,
      planned_end,
      actual_start_date,
      actual_end_date,
      estimated_labor_hours,
      estimated_downtime_minutes,
      estimated_cost,
      actual_labor_hours,
      actual_cost,
      status,
      assigned_to,
      supervisor_id,
      reference_documents,
      notes,
      external_reference,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:%s:%s', t.id::text, a.id::text, p.package_code)),
      t.id,
      selected_franchise_id,
      a.id,
      format('WO-%s-%s-%s', tenant_key, right(a.tail_number, 4), p.package_code),
      format('WP-%s-%s-%s', tenant_key, right(a.tail_number, 4), p.package_code),
      p.title,
      p.description,
      p.work_type,
      p.maintenance_type::public.maintenance_type,
      p.priority,
      p.source,
      now() + make_interval(days => p.start_offset_days::int),
      now() + make_interval(days => p.end_offset_days::int),
      now() + make_interval(days => p.start_offset_days::int),
      now() + make_interval(days => p.end_offset_days::int),
      CASE WHEN p.package_status IN ('in_progress', 'completed', 'closed') THEN now() + make_interval(days => p.start_offset_days::int) ELSE NULL END,
      CASE WHEN p.package_status IN ('completed', 'closed') THEN now() + make_interval(days => p.end_offset_days::int) ELSE NULL END,
      p.estimated_labor_hours,
      p.estimated_downtime_minutes,
      p.estimated_cost,
      CASE WHEN p.package_status IN ('completed', 'closed') THEN p.estimated_labor_hours - 2 ELSE NULL END,
      CASE WHEN p.package_status IN ('completed', 'closed') THEN p.estimated_cost * 0.97 ELSE NULL END,
      p.package_status::public.work_package_status,
      actor_user_id,
      actor_user_id,
      ARRAY[
        format('AMM-72-%s', p.package_code),
        format('SRM-70-%s', right(a.tail_number, 4))
      ],
      CASE WHEN a.aircraft_rank % 4 = 0 AND p.package_code = 'WARRANTY' THEN 'Warranty expired and escalation to MRO finance gate' ELSE p.notes END,
      format('MEL-%s-%s', right(a.tail_number, 4), p.package_code),
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        a.id,
        a.tail_number,
        row_number() OVER (ORDER BY a.tail_number) AS aircraft_rank
      FROM public.aircraft a
      WHERE a.tenant_id = t.id
        AND a.serial_number LIKE format('EOPS-%s-%%', tenant_key)
    ) a
    CROSS JOIN LATERAL (
      VALUES
        ('BORESCOPE', 'Engine borescope inspection package', 'Focused borescope campaign for compressor and turbine stages', 'engine_inspection', 'inspection', 4, 'predictive_monitoring', -2, 1, 18::numeric, 600, 24500::numeric, 'in_progress', 'Borescope initiated by condition monitoring signal'),
        ('HOTSEC', 'Hot section intervention planning', 'Prepare hot-section kit and execute scoped replacement', 'engine_overhaul', 'overhaul', 5, 'condition_trigger', 3, 8, 44::numeric, 1440, 78000::numeric, 'planning', 'Awaiting slot and material reservation'),
        ('OILANALYSIS', 'Oil consumption exceedance corrective action', 'Address repeated oil consumption anomalies and contamination trend', 'engine_repair', 'repair', 5, 'defect_report', -7, -3, 26::numeric, 720, 35500::numeric, 'approved', 'Overdue maintenance requiring immediate dispatch'),
        ('LLPAUDIT', 'LLP cycle projection and replacement prep', 'Review LLP cycle margin and publish replacement decision', 'engine_compliance', 'inspection', 3, 'llp_threshold', 1, 4, 14::numeric, 300, 18000::numeric, 'scheduled', 'Lifecycle planning queue'),
        ('WARRANTY', 'Engine warranty status review', 'Assess warranty entitlement and claim handling for high-time assets', 'engine_admin', 'line', 2, 'contractual_trigger', -12, -9, 8::numeric, 120, 6200::numeric, 'closed', 'Warranty workflow completed')
    ) AS p(
      package_code,
      title,
      description,
      work_type,
      maintenance_type,
      priority,
      source,
      start_offset_days,
      end_offset_days,
      estimated_labor_hours,
      estimated_downtime_minutes,
      estimated_cost,
      package_status,
      notes
    )
    ON CONFLICT (work_order_number) DO UPDATE
    SET
      work_package_number = EXCLUDED.work_package_number,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      work_type = EXCLUDED.work_type,
      maintenance_type = EXCLUDED.maintenance_type,
      priority = EXCLUDED.priority,
      source = EXCLUDED.source,
      planned_start_date = EXCLUDED.planned_start_date,
      planned_end_date = EXCLUDED.planned_end_date,
      planned_start = EXCLUDED.planned_start,
      planned_end = EXCLUDED.planned_end,
      actual_start_date = EXCLUDED.actual_start_date,
      actual_end_date = EXCLUDED.actual_end_date,
      estimated_labor_hours = EXCLUDED.estimated_labor_hours,
      estimated_downtime_minutes = EXCLUDED.estimated_downtime_minutes,
      estimated_cost = EXCLUDED.estimated_cost,
      actual_labor_hours = EXCLUDED.actual_labor_hours,
      actual_cost = EXCLUDED.actual_cost,
      status = EXCLUDED.status,
      assigned_to = EXCLUDED.assigned_to,
      supervisor_id = EXCLUDED.supervisor_id,
      reference_documents = EXCLUDED.reference_documents,
      notes = EXCLUDED.notes,
      external_reference = EXCLUDED.external_reference,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.tasks (
      id,
      tenant_id,
      franchise_id,
      work_package_id,
      task_number,
      title,
      description,
      task_category,
      estimated_duration_hours,
      complexity_level,
      procedure_reference,
      steps,
      steps_json,
      qualifications,
      qualifications_json,
      evidence_fields,
      sequence_order,
      sequence,
      planned_start_date,
      planned_end_date,
      status,
      progress_percentage,
      assigned_to,
      assigned_technician_id,
      checklist,
      notes,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:%s:%s', t.id::text, wp.id::text, tp.task_code)),
      t.id,
      selected_franchise_id,
      wp.id,
      format('TSK-%s-%s', right(wp.work_package_number, 4), tp.task_code),
      tp.title,
      tp.description,
      tp.category,
      tp.duration_hours,
      tp.complexity_level,
      tp.procedure_reference,
      tp.steps_json,
      tp.steps_json,
      tp.qualifications_json,
      tp.qualifications_json,
      tp.evidence_fields_json,
      tp.sequence_no,
      tp.sequence_no,
      wp.planned_start,
      wp.planned_end,
      tp.task_status::public.task_status,
      tp.progress_pct,
      actor_user_id,
      actor_user_id,
      jsonb_build_object(
        'items',
        jsonb_build_array(
          jsonb_build_object('id', 'prep', 'name', 'Preparation', 'completed', tp.progress_pct >= 25),
          jsonb_build_object('id', 'inspect', 'name', 'Inspection', 'completed', tp.progress_pct >= 60),
          jsonb_build_object('id', 'closeout', 'name', 'Close-out', 'completed', tp.progress_pct = 100)
        )
      ),
      tp.task_notes,
      actor_user_id,
      actor_user_id
    FROM public.work_packages wp
    CROSS JOIN LATERAL (
      VALUES
        (
          'PREP',
          1,
          'Engine package preparation and safety zoning',
          'Confirm tools, permits, and safety lockout',
          'planning',
          2.0::numeric,
          2,
          'AMM-71-00-00',
          jsonb_build_array(
            jsonb_build_object('step_number', 1, 'description', 'Review job card and permits', 'duration_minutes', 30),
            jsonb_build_object('step_number', 2, 'description', 'Establish safety zone and lockout', 'duration_minutes', 45)
          ),
          jsonb_build_object('rating', 'Powerplant', 'scope', 'Engine', 'currency_days', 90, 'specific_types', jsonb_build_array('A321neo', 'B787-9')),
          jsonb_build_array(
            jsonb_build_object('field_type', 'signature', 'required', true, 'field_name', 'safety_release'),
            jsonb_build_object('field_type', 'inspection_checklist', 'required', true, 'field_name', 'prep_check')
          ),
          'in_progress',
          40,
          'Preparation in progress'
        ),
        (
          'INSPECT',
          2,
          'Core inspection and borescope evidence capture',
          'Inspect fan, compressor, combustor, and turbine paths',
          'inspection',
          4.5::numeric,
          4,
          'AMM-72-00-00',
          jsonb_build_array(
            jsonb_build_object('step_number', 1, 'description', 'Insert borescope and capture baseline imagery', 'duration_minutes', 90),
            jsonb_build_object('step_number', 2, 'description', 'Measure blade tip clearance and scoring', 'duration_minutes', 75)
          ),
          jsonb_build_object('rating', 'Powerplant', 'scope', 'Borescope', 'currency_days', 60, 'specific_types', jsonb_build_array('CFM LEAP-1A33', 'GE GEnx-1B74')),
          jsonb_build_array(
            jsonb_build_object('field_type', 'photo', 'required', true, 'field_name', 'borescope_images'),
            jsonb_build_object('field_type', 'measurement', 'required', true, 'field_name', 'clearance_measurements')
          ),
          'not_started',
          0,
          'Queued for inspection slot'
        ),
        (
          'CORRECT',
          3,
          'Corrective intervention and component replacement',
          'Replace worn items and restore acceptance limits',
          'repair',
          5.0::numeric,
          5,
          'AMM-72-20-00',
          jsonb_build_array(
            jsonb_build_object('step_number', 1, 'description', 'Remove affected module', 'duration_minutes', 110),
            jsonb_build_object('step_number', 2, 'description', 'Install replacement and torque checks', 'duration_minutes', 130)
          ),
          jsonb_build_object('rating', 'Powerplant', 'scope', 'Engine repair', 'currency_days', 120, 'specific_types', jsonb_build_array('CFM LEAP-1A33', 'GE GEnx-1B74')),
          jsonb_build_array(
            jsonb_build_object('field_type', 'measurement', 'required', true, 'field_name', 'post_install_torque'),
            jsonb_build_object('field_type', 'signature', 'required', true, 'field_name', 'repair_signoff')
          ),
          'pending',
          0,
          'Pending part arrival'
        ),
        (
          'RELEASE',
          4,
          'Regulatory release and digital signature',
          'Finalize package, verify compliance and release to service',
          'certification',
          1.5::numeric,
          3,
          'AMM-00-00-00',
          jsonb_build_array(
            jsonb_build_object('step_number', 1, 'description', 'Review evidence completeness', 'duration_minutes', 30),
            jsonb_build_object('step_number', 2, 'description', 'Apply digital release signature', 'duration_minutes', 20)
          ),
          jsonb_build_object('rating', 'A&P', 'scope', 'Release', 'currency_days', 30, 'specific_types', jsonb_build_array('A321neo', 'B787-9')),
          jsonb_build_array(
            jsonb_build_object('field_type', 'signature', 'required', true, 'field_name', 'release_signature'),
            jsonb_build_object('field_type', 'inspection_checklist', 'required', true, 'field_name', 'release_gate')
          ),
          CASE WHEN wp.status IN ('completed', 'closed') THEN 'completed' ELSE 'pending' END,
          CASE WHEN wp.status IN ('completed', 'closed') THEN 100 ELSE 0 END,
          CASE WHEN wp.status IN ('completed', 'closed') THEN 'Released to service' ELSE 'Awaiting compliance approvals' END
        )
    ) AS tp(
      task_code,
      sequence_no,
      title,
      description,
      category,
      duration_hours,
      complexity_level,
      procedure_reference,
      steps_json,
      qualifications_json,
      evidence_fields_json,
      task_status,
      progress_pct,
      task_notes
    )
    WHERE wp.tenant_id = t.id
      AND wp.work_package_number LIKE format('WP-%s-%%', tenant_key)
    ON CONFLICT (id) DO UPDATE
    SET
      task_number = EXCLUDED.task_number,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      task_category = EXCLUDED.task_category,
      estimated_duration_hours = EXCLUDED.estimated_duration_hours,
      complexity_level = EXCLUDED.complexity_level,
      procedure_reference = EXCLUDED.procedure_reference,
      steps = EXCLUDED.steps,
      steps_json = EXCLUDED.steps_json,
      qualifications = EXCLUDED.qualifications,
      qualifications_json = EXCLUDED.qualifications_json,
      evidence_fields = EXCLUDED.evidence_fields,
      sequence_order = EXCLUDED.sequence_order,
      sequence = EXCLUDED.sequence,
      planned_start_date = EXCLUDED.planned_start_date,
      planned_end_date = EXCLUDED.planned_end_date,
      status = EXCLUDED.status,
      progress_percentage = EXCLUDED.progress_percentage,
      assigned_to = EXCLUDED.assigned_to,
      assigned_technician_id = EXCLUDED.assigned_technician_id,
      checklist = EXCLUDED.checklist,
      notes = EXCLUDED.notes,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.parts_inventory (
      id,
      tenant_id,
      franchise_id,
      part_number,
      serial_number,
      batch_number,
      description,
      supplier_name,
      warehouse_location,
      quantity_on_hand,
      quantity_reserved,
      reorder_level,
      reorder_quantity,
      unit_cost,
      currency,
      status,
      category,
      condition_code,
      uom,
      unit_of_measure,
      min_stock_level,
      expiry_date,
      last_movement_at,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:%s:%s', t.id::text, a.id::text, pi.part_code)),
      t.id,
      selected_franchise_id,
      format('ENG-PN-%s-%s-%s', tenant_key, right(a.tail_number, 4), pi.part_code),
      CASE WHEN pi.is_serialized THEN format('ENG-SN-%s-%s-%s', tenant_key, right(a.tail_number, 4), pi.part_code) ELSE NULL END,
      format('ENG-BATCH-%s', right(a.tail_number, 4)),
      pi.description,
      'AMRO Supplier Engine Cell',
      format('WH-%s-ENG-A%02s', a.station_code, a.aircraft_rank),
      pi.qty_on_hand,
      LEAST(pi.qty_reserved, pi.qty_on_hand),
      pi.reorder_level,
      pi.reorder_quantity,
      pi.unit_cost,
      'USD',
      pi.inventory_status,
      pi.category,
      pi.condition_code,
      'EA',
      'EA',
      pi.min_stock_level,
      current_date + make_interval(days => pi.expiry_offset_days::int),
      now() - make_interval(days => (a.aircraft_rank + pi.qty_reserved)::int),
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        a.id,
        a.tail_number,
        a.station_code,
        row_number() OVER (ORDER BY a.tail_number) AS aircraft_rank
      FROM public.aircraft a
      WHERE a.tenant_id = t.id
        AND a.serial_number LIKE format('EOPS-%s-%%', tenant_key)
    ) a
    CROSS JOIN LATERAL (
      VALUES
        ('LLP-KIT', 'LLP replacement hardware kit', true, 6, 4, 5, 12, 18500::numeric, 'reserved', 'rotable', 'SERVICEABLE', 4, 120),
        ('SEAL-SET', 'Engine seal and gasket set', false, 42, 8, 20, 40, 480::numeric, 'available', 'consumable', 'NEW', 10, 365),
        ('FILTER-OIL', 'Oil system filter element', false, 14, 12, 20, 30, 135::numeric, 'low_stock', 'consumable', 'NEW', 12, 45),
        ('BORESCOPE', 'Borescope tip and guide tube', true, 2, 0, 1, 2, 3200::numeric, 'quarantined', 'tooling', 'QUARANTINE', 1, -15)
    ) AS pi(
      part_code,
      description,
      is_serialized,
      qty_on_hand,
      qty_reserved,
      reorder_level,
      reorder_quantity,
      unit_cost,
      inventory_status,
      category,
      condition_code,
      min_stock_level,
      expiry_offset_days
    )
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
      currency = EXCLUDED.currency,
      status = EXCLUDED.status,
      category = EXCLUDED.category,
      condition_code = EXCLUDED.condition_code,
      uom = EXCLUDED.uom,
      unit_of_measure = EXCLUDED.unit_of_measure,
      min_stock_level = EXCLUDED.min_stock_level,
      expiry_date = EXCLUDED.expiry_date,
      last_movement_at = EXCLUDED.last_movement_at,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.flight_logs (
      id,
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
      fuel_unit,
      oil_uplift_liters,
      pirep_discrepancy,
      regulatory_authority,
      metadata,
      log_selection_no,
      log_page_no,
      time_out,
      time_off,
      time_on,
      time_in,
      landings,
      flight_type,
      delay_code,
      total_airframe_hours_at_landing,
      total_cycles_at_landing,
      service_check_performed,
      engineer_sign_off_id,
      flight_log_type,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:%s:flight:%s', t.id::text, a.id::text, gs::text)),
      t.id,
      selected_franchise_id,
      a.id,
      current_date - gs,
      format('EO%s%s', right(a.tail_number, 3), lpad(gs::text, 3, '0')),
      CASE WHEN gs % 4 = 0 THEN dxb_airport_id WHEN gs % 4 = 1 THEN mia_airport_id WHEN gs % 4 = 2 THEN lhr_airport_id ELSE sin_airport_id END,
      CASE WHEN gs % 4 = 0 THEN lhr_airport_id WHEN gs % 4 = 1 THEN sin_airport_id WHEN gs % 4 = 2 THEN dxb_airport_id ELSE mia_airport_id END,
      (2.4 + ((gs % 6) * 0.35))::numeric(10,2),
      (2.7 + ((gs % 6) * 0.38))::numeric(10,2),
      1 + (gs % 2),
      format('Capt %s / FO %s', right(a.tail_number, 2), lpad((gs % 97)::text, 2, '0')),
      (6800 + gs * 55)::numeric(12,2),
      'KG',
      (6.5 + (gs % 8) * 0.4)::numeric(12,2),
      CASE WHEN gs % 11 = 0 THEN 'Mild vibration trend noted post-climb' ELSE NULL END,
      CASE WHEN gs % 2 = 0 THEN 'FAA' ELSE 'EASA' END,
      jsonb_build_object('seed_source', 'engine_ops_lifecycle_v1', 'engine_cycle_profile', CASE WHEN gs % 10 = 0 THEN 'high_stress' ELSE 'normal' END),
      format('SEL-%s', lpad(gs::text, 3, '0')),
      format('P-%s', lpad(gs::text, 3, '0')),
      date_trunc('day', now() - make_interval(days => gs::int)) + interval '05:00',
      date_trunc('day', now() - make_interval(days => gs::int)) + interval '05:20',
      date_trunc('day', now() - make_interval(days => gs::int)) + interval '08:25' + make_interval(mins => (gs % 25)::int),
      date_trunc('day', now() - make_interval(days => gs::int)) + interval '08:45' + make_interval(mins => (gs % 25)::int),
      1 + (gs % 2),
      CASE WHEN gs % 7 = 0 THEN 'Charter' ELSE 'Scheduled' END,
      CASE WHEN gs % 13 = 0 THEN 'WX' WHEN gs % 9 = 0 THEN 'MX' ELSE NULL END,
      (a.current_flight_hours + gs * 2.8)::numeric(12,2),
      a.current_cycles + gs,
      gs % 3 <> 0,
      actor_user_id,
      CASE WHEN gs % 17 = 0 THEN 'Maintenance Log'::public."LogType" WHEN gs % 23 = 0 THEN 'VOID Log'::public."LogType" ELSE 'Journey'::public."LogType" END,
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        a.id,
        a.tail_number,
        a.current_flight_hours,
        a.current_cycles
      FROM public.aircraft a
      WHERE a.tenant_id = t.id
        AND a.serial_number LIKE format('EOPS-%s-%%', tenant_key)
    ) a
    CROSS JOIN generate_series(1, 24) gs
    ON CONFLICT (id) DO UPDATE
    SET
      flight_number = EXCLUDED.flight_number,
      departure_airport = EXCLUDED.departure_airport,
      arrival_airport = EXCLUDED.arrival_airport,
      flight_hours = EXCLUDED.flight_hours,
      block_hours = EXCLUDED.block_hours,
      flight_cycles = EXCLUDED.flight_cycles,
      crew_details = EXCLUDED.crew_details,
      fuel_burn_kg = EXCLUDED.fuel_burn_kg,
      fuel_unit = EXCLUDED.fuel_unit,
      oil_uplift_liters = EXCLUDED.oil_uplift_liters,
      pirep_discrepancy = EXCLUDED.pirep_discrepancy,
      regulatory_authority = EXCLUDED.regulatory_authority,
      metadata = EXCLUDED.metadata,
      log_selection_no = EXCLUDED.log_selection_no,
      log_page_no = EXCLUDED.log_page_no,
      time_out = EXCLUDED.time_out,
      time_off = EXCLUDED.time_off,
      time_on = EXCLUDED.time_on,
      time_in = EXCLUDED.time_in,
      landings = EXCLUDED.landings,
      flight_type = EXCLUDED.flight_type,
      delay_code = EXCLUDED.delay_code,
      total_airframe_hours_at_landing = EXCLUDED.total_airframe_hours_at_landing,
      total_cycles_at_landing = EXCLUDED.total_cycles_at_landing,
      service_check_performed = EXCLUDED.service_check_performed,
      engineer_sign_off_id = EXCLUDED.engineer_sign_off_id,
      flight_log_type = EXCLUDED.flight_log_type,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

    INSERT INTO public.asset_health_signals (
      id,
      tenant_id,
      franchise_id,
      aircraft_id,
      component_id,
      signal_type,
      signal_source,
      signal_timestamp,
      value_numeric,
      value_text,
      unit,
      quality_score,
      metadata,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:%s:%s:%s', t.id::text, c.aircraft_id::text, c.component_id::text, sig.signal_key)),
      t.id,
      selected_franchise_id,
      c.aircraft_id,
      c.component_id,
      sig.signal_type,
      sig.signal_source,
      now() - make_interval(hours => sig.hour_offset::int),
      sig.signal_value,
      NULL,
      sig.signal_unit,
      sig.quality_score,
      jsonb_build_object(
        'seed_source', 'engine_ops_lifecycle_v1',
        'anomaly', sig.signal_value > sig.alert_threshold,
        'warranty_state', CASE WHEN c.component_rank % 8 = 0 THEN 'expired' ELSE 'active' END
      ),
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        c.id AS component_id,
        c.aircraft_id,
        row_number() OVER (ORDER BY c.serial_number) AS component_rank
      FROM public.components c
      WHERE c.tenant_id = t.id
        AND c.component_type = 'engine_module'
    ) c
    CROSS JOIN LATERAL (
      SELECT
        format('vib-%s', gs)::text AS signal_key,
        'engine_vibration_ips'::text AS signal_type,
        'telematics_gateway'::text AS signal_source,
        gs * 6 AS hour_offset,
        (0.9 + ((gs % 9) * 0.22))::numeric(14,4) AS signal_value,
        'IPS'::text AS signal_unit,
        (96 - (gs % 18))::numeric(5,2) AS quality_score,
        2.2::numeric(14,4) AS alert_threshold
      FROM generate_series(1, 20) gs
      UNION ALL
      SELECT
        format('oil-%s', gs)::text,
        'oil_consumption_lph',
        'telematics_gateway',
        gs * 6,
        (2.6 + ((gs % 8) * 0.48))::numeric(14,4),
        'LPH',
        (95 - (gs % 16))::numeric(5,2),
        5.1::numeric(14,4)
      FROM generate_series(1, 20) gs
      UNION ALL
      SELECT
        format('egt-%s', gs)::text,
        'egt_margin_c',
        'fa_decoding',
        gs * 6,
        (72 - ((gs % 9) * 3.5))::numeric(14,4),
        'C',
        (93 - (gs % 14))::numeric(5,2),
        35::numeric(14,4)
      FROM generate_series(1, 20) gs
    ) sig
    ON CONFLICT (id) DO UPDATE
    SET
      signal_type = EXCLUDED.signal_type,
      signal_source = EXCLUDED.signal_source,
      signal_timestamp = EXCLUDED.signal_timestamp,
      value_numeric = EXCLUDED.value_numeric,
      value_text = EXCLUDED.value_text,
      unit = EXCLUDED.unit,
      quality_score = EXCLUDED.quality_score,
      metadata = EXCLUDED.metadata,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.forecast_outputs (
      id,
      tenant_id,
      franchise_id,
      aircraft_id,
      component_id,
      signal_id,
      forecast_type,
      prediction_window_hours,
      risk_score,
      confidence_score,
      recommendation,
      rationale,
      model_version,
      generated_at,
      accepted,
      accepted_by,
      accepted_at,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:forecast:%s', t.id::text, c.id::text)),
      t.id,
      selected_franchise_id,
      c.aircraft_id,
      c.id,
      s.id,
      'engine_health_risk',
      240,
      LEAST(98, 38 + (c.component_rank % 9) * 6),
      LEAST(99, 74 + (c.component_rank % 5) * 5),
      CASE WHEN c.component_rank % 4 = 0 THEN 'Schedule borescope and oil analysis within 7 days' ELSE 'Continue monitoring and maintain current schedule' END,
      jsonb_build_object(
        'seed_source', 'engine_ops_lifecycle_v1',
        'driving_signals', jsonb_build_array('engine_vibration_ips', 'oil_consumption_lph', 'egt_margin_c'),
        'warranty_flag', CASE WHEN c.component_rank % 8 = 0 THEN 'expired_warranty' ELSE 'standard' END
      ),
      'eng-risk-v2.4',
      now() - make_interval(hours => (c.component_rank % 36)::int),
      c.component_rank % 3 = 0,
      CASE WHEN c.component_rank % 3 = 0 THEN actor_user_id ELSE NULL END,
      CASE WHEN c.component_rank % 3 = 0 THEN now() - make_interval(hours => (c.component_rank % 24)::int) ELSE NULL END,
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        c.id,
        c.aircraft_id,
        row_number() OVER (ORDER BY c.serial_number) AS component_rank
      FROM public.components c
      WHERE c.tenant_id = t.id
        AND c.component_type = 'engine_module'
    ) c
    LEFT JOIN LATERAL (
      SELECT s.id
      FROM public.asset_health_signals s
      WHERE s.tenant_id = t.id
        AND s.component_id = c.id
      ORDER BY s.signal_timestamp DESC
      LIMIT 1
    ) s ON true
    ON CONFLICT (id) DO UPDATE
    SET
      forecast_type = EXCLUDED.forecast_type,
      prediction_window_hours = EXCLUDED.prediction_window_hours,
      risk_score = EXCLUDED.risk_score,
      confidence_score = EXCLUDED.confidence_score,
      recommendation = EXCLUDED.recommendation,
      rationale = EXCLUDED.rationale,
      model_version = EXCLUDED.model_version,
      generated_at = EXCLUDED.generated_at,
      accepted = EXCLUDED.accepted,
      accepted_by = EXCLUDED.accepted_by,
      accepted_at = EXCLUDED.accepted_at,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.staff_qualifications (
      id,
      tenant_id,
      franchise_id,
      staff_id,
      technician_id,
      qualification_code,
      qualification_name,
      issuing_authority,
      issuer_authority,
      regulator_profile_id,
      issue_date,
      expiration_date,
      valid_from,
      valid_to,
      renewal_date,
      is_active,
      license_number,
      certificate_number,
      scope,
      rating,
      aircraft_types,
      component_categories,
      limitations,
      can_certify_release,
      can_defer,
      policy_reference,
      verified_by,
      verified_at,
      created_by,
      updated_by
    )
    VALUES
      (
        extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s-qual-release-active', t.id::text)),
        t.id,
        selected_franchise_id,
        actor_user_id,
        actor_user_id,
        format('ENG-CERT-%s-ACTIVE', tenant_key),
        'Engine Release Certifying Staff',
        'FAA',
        'FAA',
        faa_profile_id,
        current_date - 420,
        current_date + 540,
        current_date - 420,
        current_date + 540,
        current_date + 365,
        true,
        format('LIC-%s-ENG-ACT', tenant_key),
        format('CERT-%s-ENG-ACT', tenant_key),
        'Engine release and return to service',
        'A&P',
        ARRAY['A321neo', 'B787-9'],
        ARRAY['engine'],
        NULL,
        true,
        true,
        format('eng-release-%s-v1', tenant_key),
        actor_user_id,
        now() - interval '30 days',
        actor_user_id,
        actor_user_id
      ),
      (
        extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s-qual-release-expired', t.id::text)),
        t.id,
        selected_franchise_id,
        actor_user_id,
        actor_user_id,
        format('ENG-CERT-%s-EXP', tenant_key),
        'Engine Legacy Approval Authority',
        'EASA',
        'EASA',
        easa_profile_id,
        current_date - 1200,
        current_date - 30,
        current_date - 1200,
        current_date - 30,
        current_date - 365,
        false,
        format('LIC-%s-ENG-EXP', tenant_key),
        format('CERT-%s-ENG-EXP', tenant_key),
        'Historical release authority',
        'Powerplant',
        ARRAY['A321neo'],
        ARRAY['engine'],
        'Expired authorization for active release',
        false,
        false,
        format('eng-release-%s-v1', tenant_key),
        actor_user_id,
        now() - interval '300 days',
        actor_user_id,
        actor_user_id
      )
    ON CONFLICT (id) DO UPDATE
    SET
      qualification_code = EXCLUDED.qualification_code,
      qualification_name = EXCLUDED.qualification_name,
      issuing_authority = EXCLUDED.issuing_authority,
      issuer_authority = EXCLUDED.issuer_authority,
      regulator_profile_id = EXCLUDED.regulator_profile_id,
      issue_date = EXCLUDED.issue_date,
      expiration_date = EXCLUDED.expiration_date,
      valid_from = EXCLUDED.valid_from,
      valid_to = EXCLUDED.valid_to,
      renewal_date = EXCLUDED.renewal_date,
      is_active = EXCLUDED.is_active,
      license_number = EXCLUDED.license_number,
      certificate_number = EXCLUDED.certificate_number,
      scope = EXCLUDED.scope,
      rating = EXCLUDED.rating,
      aircraft_types = EXCLUDED.aircraft_types,
      component_categories = EXCLUDED.component_categories,
      limitations = EXCLUDED.limitations,
      can_certify_release = EXCLUDED.can_certify_release,
      can_defer = EXCLUDED.can_defer,
      policy_reference = EXCLUDED.policy_reference,
      verified_by = EXCLUDED.verified_by,
      verified_at = EXCLUDED.verified_at,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.certification_actions (
      id,
      tenant_id,
      franchise_id,
      staff_qualification_id,
      work_package_id,
      task_id,
      action_type,
      action_status,
      action_notes,
      authority_scope,
      decided_by,
      decided_at,
      release_attempted_at,
      rejection_reason,
      policy_reference,
      signer_id,
      signature_method,
      policy_snapshot_id,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:cert:%s', t.id::text, wp.id::text)),
      t.id,
      selected_franchise_id,
      CASE
        WHEN wp.status IN ('completed', 'closed')
          THEN extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s-qual-release-active', t.id::text))
        ELSE extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s-qual-release-expired', t.id::text))
      END,
      wp.id,
      (
        SELECT tk.id
        FROM public.tasks tk
        WHERE tk.work_package_id = wp.id
          AND tk.sequence = 4
        LIMIT 1
      ),
      CASE WHEN wp.status IN ('completed', 'closed') THEN 'approve' ELSE 'defer' END,
      CASE WHEN wp.status IN ('completed', 'closed') THEN 'executed' ELSE 'pending' END,
      CASE WHEN wp.status IN ('completed', 'closed') THEN 'Release to service approved by certifying staff' ELSE 'Awaiting material and compliance closure' END,
      'engine_release',
      actor_user_id,
      now() - interval '2 days',
      now() - interval '2 days',
      CASE WHEN wp.status IN ('completed', 'closed') THEN NULL ELSE 'Deferred due to pending overdue corrective package' END,
      format('eng-release-%s-v1', tenant_key),
      actor_user_id,
      'digital'::public.signature_method,
      policy_snapshot_id,
      actor_user_id,
      actor_user_id
    FROM public.work_packages wp
    WHERE wp.tenant_id = t.id
      AND wp.work_package_number LIKE format('WP-%s-%%', tenant_key)
      AND right(wp.work_package_number, 8) IN ('WARRANTY', 'LANALYSIS')
    ON CONFLICT (id) DO UPDATE
    SET
      staff_qualification_id = EXCLUDED.staff_qualification_id,
      task_id = EXCLUDED.task_id,
      action_type = EXCLUDED.action_type,
      action_status = EXCLUDED.action_status,
      action_notes = EXCLUDED.action_notes,
      authority_scope = EXCLUDED.authority_scope,
      decided_by = EXCLUDED.decided_by,
      decided_at = EXCLUDED.decided_at,
      release_attempted_at = EXCLUDED.release_attempted_at,
      rejection_reason = EXCLUDED.rejection_reason,
      policy_reference = EXCLUDED.policy_reference,
      signer_id = EXCLUDED.signer_id,
      signature_method = EXCLUDED.signature_method,
      policy_snapshot_id = EXCLUDED.policy_snapshot_id,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.compliance_obligations (
      id,
      tenant_id,
      franchise_id,
      regulator_profile_id,
      regulator_code,
      aircraft_id,
      work_package_id,
      obligation_code,
      obligation_type,
      title,
      description,
      due_date,
      due_hours,
      due_cycles,
      priority,
      status,
      source_reference,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:obligation:%s:%s', t.id::text, wp.id::text, ob.obligation_code)),
      t.id,
      selected_franchise_id,
      CASE WHEN ob.reg_code = 'FAA' THEN faa_profile_id ELSE easa_profile_id END,
      ob.reg_code,
      wp.aircraft_id,
      wp.id,
      format('OBL-%s-%s-%s', tenant_key, wp.work_package_number, ob.obligation_code),
      ob.obligation_type,
      ob.title,
      ob.description,
      current_date + ob.due_offset_days,
      CASE WHEN ob.obligation_code = 'HOURS' THEN 200 ELSE NULL END,
      CASE WHEN ob.obligation_code = 'CYCLES' THEN 120 ELSE NULL END,
      ob.priority,
      ob.obligation_status,
      format('AD-%s-%s', ob.reg_code, wp.work_package_number),
      actor_user_id,
      actor_user_id
    FROM public.work_packages wp
    CROSS JOIN LATERAL (
      VALUES
        ('DATE', 'FAA', 'ad_sb', 'AD/SB date-based closure', 'Date-based AD closure validation for engine configuration', -3, 'critical', 'overdue'),
        ('HOURS', 'EASA', 'llp', 'LLP hour/cycle threshold governance', 'Life-limited parts threshold and projection review', 5, 'high', 'in_progress'),
        ('CYCLES', 'FAA', 'warranty', 'Warranty and maintenance policy alignment', 'Verify warranty limitations for corrective intervention', 12, 'medium', 'open')
    ) AS ob(
      obligation_code,
      reg_code,
      obligation_type,
      title,
      description,
      due_offset_days,
      priority,
      obligation_status
    )
    WHERE wp.tenant_id = t.id
      AND wp.work_package_number LIKE format('WP-%s-%%', tenant_key)
    ON CONFLICT (tenant_id, obligation_code) DO UPDATE
    SET
      regulator_profile_id = EXCLUDED.regulator_profile_id,
      regulator_code = EXCLUDED.regulator_code,
      aircraft_id = EXCLUDED.aircraft_id,
      work_package_id = EXCLUDED.work_package_id,
      obligation_type = EXCLUDED.obligation_type,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      due_date = EXCLUDED.due_date,
      due_hours = EXCLUDED.due_hours,
      due_cycles = EXCLUDED.due_cycles,
      priority = EXCLUDED.priority,
      status = EXCLUDED.status,
      source_reference = EXCLUDED.source_reference,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.maintenance_events (
      id,
      tenant_id,
      franchise_id,
      aircraft_id,
      component_id,
      work_package_id,
      task_id,
      event_type,
      event_code,
      title,
      description,
      performed_by,
      approved_by,
      data,
      metadata,
      signature,
      signature_timestamp,
      signature_method,
      evidence_hash,
      regulatory_requirement,
      compliance_authority,
      event_timestamp,
      event_hash,
      previous_hash,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:event:%s:%s', t.id::text, c.id::text, st.stage_no::text)),
      t.id,
      selected_franchise_id,
      c.aircraft_id,
      c.id,
      wp.id,
      (
        SELECT tk.id
        FROM public.tasks tk
        WHERE tk.work_package_id = wp.id
        ORDER BY tk.sequence NULLS LAST, tk.created_at
        LIMIT 1
      ),
      st.event_type,
      st.event_code,
      st.title,
      st.description,
      actor_user_id,
      CASE WHEN st.stage_no >= 5 THEN actor_user_id ELSE NULL END,
      jsonb_build_object(
        'seed_source', 'engine_ops_lifecycle_v1',
        'lifecycle_stage', st.lifecycle_stage,
        'warranty_status', CASE WHEN c.component_rank % 8 = 0 THEN 'expired' ELSE 'active' END,
        'remaining_cycles_estimate', GREATEST(0, c.llp_cycles - c.cycles_since_new)
      ),
      jsonb_build_object(
        'workflow', 'engine_lifecycle_management',
        'stage_no', st.stage_no
      ),
      CASE WHEN st.stage_no >= 5 THEN format('SIG-%s-%s', right(c.serial_number, 6), st.stage_no) ELSE NULL END,
      CASE WHEN st.stage_no >= 5 THEN now() - make_interval(days => (45 - st.stage_no * 6)::int) ELSE NULL END,
      CASE WHEN st.stage_no >= 5 THEN 'digital'::public.signature_method ELSE NULL END,
      md5(format('%s:%s:%s', c.id::text, st.stage_no, 'evidence')),
      CASE WHEN st.stage_no >= 5 THEN 'ATA 72 compliance signoff' ELSE NULL END,
      CASE WHEN st.stage_no >= 5 THEN 'FAA' ELSE NULL END,
      now() - make_interval(days => (55 - st.stage_no * 6)::int),
      md5(format('%s:%s:%s', t.id::text, c.id::text, st.stage_no)),
      CASE WHEN st.stage_no = 1 THEN NULL ELSE md5(format('%s:%s:%s', t.id::text, c.id::text, st.stage_no - 1)) END,
      actor_user_id,
      actor_user_id
    FROM (
      SELECT
        c.id,
        c.serial_number,
        c.aircraft_id,
        c.llp_cycles,
        c.cycles_since_new,
        row_number() OVER (ORDER BY c.serial_number) AS component_rank
      FROM public.components c
      WHERE c.tenant_id = t.id
        AND c.component_type = 'engine_module'
    ) c
    CROSS JOIN LATERAL (
      VALUES
        (1, 'engine_created', 'ENG-LIFE-CREATED', 'Engine asset registered', 'Engine module entered controlled lifecycle state', 'created'),
        (2, 'engine_installed', 'ENG-LIFE-INSTALLED', 'Engine installed on aircraft', 'Initial installation and baseline metrics captured', 'installed'),
        (3, 'engine_in_service', 'ENG-LIFE-INSVC', 'Engine in operational service', 'Routine operation and trend capture active', 'in_service'),
        (4, 'engine_degradation', 'ENG-LIFE-DEGRADE', 'Performance degradation identified', 'Trend breach requires maintenance planning', 'monitoring'),
        (5, 'engine_overhaul_started', 'ENG-LIFE-OH-START', 'Engine overhaul initiated', 'Engine inducted to overhaul workflow', 'overhaul_started'),
        (6, 'engine_overhaul_completed', 'ENG-LIFE-OH-DONE', 'Engine overhaul completed', 'Engine returned from overhaul and released', 'overhaul_completed')
    ) AS st(stage_no, event_type, event_code, title, description, lifecycle_stage)
    LEFT JOIN LATERAL (
      SELECT wp.id
      FROM public.work_packages wp
      WHERE wp.tenant_id = t.id
        AND wp.aircraft_id = c.aircraft_id
      ORDER BY wp.created_at DESC
      LIMIT 1
    ) wp ON true
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.maintenance_events me
      WHERE me.tenant_id = t.id
        AND me.event_hash = md5(format('%s:%s:%s', t.id::text, c.id::text, st.stage_no))
    );

    INSERT INTO public.compliance_records (
      id,
      tenant_id,
      franchise_id,
      obligation_id,
      maintenance_event_id,
      task_id,
      work_package_id,
      decision_status,
      decision_reason,
      evidence_reference,
      evidence_hash,
      reviewed_by,
      reviewed_at,
      approving_authority,
      approving_authority_profile_id,
      policy_snapshot_id,
      created_by,
      updated_by
    )
    SELECT
      extensions.uuid_generate_v5('f2de1ee9-ea2d-4c8e-8cbc-813df89fce77'::uuid, format('%s:compliance:%s', t.id::text, co.id::text)),
      t.id,
      selected_franchise_id,
      co.id,
      (
        SELECT me.id
        FROM public.maintenance_events me
        WHERE me.tenant_id = t.id
          AND me.work_package_id = co.work_package_id
          AND me.event_type = 'engine_overhaul_completed'
        ORDER BY me.event_timestamp DESC
        LIMIT 1
      ),
      (
        SELECT tk.id
        FROM public.tasks tk
        WHERE tk.work_package_id = co.work_package_id
          AND tk.sequence = 4
        LIMIT 1
      ),
      co.work_package_id,
      CASE WHEN co.status IN ('completed') THEN 'approved' ELSE 'pending' END,
      CASE WHEN co.status IN ('completed') THEN 'All release criteria satisfied' ELSE 'Awaiting final release checks' END,
      format('EVID-%s', right(co.obligation_code, 6)),
      md5(format('%s:%s', co.id::text, 'evidence')),
      actor_user_id,
      now() - interval '1 day',
      CASE WHEN co.status IN ('completed') THEN actor_user_id ELSE NULL END,
      CASE WHEN co.status IN ('completed') THEN co.regulator_profile_id ELSE NULL END,
      CASE WHEN co.status IN ('completed') THEN policy_snapshot_id ELSE NULL END,
      actor_user_id,
      actor_user_id
    FROM public.compliance_obligations co
    WHERE co.tenant_id = t.id
      AND co.obligation_code LIKE format('OBL-%s-%%', tenant_key)
    ON CONFLICT (id) DO UPDATE
    SET
      maintenance_event_id = EXCLUDED.maintenance_event_id,
      task_id = EXCLUDED.task_id,
      work_package_id = EXCLUDED.work_package_id,
      decision_status = EXCLUDED.decision_status,
      decision_reason = EXCLUDED.decision_reason,
      evidence_reference = EXCLUDED.evidence_reference,
      evidence_hash = EXCLUDED.evidence_hash,
      reviewed_by = EXCLUDED.reviewed_by,
      reviewed_at = EXCLUDED.reviewed_at,
      approving_authority = EXCLUDED.approving_authority,
      approving_authority_profile_id = EXCLUDED.approving_authority_profile_id,
      policy_snapshot_id = EXCLUDED.policy_snapshot_id,
      updated_by = EXCLUDED.updated_by,
      updated_at = now(),
      deleted_at = NULL;

    SELECT count(*)
    INTO seeded_aircraft_count
    FROM public.aircraft
    WHERE tenant_id = t.id
      AND serial_number LIKE format('EOPS-%s-%%', tenant_key);

    SELECT count(*)
    INTO seeded_work_package_count
    FROM public.work_packages
    WHERE tenant_id = t.id
      AND work_package_number LIKE format('WP-%s-%%', tenant_key);

    SELECT count(*)
    INTO seeded_flight_log_count
    FROM public.flight_logs
    WHERE tenant_id = t.id
      AND flight_number LIKE 'EO%';

    SELECT count(*)
    INTO seeded_event_count
    FROM public.maintenance_events
    WHERE tenant_id = t.id
      AND metadata ->> 'workflow' = 'engine_lifecycle_management';

    SELECT count(*)
    INTO seeded_signal_count
    FROM public.asset_health_signals
    WHERE tenant_id = t.id
      AND metadata ->> 'seed_source' = 'engine_ops_lifecycle_v1';

    IF seeded_aircraft_count < 12 THEN
      RAISE EXCEPTION 'Engine seed validation failed for tenant %: expected at least 12 aircraft, got %', t.id, seeded_aircraft_count;
    END IF;

    IF seeded_work_package_count < 50 THEN
      RAISE EXCEPTION 'Engine seed validation failed for tenant %: expected at least 50 work packages, got %', t.id, seeded_work_package_count;
    END IF;

    IF seeded_flight_log_count < 240 THEN
      RAISE EXCEPTION 'Engine seed validation failed for tenant %: expected at least 240 flight logs, got %', t.id, seeded_flight_log_count;
    END IF;

    IF seeded_event_count < 120 THEN
      RAISE EXCEPTION 'Engine seed validation failed for tenant %: expected at least 120 lifecycle events, got %', t.id, seeded_event_count;
    END IF;

    IF seeded_signal_count < 600 THEN
      RAISE EXCEPTION 'Engine seed validation failed for tenant %: expected at least 600 health signals, got %', t.id, seeded_signal_count;
    END IF;
  END LOOP;
END
$$;

COMMIT;
