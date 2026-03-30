BEGIN;

DO $$
DECLARE
  t RECORD;
  tenant_key text;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    tenant_key := upper(substring(replace(t.id::text, '-', '') from 1 for 6));

    INSERT INTO public.suppliers (
      tenant_id,
      franchise_id,
      supplier_code,
      name,
      contact_name,
      email,
      phone,
      lead_time_days,
      rating,
      is_active,
      metadata
    )
    SELECT
      t.id,
      NULL,
      format('SUP-%s-%s', tenant_key, lpad(gs::text, 3, '0')),
      format('AMRO Supplier %s-%s', tenant_key, lpad(gs::text, 3, '0')),
      format('Contact %s', lpad(gs::text, 3, '0')),
      format('supplier.%s.%s@amro.example', lower(tenant_key), lpad(gs::text, 3, '0')),
      format('+1-555-%s-%s', lpad((100 + gs)::text, 3, '0'), lpad((200 + gs)::text, 4, '0')),
      2 + (gs % 21),
      round((3.00 + ((gs % 21)::numeric / 10.0))::numeric, 2),
      true,
      jsonb_build_object('tier', CASE WHEN gs % 5 = 0 THEN 'strategic' WHEN gs % 2 = 0 THEN 'preferred' ELSE 'standard' END, 'scope', 'amro')
    FROM generate_series(1, 24) AS gs
    ON CONFLICT (tenant_id, supplier_code) DO UPDATE
    SET
      name = EXCLUDED.name,
      contact_name = EXCLUDED.contact_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      lead_time_days = EXCLUDED.lead_time_days,
      rating = EXCLUDED.rating,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata,
      updated_at = now();

    INSERT INTO public.aircraft (
      tenant_id,
      franchise_id,
      registration,
      tail_number,
      serial_number,
      aircraft_type,
      aircraft_model,
      configuration_code,
      maintenance_program,
      manufacturer,
      model,
      msn,
      line_number,
      status,
      operator_code,
      station_code,
      base_location,
      engine_type,
      current_flight_hours,
      current_cycles,
      current_flight_hours_since_new,
      current_cycles_since_new,
      engine_install_history,
      thrust_rating_change_log,
      on_wing_lifecycle_records
    )
    SELECT
      t.id,
      NULL,
      format('N%s%s', substring(tenant_key from 1 for 3), lpad(gs::text, 3, '0')),
      format('TN-%s-%s', tenant_key, lpad(gs::text, 3, '0')),
      format('SN-%s-%s', tenant_key, lpad(gs::text, 4, '0')),
      CASE
        WHEN gs % 4 = 0 THEN 'NarrowBody'
        WHEN gs % 4 = 1 THEN 'WideBody'
        WHEN gs % 4 = 2 THEN 'RegionalJet'
        ELSE 'Turboprop'
      END,
      CASE
        WHEN gs % 4 = 0 THEN 'A320neo'
        WHEN gs % 4 = 1 THEN 'B787-9'
        WHEN gs % 4 = 2 THEN 'E190-E2'
        ELSE 'ATR72-600'
      END,
      format('CFG-%s', lpad((1 + (gs % 6))::text, 2, '0')),
      CASE WHEN gs % 2 = 0 THEN 'A-CHECK' ELSE 'B-CHECK' END,
      CASE
        WHEN gs % 4 = 0 THEN 'Airbus'
        WHEN gs % 4 = 1 THEN 'Boeing'
        WHEN gs % 4 = 2 THEN 'Embraer'
        ELSE 'ATR'
      END,
      CASE
        WHEN gs % 4 = 0 THEN 'A320neo'
        WHEN gs % 4 = 1 THEN '787-9'
        WHEN gs % 4 = 2 THEN 'E190-E2'
        ELSE '72-600'
      END,
      format('MSN-%s-%s', tenant_key, lpad(gs::text, 4, '0')),
      format('LN-%s', lpad(gs::text, 4, '0')),
      'active',
      format('OP-%s', substring(tenant_key from 1 for 3)),
      CASE WHEN gs % 5 = 0 THEN 'DXB' WHEN gs % 5 = 1 THEN 'MIA' WHEN gs % 5 = 2 THEN 'SIN' WHEN gs % 5 = 3 THEN 'LHR' ELSE 'DEL' END,
      CASE WHEN gs % 5 = 0 THEN 'DXB' WHEN gs % 5 = 1 THEN 'MIA' WHEN gs % 5 = 2 THEN 'SIN' WHEN gs % 5 = 3 THEN 'LHR' ELSE 'DEL' END,
      CASE WHEN gs % 2 = 0 THEN 'CFM LEAP-1A' ELSE 'GE GEnx-1B' END,
      (12000 + (gs * 275))::numeric(15,2),
      6000 + (gs * 120),
      (15000 + (gs * 300))::numeric(15,2),
      7500 + (gs * 150),
      jsonb_build_array(
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-A', tenant_key, lpad(gs::text, 3, '0')),
          'engine_position', 'A',
          'installed_at', (current_date - make_interval(days => (220 + gs * 3)::int))::text,
          'removed_at', NULL
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-A', tenant_key, lpad(gs::text, 3, '0')),
          'rated_thrust', CASE WHEN gs % 2 = 0 THEN 27000 + (gs * 12) ELSE 69000 + (gs * 20) END,
          'derate_mode', CASE WHEN gs % 3 = 0 THEN 'CLB2' ELSE 'CLB1' END,
          'authority_basis', CASE WHEN gs % 2 = 0 THEN 'OEM-BASELINE' ELSE 'ENGINEERING-REVIEW' END,
          'effective_from', (current_date - make_interval(days => (130 + gs * 2)::int))::text
        )
      ),
      jsonb_build_array(
        jsonb_build_object(
          'engine_serial_number', format('ENG-%s-%s-A', tenant_key, lpad(gs::text, 3, '0')),
          'event_type', 'install',
          'event_at', (current_date - make_interval(days => (220 + gs * 3)::int))::text,
          'event_status', 'completed',
          'flight_hours_at_event', (10000 + (gs * 250))::numeric(15,2),
          'cycles_at_event', 5000 + (gs * 110)
        )
      )
    FROM generate_series(1, 16) AS gs
    ON CONFLICT (serial_number) DO UPDATE
    SET
      tenant_id = EXCLUDED.tenant_id,
      registration = EXCLUDED.registration,
      tail_number = EXCLUDED.tail_number,
      aircraft_type = EXCLUDED.aircraft_type,
      aircraft_model = EXCLUDED.aircraft_model,
      configuration_code = EXCLUDED.configuration_code,
      maintenance_program = EXCLUDED.maintenance_program,
      manufacturer = EXCLUDED.manufacturer,
      model = EXCLUDED.model,
      msn = EXCLUDED.msn,
      line_number = EXCLUDED.line_number,
      status = EXCLUDED.status,
      operator_code = EXCLUDED.operator_code,
      station_code = EXCLUDED.station_code,
      base_location = EXCLUDED.base_location,
      engine_type = EXCLUDED.engine_type,
      current_flight_hours = EXCLUDED.current_flight_hours,
      current_cycles = EXCLUDED.current_cycles,
      current_flight_hours_since_new = EXCLUDED.current_flight_hours_since_new,
      current_cycles_since_new = EXCLUDED.current_cycles_since_new,
      engine_install_history = EXCLUDED.engine_install_history,
      thrust_rating_change_log = EXCLUDED.thrust_rating_change_log,
      on_wing_lifecycle_records = EXCLUDED.on_wing_lifecycle_records,
      updated_at = now(),
      deleted_at = NULL;

    INSERT INTO public.maintenance_facilities (
      tenant_id,
      franchise_id,
      facility_code,
      name,
      facility_type,
      station_code,
      location_city,
      location_country,
      timezone,
      contact_name,
      contact_email,
      contact_phone,
      is_active,
      metadata
    )
    SELECT
      t.id,
      NULL,
      f.facility_code,
      f.name,
      f.facility_type,
      f.station_code,
      f.location_city,
      f.location_country,
      f.timezone,
      f.contact_name,
      f.contact_email,
      f.contact_phone,
      true,
      jsonb_build_object('capacity_band', f.capacity_band, 'scope', 'amro')
    FROM (
      VALUES
        ('FAC-LINE-DXB', 'Dubai Line Maintenance', 'line', 'DXB', 'Dubai', 'UAE', 'Asia/Dubai', 'Rashid Khan', 'line.dxb@amro.example', '+971-4-555-1001', 'high'),
        ('FAC-BASE-MIA', 'Miami Base Maintenance', 'base', 'MIA', 'Miami', 'USA', 'America/New_York', 'Elena Cruz', 'base.mia@amro.example', '+1-305-555-2001', 'high'),
        ('FAC-COMP-SIN', 'Singapore Component Shop', 'component_shop', 'SIN', 'Singapore', 'Singapore', 'Asia/Singapore', 'Jun Wei', 'comp.sin@amro.example', '+65-555-3001', 'medium'),
        ('FAC-ENG-LHR', 'London Engine Shop', 'engine_shop', 'LHR', 'London', 'UK', 'Europe/London', 'Michael Hart', 'eng.lhr@amro.example', '+44-20-555-4001', 'high'),
        ('FAC-STR-DEL', 'Delhi Structures Center', 'structures', 'DEL', 'Delhi', 'India', 'Asia/Kolkata', 'Kunal Sharma', 'str.del@amro.example', '+91-11-555-5001', 'medium'),
        ('FAC-AVN-DOH', 'Doha Avionics Lab', 'avionics', 'DOH', 'Doha', 'Qatar', 'Asia/Qatar', 'Sara Al-Mansoori', 'avn.doh@amro.example', '+974-4-555-6001', 'medium'),
        ('FAC-LINE-FRA', 'Frankfurt Line Maintenance', 'line', 'FRA', 'Frankfurt', 'Germany', 'Europe/Berlin', 'Lukas Meyer', 'line.fra@amro.example', '+49-69-555-7001', 'high'),
        ('FAC-BASE-HKG', 'Hong Kong Base Maintenance', 'base', 'HKG', 'Hong Kong', 'China', 'Asia/Hong_Kong', 'Mei Lin', 'base.hkg@amro.example', '+852-555-8001', 'high'),
        ('FAC-COMP-SYD', 'Sydney Component Shop', 'component_shop', 'SYD', 'Sydney', 'Australia', 'Australia/Sydney', 'Oliver Price', 'comp.syd@amro.example', '+61-2-555-9001', 'medium'),
        ('FAC-OTH-JNB', 'Johannesburg MRO Center', 'other', 'JNB', 'Johannesburg', 'South Africa', 'Africa/Johannesburg', 'Nandi Mokoena', 'other.jnb@amro.example', '+27-11-555-0001', 'medium')
    ) AS f(facility_code, name, facility_type, station_code, location_city, location_country, timezone, contact_name, contact_email, contact_phone, capacity_band)
    ON CONFLICT (tenant_id, facility_code) DO UPDATE
    SET
      name = EXCLUDED.name,
      facility_type = EXCLUDED.facility_type,
      station_code = EXCLUDED.station_code,
      location_city = EXCLUDED.location_city,
      location_country = EXCLUDED.location_country,
      timezone = EXCLUDED.timezone,
      contact_name = EXCLUDED.contact_name,
      contact_email = EXCLUDED.contact_email,
      contact_phone = EXCLUDED.contact_phone,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata,
      updated_at = now();

    INSERT INTO public.work_centers (
      tenant_id,
      franchise_id,
      facility_id,
      facility_code,
      work_center_code,
      name,
      center_type,
      station_code,
      capacity_hours_per_day,
      is_active,
      metadata
    )
    SELECT
      t.id,
      NULL,
      mf.id,
      mf.facility_code,
      format('%s-%s', mf.facility_code, wc.center_suffix),
      format('%s %s', mf.name, wc.center_name),
      wc.center_type,
      mf.station_code,
      wc.capacity_hours_per_day,
      true,
      jsonb_build_object('shift_model', wc.shift_model, 'scope', 'amro')
    FROM public.maintenance_facilities mf
    CROSS JOIN (
      VALUES
        ('AFRM', 'Airframe Bay', 'airframe', 16.00::numeric, '2x8'),
        ('ENGN', 'Engine Bay', 'engine', 14.00::numeric, '2x7'),
        ('AVNX', 'Avionics Bench', 'avionics', 12.00::numeric, '2x6')
    ) AS wc(center_suffix, center_name, center_type, capacity_hours_per_day, shift_model)
    WHERE mf.tenant_id = t.id
    ON CONFLICT (tenant_id, work_center_code) DO UPDATE
    SET
      facility_id = EXCLUDED.facility_id,
      facility_code = EXCLUDED.facility_code,
      name = EXCLUDED.name,
      center_type = EXCLUDED.center_type,
      station_code = EXCLUDED.station_code,
      capacity_hours_per_day = EXCLUDED.capacity_hours_per_day,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata,
      updated_at = now();

    INSERT INTO public.skill_codes (
      tenant_id,
      franchise_id,
      skill_code,
      description,
      skill_family,
      license_authority,
      is_certification_required,
      validity_period_months,
      is_active,
      metadata
    )
    SELECT
      t.id,
      NULL,
      format('SKL-%s-%s', fam.family_code, lpad(seq::text, 2, '0')),
      format('%s Skill Level %s', fam.family_name, lpad(seq::text, 2, '0')),
      fam.family_name,
      fam.license_authority,
      seq % 2 = 0,
      CASE WHEN seq % 3 = 0 THEN 24 WHEN seq % 3 = 1 THEN 36 ELSE 48 END,
      true,
      jsonb_build_object('level', seq, 'scope', 'amro')
    FROM (
      VALUES
        ('AF', 'Airframe', 'FAA'),
        ('EN', 'Engine', 'EASA'),
        ('AV', 'Avionics', 'FAA'),
        ('ST', 'Structures', 'CAA'),
        ('ND', 'NDT', 'EASA'),
        ('PW', 'Powerplant', 'FAA')
    ) AS fam(family_code, family_name, license_authority)
    CROSS JOIN generate_series(1, 6) AS seq
    ON CONFLICT (tenant_id, skill_code) DO UPDATE
    SET
      description = EXCLUDED.description,
      skill_family = EXCLUDED.skill_family,
      license_authority = EXCLUDED.license_authority,
      is_certification_required = EXCLUDED.is_certification_required,
      validity_period_months = EXCLUDED.validity_period_months,
      is_active = EXCLUDED.is_active,
      metadata = EXCLUDED.metadata,
      updated_at = now();

    WITH part_payload AS (
      SELECT
        t.id AS tenant_id,
        format('PN-%s-%s', tenant_key, lpad(gs::text, 5, '0')) AS part_number,
        CASE WHEN gs % 3 = 0 THEN format('SER-%s-%s', tenant_key, lpad(gs::text, 6, '0')) ELSE NULL END AS serial_number,
        format('AMRO Part %s-%s', tenant_key, lpad(gs::text, 5, '0')) AS description,
        CASE
          WHEN gs % 6 = 0 THEN 'consumable'
          WHEN gs % 6 = 1 THEN 'rotable'
          WHEN gs % 6 = 2 THEN 'repairable'
          WHEN gs % 6 = 3 THEN 'expendable'
          WHEN gs % 6 = 4 THEN 'tooling'
          ELSE 'hazmat'
        END AS category,
        'EA'::text AS unit_of_measure,
        5 + (gs % 15) AS min_stock_level,
        8 + (gs % 20) AS reorder_level,
        20 + (gs % 40) AS reorder_quantity,
        30 + (gs % 180) AS quantity_on_hand,
        2 + (gs % 18) AS quantity_reserved,
        round((15 + (gs * 1.75))::numeric, 2) AS unit_cost,
        'USD'::text AS currency,
        format('WH-%s-A%s-B%s', CASE WHEN gs % 4 = 0 THEN 'DXB' WHEN gs % 4 = 1 THEN 'MIA' WHEN gs % 4 = 2 THEN 'SIN' ELSE 'LHR' END, lpad(((gs % 12) + 1)::text, 2, '0'), lpad(((gs % 30) + 1)::text, 2, '0')) AS warehouse_location,
        CASE
          WHEN (30 + (gs % 180)) - (2 + (gs % 18)) <= 10 THEN 'low_stock'
          WHEN gs % 17 = 0 THEN 'quarantined'
          WHEN gs % 19 = 0 THEN 'unserviceable'
          WHEN gs % 5 = 0 THEN 'reserved'
          ELSE 'available'
        END AS status,
        now() - make_interval(days => (gs % 45)) AS last_movement_at,
        format('SUP-%s-%s', tenant_key, lpad(((gs % 24) + 1)::text, 3, '0')) AS supplier_code
      FROM generate_series(1, 240) AS gs
    ),
    part_payload_with_supplier AS (
      SELECT
        pp.tenant_id,
        pp.part_number,
        pp.serial_number,
        pp.description,
        pp.category,
        pp.unit_of_measure,
        pp.min_stock_level,
        pp.reorder_level,
        pp.reorder_quantity,
        pp.quantity_on_hand,
        pp.quantity_reserved,
        pp.unit_cost,
        pp.currency,
        pp.warehouse_location,
        pp.status,
        pp.last_movement_at,
        s.id AS supplier_id,
        s.name AS supplier_name
      FROM part_payload pp
      LEFT JOIN public.suppliers s
        ON s.tenant_id = pp.tenant_id
       AND s.supplier_code = pp.supplier_code
    ),
    updated_rows AS (
      UPDATE public.parts_inventory pi
      SET
        description = src.description,
        category = src.category,
        unit_of_measure = src.unit_of_measure,
        min_stock_level = src.min_stock_level,
        reorder_level = src.reorder_level,
        reorder_quantity = src.reorder_quantity,
        quantity_on_hand = src.quantity_on_hand,
        quantity_reserved = LEAST(src.quantity_reserved, src.quantity_on_hand),
        unit_cost = src.unit_cost,
        currency = src.currency,
        supplier_id = src.supplier_id,
        supplier_name = src.supplier_name,
        status = src.status,
        last_movement_at = src.last_movement_at,
        updated_at = now(),
        deleted_at = NULL
      FROM part_payload_with_supplier src
      WHERE pi.tenant_id = src.tenant_id
        AND pi.part_number = src.part_number
        AND COALESCE(pi.serial_number, '') = COALESCE(src.serial_number, '')
        AND pi.warehouse_location = src.warehouse_location
      RETURNING pi.tenant_id, pi.part_number, pi.serial_number, pi.warehouse_location
    )
    INSERT INTO public.parts_inventory (
      tenant_id,
      franchise_id,
      part_number,
      serial_number,
      description,
      supplier_id,
      supplier_name,
      warehouse_location,
      quantity_on_hand,
      quantity_reserved,
      reorder_level,
      reorder_quantity,
      unit_cost,
      currency,
      status,
      last_movement_at,
      category,
      unit_of_measure,
      min_stock_level
    )
    SELECT
      src.tenant_id,
      NULL,
      src.part_number,
      src.serial_number,
      src.description,
      src.supplier_id,
      src.supplier_name,
      src.warehouse_location,
      src.quantity_on_hand,
      LEAST(src.quantity_reserved, src.quantity_on_hand),
      src.reorder_level,
      src.reorder_quantity,
      src.unit_cost,
      src.currency,
      src.status,
      src.last_movement_at,
      src.category,
      src.unit_of_measure,
      src.min_stock_level
    FROM part_payload_with_supplier src
    WHERE NOT EXISTS (
      SELECT 1
      FROM updated_rows u
      WHERE u.tenant_id = src.tenant_id
        AND u.part_number = src.part_number
        AND COALESCE(u.serial_number, '') = COALESCE(src.serial_number, '')
        AND u.warehouse_location = src.warehouse_location
    );
  END LOOP;
END;
$$;

COMMIT;
