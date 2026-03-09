DO $$
DECLARE
  v_seed_ref text := 'QUO-260309-00001';
  v_tenant_id uuid;
  v_customer_id uuid;
  v_quote_id uuid;
  v_quote_version_id uuid;
  v_franchise_id uuid;
  v_template_id uuid;
  v_option1 uuid;
  v_option2 uuid;
  v_option3 uuid;
  v_option4 uuid;
  v_qvo1 uuid;
  v_qvo2 uuid;
  v_qvo3 uuid;
  v_qvo4 uuid;
  v_start_ts timestamptz := clock_timestamp();
  v_end_ts timestamptz;
  v_leg_count integer;
  v_option_count integer;
  v_qvo_count integer;
  v_rate_row_count integer;
  v_quote_charge_count integer;
  v_has_dynamic_trigger_conditions boolean := false;
  v_has_qvo_sort_order boolean := false;
  v_dynamic_surcharge_seed_count integer := 0;
  v_origin_port_id uuid;
  v_destination_port_id uuid;
  v_currency_usd_id uuid;
  v_side_buy_id uuid;
  v_side_sell_id uuid;
  v_cat_freight_id uuid;
  v_cat_fuel_id uuid;
  v_cat_security_id uuid;
  v_cat_handling_id uuid;
  v_cat_customs_id uuid;
  v_basis_kg_id uuid;
  v_basis_shipment_id uuid;
  v_basis_container_id uuid;
BEGIN
  SELECT id
  INTO v_tenant_id
  FROM public.tenants
  WHERE slug IN ('miami-global', 'mgl')
     OR LOWER(name) = LOWER('Miami Global Lines')
  ORDER BY CASE WHEN slug = 'miami-global' THEN 0 WHEN slug = 'mgl' THEN 1 ELSE 2 END, created_at ASC
  LIMIT 1;
  IF v_tenant_id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tenants'
        AND column_name = 'domain_id'
    ) THEN
      INSERT INTO public.tenants (name, slug, subscription_tier, domain_id)
      VALUES ('Miami Global Lines', 'miami-global', 'enterprise', 'miami-global.example.com')
      RETURNING id INTO v_tenant_id;
    ELSE
      INSERT INTO public.tenants (name, slug, subscription_tier)
      VALUES ('Miami Global Lines', 'miami-global', 'enterprise')
      RETURNING id INTO v_tenant_id;
    END IF;
  END IF;

  SELECT id INTO v_customer_id FROM public.accounts WHERE tenant_id = v_tenant_id ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_quote_id
  FROM public.quotes
  WHERE tenant_id = v_tenant_id AND quote_number = v_seed_ref
  ORDER BY
    CASE WHEN current_version_id IS NOT NULL THEN 0 ELSE 1 END,
    updated_at DESC NULLS LAST,
    created_at DESC NULLS LAST
  LIMIT 1;

  IF v_quote_id IS NULL THEN
    INSERT INTO public.quotes (tenant_id, customer_id, quote_number, status, currency, total)
    VALUES (v_tenant_id, v_customer_id, v_seed_ref, 'draft', 'USD', 0)
    RETURNING id INTO v_quote_id;
  END IF;

  UPDATE public.quotes
  SET quote_number = v_seed_ref || '-DUP-' || LEFT(id::text, 8),
      updated_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND quote_number = v_seed_ref
    AND id <> v_quote_id;

  SELECT franchise_id INTO v_franchise_id
  FROM public.quotes
  WHERE id = v_quote_id
  LIMIT 1;

  SELECT id INTO v_quote_version_id
  FROM public.quotation_versions
  WHERE tenant_id = v_tenant_id AND quote_id = v_quote_id AND version_number = 1
  LIMIT 1;

  IF v_quote_version_id IS NULL THEN
    INSERT INTO public.quotation_versions (
      tenant_id, quote_id, version_number, major_version, minor_version, change_reason
    )
    VALUES (
      v_tenant_id, v_quote_id, 1, 1, 0, 'Seeded standalone NYC→DED matrix for QUO-260309-00001'
    )
    RETURNING id INTO v_quote_version_id;
  END IF;

  SELECT id
  INTO v_origin_port_id
  FROM public.ports_locations
  WHERE UPPER(COALESCE(location_code, '')) = 'JFK'
     OR UPPER(COALESCE(iata_code, '')) = 'JFK'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_origin_port_id IS NULL THEN
    INSERT INTO public.ports_locations (
      location_name, location_code, location_type, country, city, country_code, iata_code, is_active
    ) VALUES (
      'John F. Kennedy International Airport', 'JFK', 'airport', 'United States', 'New York', 'US', 'JFK', true
    )
    RETURNING id INTO v_origin_port_id;
  END IF;

  SELECT id
  INTO v_destination_port_id
  FROM public.ports_locations
  WHERE UPPER(COALESCE(location_code, '')) = 'DED'
     OR UPPER(COALESCE(iata_code, '')) = 'DED'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_destination_port_id IS NULL THEN
    INSERT INTO public.ports_locations (
      location_name, location_code, location_type, country, city, country_code, iata_code, is_active
    ) VALUES (
      'Jolly Grant Airport', 'DED', 'airport', 'India', 'Dehradun', 'IN', 'DED', true
    )
    RETURNING id INTO v_destination_port_id;
  END IF;

  UPDATE public.quotes
  SET
    title = 'Standalone NYC to DED Seed ' || v_seed_ref,
    status = 'draft',
    billing_address = jsonb_build_object(
      'company', 'Himalaya Export House Pvt Ltd',
      'name', 'Ananya Sharma',
      'email', 'ananya.sharma@himalaya-export-house.com',
      'phone', '+919910001234',
      'job_title', 'Procurement Director',
      'department', 'Imports',
      'billing_address', jsonb_build_object(
        'street', '78 Rajpur Road',
        'city', 'Dehradun',
        'state', 'Uttarakhand',
        'postalCode', '248001',
        'country', 'India'
      ),
      'shipping_address', jsonb_build_object(
        'street', 'DED Cargo Terminal, Jolly Grant Airport Road',
        'city', 'Dehradun',
        'state', 'Uttarakhand',
        'postalCode', '248140',
        'country', 'India'
      ),
      'tax_id', 'IN-AAECH9483Q',
      'customer_po', 'PO-DED-2026-0310',
      'vendor_ref', 'VNDR-NYC-DED-77',
      'project_code', 'DED-AIRBRIDGE-26'
    ),
    terms_conditions = 'Transit times are estimates and subject to customs inspection windows.',
    notes = 'Standalone seeded quote with full multimodal matrix: spot, contract, market, negotiated.',
    pickup_date = '2026-03-11'::date,
    delivery_deadline = '2026-03-18'::date,
    incoterms = 'DAP',
    vehicle_type = 'reefer_truck',
    transport_mode = 'air',
    origin_location = jsonb_build_object('name', 'John F. Kennedy International Airport', 'code', 'JFK', 'city', 'New York', 'country', 'US'),
    destination_location = jsonb_build_object('name', 'Jolly Grant Airport', 'code', 'DED', 'city', 'Dehradun', 'country', 'IN'),
    origin_code = 'JFK',
    destination_code = 'DED',
    origin_port_id = v_origin_port_id,
    destination_port_id = v_destination_port_id,
    cargo_details = jsonb_build_object(
      'cargo_type', 'container',
      'quantity', 2,
      'commodity', 'Temperature-sensitive pharmaceutical shipments',
      'commodity_details', jsonb_build_object(
        'description', 'Temperature-sensitive pharmaceutical shipments',
        'hts_code', '30049000',
        'schedule_b', '3004.90.0000',
        'aes_hts_id', 'AES-30049000-DED'
      ),
      'container_combos', jsonb_build_array(
        jsonb_build_object('type', 'reefer', 'size', '40''', 'qty', 1),
        jsonb_build_object('type', 'high_cube', 'size', '45''', 'qty', 1)
      ),
      'unit_weight_kg', 2450,
      'total_weight_kg', 4900,
      'unit_volume_cbm', 31.2,
      'total_volume_cbm', 62.4,
      'weight_unit', 'kg',
      'dimensions', jsonb_build_object('l', 1180, 'w', 235, 'h', 269, 'unit', 'cm'),
      'dangerous_goods', false,
      'hazmat_details', null,
      'temperature_controlled', true,
      'temperature_range', jsonb_build_object('min_c', 2, 'max_c', 8),
      'special_handling', 'Keep continuous power during transshipment; pharma priority lane'
    ),
    current_version_id = v_quote_version_id,
    updated_at = NOW()
  WHERE id = v_quote_id;

  UPDATE public.quotation_versions
  SET
    is_current = (id = v_quote_version_id),
    is_active = (id = v_quote_version_id),
    status = CASE WHEN id = v_quote_version_id THEN 'draft' ELSE COALESCE(status, 'archived') END,
    updated_at = NOW()
  WHERE quote_id = v_quote_id;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'quotation_templates'
  ) THEN
    SELECT id INTO v_template_id
    FROM public.quotation_templates
    WHERE tenant_id = v_tenant_id
      AND quote_id = v_quote_id
      AND quote_version_id = v_quote_version_id
      AND template_name = 'MGL-Main-Template'
    LIMIT 1;

    IF v_template_id IS NULL THEN
      INSERT INTO public.quotation_templates (
        tenant_id, quote_id, quote_version_id, template_name, config, is_active
      ) VALUES (
        v_tenant_id,
        v_quote_id,
        v_quote_version_id,
        'MGL-Main-Template',
        '{"layout":"matrix","seed_ref":"QUO-260309-00001"}'::jsonb,
        true
      ) RETURNING id INTO v_template_id;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dynamic_surcharges'
      AND column_name = 'trigger_conditions'
  ) INTO v_has_dynamic_trigger_conditions;

  IF v_has_dynamic_trigger_conditions THEN
    DELETE FROM public.dynamic_surcharges
    WHERE tenant_id = v_tenant_id
      AND trigger_conditions ->> 'seed_ref' = v_seed_ref;

    INSERT INTO public.dynamic_surcharges (
      tenant_id, surcharge_type, applicable_to, calculation_method, base_value, min_value, max_value, currency, validity_period, trigger_conditions
    ) VALUES
    (v_tenant_id, 'fuel', ARRAY['air','ocean','road','rail'], 'percentage', 0.0850, 0.0500, 0.1500, 'USD', daterange('2026-03-10'::date,'2026-03-18'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"spot"}'::jsonb),
    (v_tenant_id, 'currency', ARRAY['air','ocean','road','rail'], 'percentage', 0.0120, 0.0050, 0.0300, 'USD', daterange('2026-03-10'::date,'2026-03-18'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"spot"}'::jsonb),
    (v_tenant_id, 'fuel', ARRAY['ocean','road'], 'percentage', 0.0720, 0.0700, 0.0750, 'USD', daterange('2026-03-10'::date,'2026-06-11'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"contract"}'::jsonb),
    (v_tenant_id, 'security', ARRAY['air','ocean'], 'fixed', 125.00, 120.00, 140.00, 'USD', daterange('2026-03-10'::date,'2026-06-11'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"contract"}'::jsonb),
    (v_tenant_id, 'fuel', ARRAY['air'], 'formula', 0.0000, 0.0000, 0.0000, 'USD', daterange('2026-03-10'::date,'2026-03-14'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"market","formula":"jet_a_index*1.12"}'::jsonb),
    (v_tenant_id, 'security', ARRAY['ocean'], 'fixed', 225.00, 200.00, 250.00, 'USD', daterange('2026-03-10'::date,'2026-03-18'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"market"}'::jsonb),
    (v_tenant_id, 'fuel', ARRAY['air','ocean'], 'percentage', 0.0650, 0.0600, 0.0700, 'USD', daterange('2026-03-10'::date,'2027-01-01'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"negotiated"}'::jsonb),
    (v_tenant_id, 'security', ARRAY['air'], 'fixed', 85.00, 80.00, 90.00, 'USD', daterange('2026-03-10'::date,'2027-01-01'::date,'[)'), '{"seed_ref":"QUO-260309-00001","rate_type":"negotiated"}'::jsonb);
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dynamic_surcharges'
      AND column_name = 'applicable_modes'
  ) THEN
    INSERT INTO public.dynamic_surcharges (
      tenant_id, surcharge_type, applicable_modes, calculation_method, base_value, currency_code, validity_period, geographic_scope
    ) VALUES
    (v_tenant_id, 'fuel', '["air","ocean","road","rail"]'::jsonb, 'percentage', 0.0850, 'USD', daterange('2026-03-10'::date,'2026-03-18'::date,'[)'), jsonb_build_object('seed_ref', v_seed_ref, 'rate_type', 'spot')),
    (v_tenant_id, 'security', '["air","ocean"]'::jsonb, 'fixed', 125.00, 'USD', daterange('2026-03-10'::date,'2026-06-11'::date,'[)'), jsonb_build_object('seed_ref', v_seed_ref, 'rate_type', 'contract'));
  END IF;

  IF v_has_dynamic_trigger_conditions THEN
    SELECT COUNT(*) INTO v_dynamic_surcharge_seed_count
    FROM public.dynamic_surcharges ds
    WHERE ds.tenant_id = v_tenant_id
      AND ds.trigger_conditions ->> 'seed_ref' = v_seed_ref;
  ELSE
    SELECT COUNT(*) INTO v_dynamic_surcharge_seed_count
    FROM public.dynamic_surcharges ds
    WHERE ds.tenant_id = v_tenant_id
      AND ds.surcharge_type IN ('fuel', 'security');
  END IF;

  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'quote_cargo_configurations'
    ) THEN
      DELETE FROM public.quote_cargo_configurations
      WHERE quote_id = v_quote_id;

      INSERT INTO public.quote_cargo_configurations (
        quote_id, tenant_id, transport_mode, cargo_type, container_type, container_size, quantity,
        unit_weight_kg, unit_volume_cbm, length_cm, width_cm, height_cm, is_hazardous,
        hazardous_class, un_number, is_temperature_controlled, temperature_min, temperature_max, remarks
      ) VALUES
      (
        v_quote_id, v_tenant_id, 'air', 'ULD', 'Reefer', '40', 1,
        2450, 31.2, 1180, 235, 269, false,
        NULL, NULL, true, 2, 8,
        'Main leg pharma load with active temperature control'
      ),
      (
        v_quote_id, v_tenant_id, 'road', 'FCL', 'High Cube', '45', 1,
        2450, 31.2, 1180, 235, 269, false,
        NULL, NULL, false, NULL, NULL,
        'Final-mile bonded reefer truck transfer DEL to DED'
      );
    END IF;
  EXCEPTION
    WHEN undefined_column OR undefined_table OR undefined_function THEN
      NULL;
  END;

  DELETE FROM public.quote_items
  WHERE quote_id = v_quote_id;

  INSERT INTO public.quote_items (
    quote_id, line_number, product_name, description, quantity, unit_price, discount_percent, discount_amount, tax_percent, tax_amount, line_total
  ) VALUES
  (
    v_quote_id, 1, 'Pharmaceutical Cold-Chain Consignment',
    'HS 30049000, reefer-enabled multimodal transfer from NYC to DED',
    2, 1550.00, 0, 0, 0, 0, 3100.00
  ),
  (
    v_quote_id, 2, 'Priority Customs & Handling Package',
    'Includes customs coordination at DEL and DED transfer handling',
    1, 730.00, 0, 0, 0, 0, 730.00
  );

  DELETE FROM public.quote_documents
  WHERE quote_id = v_quote_id;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quote_documents'
      AND column_name = 'document_url'
  ) THEN
    INSERT INTO public.quote_documents (
      quote_id, document_type, document_url, document_data
    ) VALUES
    (
      v_quote_id,
      'commercial_invoice',
      'https://example.com/quo-260309-00001/commercial-invoice.pdf',
      jsonb_build_object('seed_ref', v_seed_ref, 'category', 'invoice')
    ),
    (
      v_quote_id,
      'packing_list',
      'https://example.com/quo-260309-00001/packing-list.pdf',
      jsonb_build_object('seed_ref', v_seed_ref, 'category', 'cargo_documents')
    ),
    (
      v_quote_id,
      'dangerous_goods_declaration',
      'https://example.com/quo-260309-00001/dg-declaration.pdf',
      jsonb_build_object('seed_ref', v_seed_ref, 'category', 'compliance', 'required', false)
    );
  ELSE
    INSERT INTO public.quote_documents (
      tenant_id, quote_id, document_type, document_name, file_url, is_public
    ) VALUES
    (
      v_tenant_id,
      v_quote_id,
      'commercial_invoice',
      v_seed_ref || ' Commercial Invoice',
      'https://example.com/quo-260309-00001/commercial-invoice.pdf',
      false
    ),
    (
      v_tenant_id,
      v_quote_id,
      'packing_list',
      v_seed_ref || ' Packing List',
      'https://example.com/quo-260309-00001/packing-list.pdf',
      false
    ),
    (
      v_tenant_id,
      v_quote_id,
      'dangerous_goods_declaration',
      v_seed_ref || ' DG Declaration',
      'https://example.com/quo-260309-00001/dg-declaration.pdf',
      false
    );
  END IF;

  INSERT INTO public.transfer_points (
    tenant_id, code, name, location_type, country_code, latitude, longitude, timezone, operating_hours, facility_capabilities, security_level, customs_clearance_available, average_dwell_time_hours
  ) VALUES
  (v_tenant_id, 'JFK', 'John F. Kennedy International Airport', 'airport', 'US', 40.6413, -73.7781, 'America/New_York', '{"mon":"00:00-23:59"}'::jsonb, '["air_cargo","cold_storage","hazmat"]'::jsonb, 'enhanced', true, 6),
  (v_tenant_id, 'EWR', 'Newark Liberty International Airport', 'airport', 'US', 40.6895, -74.1745, 'America/New_York', '{"mon":"00:00-23:59"}'::jsonb, '["air_cargo","pharma","perishables"]'::jsonb, 'enhanced', true, 8),
  (v_tenant_id, 'PANYNJ', 'Port Authority of NY/NJ', 'seaport', 'US', 40.6984, -74.0299, 'America/New_York', '{"mon":"06:00-22:00"}'::jsonb, '["container_handling","breakbulk","project"]'::jsonb, 'maximum', true, 48),
  (v_tenant_id, 'DXB', 'Dubai International Airport', 'airport', 'AE', 25.2532, 55.3657, 'Asia/Dubai', '{"mon":"00:00-23:59"}'::jsonb, '["hub_transfer","pharma","express"]'::jsonb, 'enhanced', true, 5),
  (v_tenant_id, 'DEL', 'Indira Gandhi International Airport', 'airport', 'IN', 28.5562, 77.1000, 'Asia/Kolkata', '{"mon":"00:00-23:59"}'::jsonb, '["customs","cold_chain","express"]'::jsonb, 'enhanced', true, 7),
  (v_tenant_id, 'DED', 'Jolly Grant Airport', 'airport', 'IN', 30.1897, 78.1803, 'Asia/Kolkata', '{"mon":"06:00-22:00"}'::jsonb, '["regional_air","road_last_mile"]'::jsonb, 'standard', true, 9)
  ON CONFLICT ON CONSTRAINT transfer_points_unique_code
  DO UPDATE SET
    name = EXCLUDED.name,
    location_type = EXCLUDED.location_type,
    country_code = EXCLUDED.country_code,
    timezone = EXCLUDED.timezone,
    facility_capabilities = EXCLUDED.facility_capabilities,
    updated_at = NOW();

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'equipment_types'
  ) THEN
    INSERT INTO public.equipment_types (
      tenant_id, equipment_code, description, equipment_category, max_payload_kg, tare_weight_kg, internal_length_mm, internal_width_mm, internal_height_mm, door_width_mm, door_height_mm, temperature_range, special_features, is_reefer, requires_power
    ) VALUES
    (v_tenant_id, '20ST', '20'' Standard Dry Container', 'dry', 21770, 2230, 5898, 2350, 2390, 2340, 2280, NULL, '["ventilation"]'::jsonb, false, false),
    (v_tenant_id, '40ST', '40'' Standard Dry Container', 'dry', 26610, 3750, 12032, 2350, 2390, 2340, 2280, NULL, '["ventilation"]'::jsonb, false, false),
    (v_tenant_id, '40HC', '40'' High Cube Container', 'dry', 26610, 3940, 12032, 2350, 2698, 2340, 2585, NULL, '["extra_height"]'::jsonb, false, false),
    (v_tenant_id, '20RF', '20'' Reefer Container', 'reefer', 21140, 2940, 5448, 2286, 2248, 2286, 2248, '[-35,+30]', '["temperature_control","data_logging"]'::jsonb, true, true),
    (v_tenant_id, '40RF', '40'' Reefer Container', 'reefer', 26480, 4470, 11556, 2286, 2248, 2286, 2248, '[-35,+30]', '["temperature_control","remote_monitoring"]'::jsonb, true, true),
    (v_tenant_id, '20OT', '20'' Open Top Container', 'open_top', 21400, 2400, 5898, 2350, 2332, 2340, 2280, NULL, '["open_top","crane_access"]'::jsonb, false, false),
    (v_tenant_id, '40FR', '40'' Flat Rack Container', 'flat_rack', 39000, 5500, 12067, 2438, 1956, NULL, NULL, NULL, '["heavy_lift","oversized"]'::jsonb, false, false)
    ON CONFLICT ON CONSTRAINT equipment_types_unique_code
    DO UPDATE SET
      description = EXCLUDED.description,
      equipment_category = EXCLUDED.equipment_category,
      max_payload_kg = EXCLUDED.max_payload_kg,
      tare_weight_kg = EXCLUDED.tare_weight_kg,
      internal_length_mm = EXCLUDED.internal_length_mm,
      internal_width_mm = EXCLUDED.internal_width_mm,
      internal_height_mm = EXCLUDED.internal_height_mm,
      door_width_mm = EXCLUDED.door_width_mm,
      door_height_mm = EXCLUDED.door_height_mm,
      temperature_range = EXCLUDED.temperature_range,
      special_features = EXCLUDED.special_features,
      is_reefer = EXCLUDED.is_reefer,
      requires_power = EXCLUDED.requires_power,
      updated_at = NOW();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'container_specifications'
  ) THEN
    INSERT INTO public.container_specifications (
      tenant_id, iso_code, container_type, container_size, tare_weight_kg, max_payload_kg, internal_length_mm, internal_width_mm, internal_height_mm, door_opening_width_mm, door_opening_height_mm, max_gross_weight_kg, reefer_capabilities, special_features, compatibility_matrix
    ) VALUES
    (v_tenant_id, '22G1', 'standard', '20''', 2230, 21770, 5898, 2350, 2390, 2340, 2280, 24000, '{}'::jsonb, '["general_cargo"]'::jsonb, '{"general":true,"fragile":true}'::jsonb),
    (v_tenant_id, '45G1', 'standard', '40''HC', 3940, 26610, 12032, 2350, 2698, 2340, 2585, 30550, '{}'::jsonb, '["high_cube"]'::jsonb, '{"general":true,"fragile":true}'::jsonb),
    (v_tenant_id, '22R1', 'reefer', '20''', 2940, 21140, 5448, 2286, 2248, 2286, 2248, 24080, '{"min_c":-35,"max_c":30,"requires_power":true}'::jsonb, '["temperature_control"]'::jsonb, '{"perishable":true,"pharmaceutical":true}'::jsonb),
    (v_tenant_id, '45R1', 'reefer', '40''', 4470, 26480, 11556, 2286, 2248, 2286, 2248, 30950, '{"min_c":-35,"max_c":30,"requires_power":true}'::jsonb, '["temperature_control"]'::jsonb, '{"perishable":true,"pharmaceutical":true}'::jsonb),
    (v_tenant_id, '42U1', 'open_top', '40''', 4300, 28500, 12029, 2348, 2348, 2340, 2279, 32800, '{}'::jsonb, '["open_top","oversized"]'::jsonb, '{"oversized":true,"hazardous":true}'::jsonb),
    (v_tenant_id, '42P3', 'flat_rack', '40''', 5500, 39000, 12067, 2438, 1956, NULL, NULL, 44500, '{}'::jsonb, '["flat_rack","heavy_lift"]'::jsonb, '{"oversized":true,"hazardous":true}'::jsonb)
    ON CONFLICT ON CONSTRAINT container_specs_unique_iso
    DO UPDATE SET
      container_type = EXCLUDED.container_type,
      container_size = EXCLUDED.container_size,
      tare_weight_kg = EXCLUDED.tare_weight_kg,
      max_payload_kg = EXCLUDED.max_payload_kg,
      internal_length_mm = EXCLUDED.internal_length_mm,
      internal_width_mm = EXCLUDED.internal_width_mm,
      internal_height_mm = EXCLUDED.internal_height_mm,
      door_opening_width_mm = EXCLUDED.door_opening_width_mm,
      door_opening_height_mm = EXCLUDED.door_opening_height_mm,
      max_gross_weight_kg = EXCLUDED.max_gross_weight_kg,
      reefer_capabilities = EXCLUDED.reefer_capabilities,
      special_features = EXCLUDED.special_features,
      compatibility_matrix = EXCLUDED.compatibility_matrix,
      updated_at = NOW();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'commodity_classifications'
  ) THEN
    INSERT INTO public.commodity_classifications (
      tenant_id, hs_code, description, commodity_type, imdg_class, un_number, packing_group, temperature_range, flash_point_c, marine_pollutant, special_handling_requirements, routing_restrictions, insurance_multiplier
    ) VALUES
    (v_tenant_id, '84713000', 'Portable automatic data processing machines', 'general', NULL, NULL, NULL, '{"min_c":5,"max_c":35}'::jsonb, NULL, false, '["anti_static"]'::jsonb, '[]'::jsonb, 1.00),
    (v_tenant_id, '30049000', 'Pharmaceutical products', 'pharmaceutical', NULL, NULL, NULL, '{"min_c":2,"max_c":8}'::jsonb, NULL, false, '["temperature_logging","security_seal"]'::jsonb, '[]'::jsonb, 1.20),
    (v_tenant_id, '03038900', 'Frozen fish fillets', 'perishable', NULL, NULL, NULL, '{"min_c":-20,"max_c":-18}'::jsonb, NULL, false, '["continuous_power"]'::jsonb, '[]'::jsonb, 1.12),
    (v_tenant_id, '38180000', 'Chemical elements doped for electronics', 'hazardous', '8', 'UN1759', 'II', '{"min_c":5,"max_c":30}'::jsonb, 23, false, '["hazmat_documentation"]'::jsonb, '["dedicated_handling"]'::jsonb, 1.18),
    (v_tenant_id, '87032310', 'Motor vehicles', 'oversized', NULL, NULL, NULL, '{"min_c":0,"max_c":45}'::jsonb, NULL, false, '["lashing","wheel_chocks"]'::jsonb, '["flat_rack_required"]'::jsonb, 1.16)
    ON CONFLICT ON CONSTRAINT commodity_classifications_unique_hs
    DO UPDATE SET
      description = EXCLUDED.description,
      commodity_type = EXCLUDED.commodity_type,
      imdg_class = EXCLUDED.imdg_class,
      un_number = EXCLUDED.un_number,
      packing_group = EXCLUDED.packing_group,
      temperature_range = EXCLUDED.temperature_range,
      special_handling_requirements = EXCLUDED.special_handling_requirements,
      routing_restrictions = EXCLUDED.routing_restrictions,
      insurance_multiplier = EXCLUDED.insurance_multiplier,
      updated_at = NOW();
  END IF;

  DELETE FROM public.rate_options
  WHERE tenant_id = v_tenant_id
    AND quote_id = v_quote_id
    AND option_name LIKE v_seed_ref || ' / %';

  INSERT INTO public.rate_options (
    tenant_id, quote_id, quote_version_id, template_id, option_name, carrier_name, transit_time_days, frequency_per_week, mode, equipment_columns, remarks, status, rate_type, rate_valid_until, container_type, container_size, commodity_type, hs_code, imdg_class, temperature_control_min_c, temperature_control_max_c, origin_code, destination_code, standalone_mode, option_ordinal, transit_points, leg_connections, multimodal_rule_config
  ) VALUES (
    v_tenant_id, v_quote_id, v_quote_version_id, v_template_id,
    v_seed_ref || ' / Option 1 Spot', 'Lufthansa Cargo', 3, 14, 'multimodal',
    '[{"key":"standard_20","label":"Standard - 20''"},{"key":"high_cube_45","label":"High Cube - 45''"}]'::jsonb,
    'NYC to DED express mix', 'draft', 'spot', '2026-03-17 23:59:59+00',
    'standard', '40''HC', 'general', '84713000', NULL, NULL, NULL, 'JFK', 'DED', true, 1,
    '[{"id":"tp-jfk","code":"JFK","mode":"air"},{"id":"tp-del","code":"DEL","mode":"air"},{"id":"tp-ded","code":"DED","mode":"road"}]'::jsonb,
    '[]'::jsonb,
    '{"service_level":"express","seed_ref":"QUO-260309-00001"}'::jsonb
  ) RETURNING id INTO v_option1;

  INSERT INTO public.rate_options (
    tenant_id, quote_id, quote_version_id, template_id, option_name, carrier_name, transit_time_days, frequency_per_week, mode, equipment_columns, remarks, status, rate_type, rate_valid_until, container_type, container_size, commodity_type, hs_code, imdg_class, temperature_control_min_c, temperature_control_max_c, origin_code, destination_code, standalone_mode, option_ordinal, transit_points, leg_connections, multimodal_rule_config
  ) VALUES (
    v_tenant_id, v_quote_id, v_quote_version_id, v_template_id,
    v_seed_ref || ' / Option 2 Contract', 'Maersk + Emirates', 20, 4, 'multimodal',
    '[{"key":"standard_20","label":"Standard - 20''"},{"key":"open_top_40","label":"Open Top - 40''"},{"key":"high_cube_45","label":"High Cube - 45''"}]'::jsonb,
    'Ocean + air contract lane', 'draft', 'contract', '2026-06-10 23:59:59+00',
    'open_top', '40''', 'oversized', '87032310', NULL, NULL, NULL, 'PANYNJ', 'DED', true, 2,
    '[{"id":"tp-panynj","code":"PANYNJ","mode":"ocean"},{"id":"tp-dxb","code":"DXB","mode":"air"},{"id":"tp-del","code":"DEL","mode":"road"},{"id":"tp-ded","code":"DED","mode":"road"}]'::jsonb,
    '[]'::jsonb,
    '{"service_level":"standard","seed_ref":"QUO-260309-00001"}'::jsonb
  ) RETURNING id INTO v_option2;

  INSERT INTO public.rate_options (
    tenant_id, quote_id, quote_version_id, template_id, option_name, carrier_name, transit_time_days, frequency_per_week, mode, equipment_columns, remarks, status, rate_type, rate_valid_until, container_type, container_size, commodity_type, hs_code, imdg_class, temperature_control_min_c, temperature_control_max_c, origin_code, destination_code, standalone_mode, option_ordinal, transit_points, leg_connections, multimodal_rule_config
  ) VALUES (
    v_tenant_id, v_quote_id, v_quote_version_id, v_template_id,
    v_seed_ref || ' / Option 3 Market', 'MSC + Indian Rail', 26, 2, 'multimodal',
    '[{"key":"standard_20","label":"Standard - 20''"},{"key":"flat_rack_40","label":"Flat Rack - 40''"}]'::jsonb,
    'Market-index linked lane', 'draft', 'market', '2026-03-17 23:59:59+00',
    'flat_rack', '40''', 'hazardous', '38180000', '8', NULL, NULL, 'PANYNJ', 'DED', true, 3,
    '[{"id":"tp-panynj","code":"PANYNJ","mode":"ocean"},{"id":"tp-del","code":"DEL","mode":"road"},{"id":"tp-ded","code":"DED","mode":"road"}]'::jsonb,
    '[]'::jsonb,
    '{"service_level":"economy","seed_ref":"QUO-260309-00001"}'::jsonb
  ) RETURNING id INTO v_option3;

  INSERT INTO public.rate_options (
    tenant_id, quote_id, quote_version_id, template_id, option_name, carrier_name, transit_time_days, frequency_per_week, mode, equipment_columns, remarks, status, rate_type, rate_valid_until, container_type, container_size, commodity_type, hs_code, imdg_class, temperature_control_min_c, temperature_control_max_c, origin_code, destination_code, standalone_mode, option_ordinal, transit_points, leg_connections, multimodal_rule_config
  ) VALUES (
    v_tenant_id, v_quote_id, v_quote_version_id, v_template_id,
    v_seed_ref || ' / Option 4 Negotiated', 'Kuehne + Nagel', 4, 7, 'multimodal',
    '[{"key":"standard_20","label":"Standard - 20''"},{"key":"reefer_40","label":"Reefer - 40''"}]'::jsonb,
    'Pharma negotiated lane', 'draft', 'negotiated', '2026-12-31 23:59:59+00',
    'reefer', '40''', 'pharmaceutical', '30049000', NULL, 2.00, 8.00, 'EWR', 'DED', true, 4,
    '[{"id":"tp-ewr","code":"EWR","mode":"air"},{"id":"tp-del","code":"DEL","mode":"air"},{"id":"tp-ded","code":"DED","mode":"road"}]'::jsonb,
    '[]'::jsonb,
    '{"service_level":"express","seed_ref":"QUO-260309-00001"}'::jsonb
  ) RETURNING id INTO v_option4;

  INSERT INTO public.rate_option_legs (
    rate_option_id, tenant_id, sequence_no, transport_mode, leg_type, origin_code, destination_code, origin_name, destination_name, carrier_name, transit_days, frequency_per_week, metadata
  ) VALUES
  (v_option1, v_tenant_id, 1, 'air', 'transport', 'JFK', 'DEL', 'John F. Kennedy International Airport', 'Indira Gandhi International Airport', 'Lufthansa Cargo', 2, 14, '{"service_level":"express","capacity_available":true,"reliability_score":0.95}'::jsonb),
  (v_option1, v_tenant_id, 2, 'road', 'transport', 'DEL', 'DED', 'Indira Gandhi International Airport', 'Jolly Grant Airport', 'North India Express Trucking', 1, 14, '{"service_level":"express","capacity_available":true,"reliability_score":0.93}'::jsonb),
  (v_option2, v_tenant_id, 1, 'ocean', 'transport', 'PANYNJ', 'DXB', 'Port Authority of NY/NJ', 'Dubai International Airport', 'Maersk', 16, 3, '{"service_level":"standard","capacity_available":true,"reliability_score":0.88}'::jsonb),
  (v_option2, v_tenant_id, 2, 'air', 'transport', 'DXB', 'DEL', 'Dubai International Airport', 'Indira Gandhi International Airport', 'Emirates SkyCargo', 2, 7, '{"service_level":"standard","capacity_available":true,"reliability_score":0.92}'::jsonb),
  (v_option2, v_tenant_id, 3, 'road', 'transport', 'DEL', 'DED', 'Indira Gandhi International Airport', 'Jolly Grant Airport', 'North India Truck Network', 2, 7, '{"service_level":"standard","capacity_available":true,"reliability_score":0.90}'::jsonb),
  (v_option3, v_tenant_id, 1, 'ocean', 'transport', 'PANYNJ', 'DEL', 'Port Authority of NY/NJ', 'Indira Gandhi International Airport', 'MSC', 24, 2, '{"service_level":"economy","capacity_available":true,"reliability_score":0.84}'::jsonb),
  (v_option3, v_tenant_id, 2, 'road', 'transport', 'DEL', 'DED', 'Indira Gandhi International Airport', 'Jolly Grant Airport', 'India Regional Haulage', 2, 7, '{"service_level":"economy","capacity_available":true,"reliability_score":0.87}'::jsonb),
  (v_option4, v_tenant_id, 1, 'air', 'transport', 'EWR', 'DEL', 'Newark Liberty International Airport', 'Indira Gandhi International Airport', 'Kuehne + Nagel Air', 3, 7, '{"service_level":"express","capacity_available":true,"reliability_score":0.94}'::jsonb),
  (v_option4, v_tenant_id, 2, 'road', 'transport', 'DEL', 'DED', 'Indira Gandhi International Airport', 'Jolly Grant Airport', 'Temperature-Controlled Trucking', 1, 7, '{"service_level":"express","capacity_available":true,"reliability_score":0.92}'::jsonb);

  INSERT INTO public.leg_connections (
    tenant_id, rate_option_id, from_leg_id, to_leg_id, transfer_point_id, min_connection_hours, max_connection_hours, equipment_transfer_required, customs_clearance_required, transfer_cost, transfer_time_hours, carrier_handover_required, insurance_coverage_transition
  )
  SELECT
    v_tenant_id,
    v_option1,
    l1.id,
    l2.id,
    tp.id,
    4,
    18,
    false,
    true,
    95.00,
    6,
    true,
    '{"status":"continuous","provider":"global"}'::jsonb
  FROM public.rate_option_legs l1
  JOIN public.rate_option_legs l2 ON l2.rate_option_id = l1.rate_option_id AND l2.sequence_no = l1.sequence_no + 1
  JOIN public.transfer_points tp ON tp.tenant_id = v_tenant_id AND tp.code = l1.destination_code
  WHERE l1.rate_option_id = v_option1
  ON CONFLICT ON CONSTRAINT leg_connections_unique_transfer DO NOTHING;

  INSERT INTO public.leg_connections (
    tenant_id, rate_option_id, from_leg_id, to_leg_id, transfer_point_id, min_connection_hours, max_connection_hours, equipment_transfer_required, customs_clearance_required, transfer_cost, transfer_time_hours, carrier_handover_required, insurance_coverage_transition
  )
  SELECT
    v_tenant_id,
    v_option2,
    l1.id,
    l2.id,
    tp.id,
    6,
    24,
    true,
    true,
    135.00,
    8,
    true,
    '{"status":"handover_required","provider":"global"}'::jsonb
  FROM public.rate_option_legs l1
  JOIN public.rate_option_legs l2 ON l2.rate_option_id = l1.rate_option_id AND l2.sequence_no = l1.sequence_no + 1
  JOIN public.transfer_points tp ON tp.tenant_id = v_tenant_id AND tp.code = l1.destination_code
  WHERE l1.rate_option_id = v_option2
  ON CONFLICT ON CONSTRAINT leg_connections_unique_transfer DO NOTHING;

  INSERT INTO public.leg_connections (
    tenant_id, rate_option_id, from_leg_id, to_leg_id, transfer_point_id, min_connection_hours, max_connection_hours, equipment_transfer_required, customs_clearance_required, transfer_cost, transfer_time_hours, carrier_handover_required, insurance_coverage_transition
  )
  SELECT
    v_tenant_id,
    v_option3,
    l1.id,
    l2.id,
    tp.id,
    8,
    30,
    true,
    true,
    160.00,
    10,
    true,
    '{"status":"handover_required","provider":"regional"}'::jsonb
  FROM public.rate_option_legs l1
  JOIN public.rate_option_legs l2 ON l2.rate_option_id = l1.rate_option_id AND l2.sequence_no = l1.sequence_no + 1
  JOIN public.transfer_points tp ON tp.tenant_id = v_tenant_id AND tp.code = l1.destination_code
  WHERE l1.rate_option_id = v_option3
  ON CONFLICT ON CONSTRAINT leg_connections_unique_transfer DO NOTHING;

  INSERT INTO public.leg_connections (
    tenant_id, rate_option_id, from_leg_id, to_leg_id, transfer_point_id, min_connection_hours, max_connection_hours, equipment_transfer_required, customs_clearance_required, transfer_cost, transfer_time_hours, carrier_handover_required, insurance_coverage_transition
  )
  SELECT
    v_tenant_id,
    v_option4,
    l1.id,
    l2.id,
    tp.id,
    4,
    16,
    false,
    true,
    120.00,
    5,
    true,
    '{"status":"cold_chain_handover","provider":"pharma"}'::jsonb
  FROM public.rate_option_legs l1
  JOIN public.rate_option_legs l2 ON l2.rate_option_id = l1.rate_option_id AND l2.sequence_no = l1.sequence_no + 1
  JOIN public.transfer_points tp ON tp.tenant_id = v_tenant_id AND tp.code = l1.destination_code
  WHERE l1.rate_option_id = v_option4
  ON CONFLICT ON CONSTRAINT leg_connections_unique_transfer DO NOTHING;

  INSERT INTO public.rate_charge_rows (
    rate_option_id, tenant_id, row_code, row_name, currency, basis, include_in_total, remarks, sort_order
  ) VALUES
  (v_option1, v_tenant_id, 'freight', 'Air Freight', 'USD', 'per_kg', true, NULL, 10),
  (v_option1, v_tenant_id, 'fuel', 'Fuel Surcharge', 'USD', 'per_kg', true, NULL, 20),
  (v_option1, v_tenant_id, 'security', 'Security Fee', 'USD', 'per_shipment', true, NULL, 30),
  (v_option2, v_tenant_id, 'ocean_freight', 'Ocean Freight', 'USD', 'per_container', true, NULL, 10),
  (v_option2, v_tenant_id, 'air_freight', 'Air Connection', 'USD', 'per_container', true, NULL, 20),
  (v_option2, v_tenant_id, 'oncarriage', 'Final Delivery', 'USD', 'per_container', true, NULL, 30),
  (v_option3, v_tenant_id, 'ocean_freight', 'Ocean Freight', 'USD', 'per_container', true, NULL, 10),
  (v_option3, v_tenant_id, 'emergency', 'Emergency Surcharge', 'USD', 'per_container', true, NULL, 20),
  (v_option3, v_tenant_id, 'oncarriage', 'Final Delivery', 'USD', 'per_container', true, NULL, 30),
  (v_option4, v_tenant_id, 'air_freight', 'Air Freight', 'USD', 'per_kg', true, NULL, 10),
  (v_option4, v_tenant_id, 'pharma', 'Pharma Handling', 'USD', 'per_shipment', true, NULL, 20),
  (v_option4, v_tenant_id, 'temperature', 'Temperature Control', 'USD', 'per_shipment', true, NULL, 30);

  DELETE FROM public.rate_charge_cells
  WHERE tenant_id = v_tenant_id
    AND charge_row_id IN (
      SELECT id
      FROM public.rate_charge_rows
      WHERE tenant_id = v_tenant_id
        AND rate_option_id IN (v_option1, v_option2, v_option3, v_option4)
    );

  INSERT INTO public.rate_charge_cells (charge_row_id, tenant_id, equipment_key, amount)
  SELECT r.id, r.tenant_id, e.equipment_key, e.amount
  FROM public.rate_charge_rows r
  JOIN LATERAL (
    VALUES
      ('standard_20', CASE r.row_code
        WHEN 'freight' THEN 4500.00
        WHEN 'fuel' THEN 380.00
        WHEN 'security' THEN 85.00
        WHEN 'ocean_freight' THEN CASE WHEN r.rate_option_id = v_option2 THEN 2100.00 ELSE 1800.00 END
        WHEN 'air_freight' THEN CASE WHEN r.rate_option_id = v_option2 THEN 1450.00 ELSE 2600.00 END
        WHEN 'oncarriage' THEN CASE WHEN r.rate_option_id = v_option3 THEN 420.00 ELSE 280.00 END
        WHEN 'emergency' THEN 225.00
        WHEN 'pharma' THEN 320.00
        WHEN 'temperature' THEN 180.00
        ELSE 0.00
      END),
      ('high_cube_45', CASE r.row_code
        WHEN 'freight' THEN 6100.00
        WHEN 'fuel' THEN 540.00
        WHEN 'security' THEN 85.00
        WHEN 'ocean_freight' THEN CASE WHEN r.rate_option_id = v_option2 THEN 2680.00 ELSE 2240.00 END
        WHEN 'air_freight' THEN CASE WHEN r.rate_option_id = v_option2 THEN 1850.00 ELSE 3120.00 END
        WHEN 'oncarriage' THEN CASE WHEN r.rate_option_id = v_option3 THEN 540.00 ELSE 360.00 END
        WHEN 'emergency' THEN 290.00
        WHEN 'pharma' THEN 440.00
        WHEN 'temperature' THEN 245.00
        ELSE 0.00
      END)
  ) AS e(equipment_key, amount) ON TRUE
  WHERE r.tenant_id = v_tenant_id
    AND r.rate_option_id IN (v_option1, v_option2, v_option3, v_option4);

  UPDATE public.rate_options ro
  SET
    total_by_equipment = COALESCE(agg.totals, '{}'::jsonb),
    grand_total = COALESCE(agg.grand_total, 0)
  FROM (
    SELECT
      rr.rate_option_id,
      jsonb_object_agg(x.equipment_key, x.total_amount) AS totals,
      SUM(x.total_amount) AS grand_total
    FROM (
      SELECT
        rr.rate_option_id,
        rc.equipment_key,
        ROUND(SUM(rc.amount)::numeric, 2) AS total_amount
      FROM public.rate_charge_rows rr
      JOIN public.rate_charge_cells rc ON rc.charge_row_id = rr.id
      WHERE rr.tenant_id = v_tenant_id
        AND rr.rate_option_id IN (v_option1, v_option2, v_option3, v_option4)
      GROUP BY rr.rate_option_id, rc.equipment_key
    ) x
    JOIN public.rate_charge_rows rr ON rr.rate_option_id = x.rate_option_id
    GROUP BY rr.rate_option_id
  ) agg
  WHERE ro.id = agg.rate_option_id;

  UPDATE public.rate_options ro
  SET leg_connections = COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', lc.id,
        'from_leg_id', lc.from_leg_id,
        'to_leg_id', lc.to_leg_id,
        'transfer_point_id', lc.transfer_point_id,
        'min_connection_hours', lc.min_connection_hours,
        'max_connection_hours', lc.max_connection_hours
      )
      ORDER BY l_from.sequence_no
    )
    FROM public.leg_connections lc
    JOIN public.rate_option_legs l_from ON l_from.id = lc.from_leg_id
    WHERE lc.rate_option_id = ro.id
  ), '[]'::jsonb)
  WHERE ro.id IN (v_option1, v_option2, v_option3, v_option4);

  DELETE FROM public.quotation_version_options
  WHERE tenant_id = v_tenant_id
    AND quotation_version_id = v_quote_version_id
    AND (
      source = 'seed'
      OR option_name LIKE v_seed_ref || ' / %'
      OR option_name LIKE 'Option % - %'
    );

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotation_version_options'
      AND column_name = 'sort_order'
  ) INTO v_has_qvo_sort_order;

  IF v_has_qvo_sort_order THEN
    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, sort_order, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 1 Spot', 'Lufthansa Cargo', 1, true, 'draft', 'USD', 4965.00, 3, 'seed'
    ) RETURNING id INTO v_qvo1;

    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, sort_order, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 2 Contract', 'Maersk + Emirates', 2, false, 'draft', 'USD', 3830.00, 20, 'seed'
    ) RETURNING id INTO v_qvo2;

    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, sort_order, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 3 Market', 'MSC + Indian Rail', 3, false, 'draft', 'USD', 2445.00, 26, 'seed'
    ) RETURNING id INTO v_qvo3;

    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, sort_order, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 4 Negotiated', 'Kuehne + Nagel', 4, false, 'draft', 'USD', 3100.00, 4, 'seed'
    ) RETURNING id INTO v_qvo4;
  ELSE
    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 1 Spot', 'Lufthansa Cargo', true, 'draft', 'USD', 4965.00, 3, 'seed'
    ) RETURNING id INTO v_qvo1;

    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 2 Contract', 'Maersk + Emirates', false, 'draft', 'USD', 3830.00, 20, 'seed'
    ) RETURNING id INTO v_qvo2;

    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 3 Market', 'MSC + Indian Rail', false, 'draft', 'USD', 2445.00, 26, 'seed'
    ) RETURNING id INTO v_qvo3;

    INSERT INTO public.quotation_version_options (
      tenant_id, franchise_id, quotation_version_id, option_name, carrier_name, is_selected, status, currency, total_amount, total_transit_days, source
    ) VALUES (
      v_tenant_id, v_franchise_id, v_quote_version_id, v_seed_ref || ' / Option 4 Negotiated', 'Kuehne + Nagel', false, 'draft', 'USD', 3100.00, 4, 'seed'
    ) RETURNING id INTO v_qvo4;
  END IF;

  INSERT INTO public.quotation_version_option_legs (
    quotation_version_option_id, tenant_id, franchise_id, sort_order, mode, transport_mode, carrier_name, origin_location, destination_location, transit_time_hours
  )
  SELECT
    CASE
      WHEN rol.rate_option_id = v_option1 THEN v_qvo1
      WHEN rol.rate_option_id = v_option2 THEN v_qvo2
      WHEN rol.rate_option_id = v_option3 THEN v_qvo3
      WHEN rol.rate_option_id = v_option4 THEN v_qvo4
      ELSE NULL
    END,
    rol.tenant_id,
    v_franchise_id,
    rol.sequence_no,
    rol.transport_mode,
    rol.transport_mode,
    rol.carrier_name,
    rol.origin_code,
    rol.destination_code,
    COALESCE(rol.transit_days, 0) * 24
  FROM public.rate_option_legs rol
  WHERE rol.rate_option_id IN (v_option1, v_option2, v_option3, v_option4);

  SELECT id
  INTO v_currency_usd_id
  FROM public.currencies
  WHERE code = 'USD'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_side_buy_id
  FROM public.charge_sides
  WHERE code = 'buy'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_side_sell_id
  FROM public.charge_sides
  WHERE code = 'sell'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_cat_freight_id
  FROM public.charge_categories
  WHERE code = 'freight'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_cat_fuel_id
  FROM public.charge_categories
  WHERE code = 'fuel'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_cat_security_id
  FROM public.charge_categories
  WHERE code = 'security'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_cat_handling_id
  FROM public.charge_categories
  WHERE code = 'handling'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_cat_customs_id
  FROM public.charge_categories
  WHERE code = 'customs'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_basis_kg_id
  FROM public.charge_bases
  WHERE code = 'kg'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_basis_shipment_id
  FROM public.charge_bases
  WHERE code = 'shipment'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  SELECT id
  INTO v_basis_container_id
  FROM public.charge_bases
  WHERE code = 'container'
    AND (tenant_id = v_tenant_id OR tenant_id IS NULL)
  ORDER BY CASE WHEN tenant_id = v_tenant_id THEN 0 ELSE 1 END, created_at ASC
  LIMIT 1;

  IF v_currency_usd_id IS NULL
     OR v_side_buy_id IS NULL
     OR v_side_sell_id IS NULL
     OR v_cat_freight_id IS NULL
     OR v_cat_fuel_id IS NULL
     OR v_cat_security_id IS NULL
     OR v_cat_handling_id IS NULL
     OR v_cat_customs_id IS NULL
     OR v_basis_kg_id IS NULL
     OR v_basis_shipment_id IS NULL
     OR v_basis_container_id IS NULL THEN
    RAISE EXCEPTION 'Missing charge master data for %', v_seed_ref;
  END IF;

  DELETE FROM public.quote_charges
  WHERE quote_option_id IN (v_qvo1, v_qvo2, v_qvo3, v_qvo4);

  WITH option_map AS (
    SELECT 1::int AS option_no, v_qvo1 AS qvo_id
    UNION ALL SELECT 2::int, v_qvo2
    UNION ALL SELECT 3::int, v_qvo3
    UNION ALL SELECT 4::int, v_qvo4
  ),
  leg_map AS (
    SELECT
      om.option_no,
      qvol.sort_order,
      qvol.id AS leg_id
    FROM option_map om
    JOIN public.quotation_version_option_legs qvol
      ON qvol.quotation_version_option_id = om.qvo_id
  ),
  charge_seed AS (
    SELECT *
    FROM (VALUES
      (1::int, 1::int, 'freight'::text, 'kg'::text, 4900::numeric, 0.82::numeric, 1.02::numeric, 'Primary air freight JFK-DEL'::text, 10::int),
      (1::int, 1::int, 'fuel'::text, 'kg'::text, 4900::numeric, 0.07::numeric, 0.09::numeric, 'Jet fuel index surcharge'::text, 20::int),
      (1::int, 2::int, 'handling'::text, 'shipment'::text, 1::numeric, 125.00::numeric, 165.00::numeric, 'Cold-chain handling DEL-DED'::text, 30::int),
      (1::int, NULL::int, 'security'::text, 'shipment'::text, 1::numeric, 80.00::numeric, 98.00::numeric, 'Security screening and escort'::text, 40::int),
      (1::int, 2::int, 'customs'::text, 'shipment'::text, 1::numeric, 95.00::numeric, 140.00::numeric, 'Customs documentation and clearance'::text, 50::int),
      (2::int, 1::int, 'freight'::text, 'container'::text, 2::numeric, 1050.00::numeric, 1280.00::numeric, 'Ocean freight PANYNJ-DXB'::text, 10::int),
      (2::int, 2::int, 'freight'::text, 'container'::text, 2::numeric, 720.00::numeric, 930.00::numeric, 'Air uplift DXB-DEL'::text, 20::int),
      (2::int, 3::int, 'handling'::text, 'container'::text, 2::numeric, 165.00::numeric, 225.00::numeric, 'Road final-mile DEL-DED'::text, 30::int),
      (2::int, NULL::int, 'fuel'::text, 'container'::text, 2::numeric, 95.00::numeric, 130.00::numeric, 'Multimodal fuel surcharge'::text, 40::int),
      (2::int, NULL::int, 'customs'::text, 'shipment'::text, 1::numeric, 210.00::numeric, 280.00::numeric, 'India customs gateway clearance'::text, 50::int),
      (3::int, 1::int, 'freight'::text, 'container'::text, 1::numeric, 1780.00::numeric, 2150.00::numeric, 'Ocean freight PANYNJ-DEL'::text, 10::int),
      (3::int, 2::int, 'handling'::text, 'container'::text, 1::numeric, 410.00::numeric, 560.00::numeric, 'Regional haulage DEL-DED'::text, 20::int),
      (3::int, NULL::int, 'fuel'::text, 'container'::text, 1::numeric, 140.00::numeric, 190.00::numeric, 'Fuel escalation indexed charge'::text, 30::int),
      (3::int, NULL::int, 'security'::text, 'shipment'::text, 1::numeric, 130.00::numeric, 190.00::numeric, 'Hazmat security control'::text, 40::int),
      (3::int, NULL::int, 'customs'::text, 'shipment'::text, 1::numeric, 160.00::numeric, 240.00::numeric, 'Hazardous declarations and compliance'::text, 50::int),
      (4::int, 1::int, 'freight'::text, 'kg'::text, 4900::numeric, 0.91::numeric, 1.18::numeric, 'Premium air freight EWR-DEL'::text, 10::int),
      (4::int, 1::int, 'fuel'::text, 'kg'::text, 4900::numeric, 0.06::numeric, 0.08::numeric, 'Negotiated fuel factor'::text, 20::int),
      (4::int, 2::int, 'handling'::text, 'shipment'::text, 1::numeric, 180.00::numeric, 255.00::numeric, 'Pharma reefer trucking DEL-DED'::text, 30::int),
      (4::int, NULL::int, 'security'::text, 'shipment'::text, 1::numeric, 90.00::numeric, 125.00::numeric, 'Pharma chain-of-custody security'::text, 40::int),
      (4::int, NULL::int, 'customs'::text, 'shipment'::text, 1::numeric, 115.00::numeric, 170.00::numeric, 'Priority customs and bonded release'::text, 50::int)
    ) AS t(option_no, leg_sort, category_code, basis_code, quantity, buy_rate, sell_rate, note, sort_order)
  ),
  side_map AS (
    SELECT 'buy'::text AS side_code, v_side_buy_id AS side_id
    UNION ALL
    SELECT 'sell'::text, v_side_sell_id
  )
  INSERT INTO public.quote_charges (
    id, tenant_id, quote_option_id, leg_id, charge_side_id, category_id, basis_id, quantity, unit, rate, amount, currency_id, note, sort_order, franchise_id
  )
  SELECT
    gen_random_uuid(),
    v_tenant_id,
    om.qvo_id,
    lm.leg_id,
    sm.side_id,
    CASE cs.category_code
      WHEN 'freight' THEN v_cat_freight_id
      WHEN 'fuel' THEN v_cat_fuel_id
      WHEN 'security' THEN v_cat_security_id
      WHEN 'handling' THEN v_cat_handling_id
      WHEN 'customs' THEN v_cat_customs_id
    END,
    CASE cs.basis_code
      WHEN 'kg' THEN v_basis_kg_id
      WHEN 'shipment' THEN v_basis_shipment_id
      WHEN 'container' THEN v_basis_container_id
    END,
    cs.quantity,
    NULL,
    CASE WHEN sm.side_code = 'buy' THEN cs.buy_rate ELSE cs.sell_rate END AS rate,
    ROUND(cs.quantity * (CASE WHEN sm.side_code = 'buy' THEN cs.buy_rate ELSE cs.sell_rate END), 2) AS amount,
    v_currency_usd_id,
    cs.note,
    cs.sort_order + CASE WHEN sm.side_code = 'buy' THEN 0 ELSE 1 END,
    v_franchise_id
  FROM charge_seed cs
  JOIN option_map om ON om.option_no = cs.option_no
  LEFT JOIN leg_map lm ON lm.option_no = cs.option_no AND lm.sort_order = cs.leg_sort
  JOIN side_map sm ON TRUE;

  SELECT COUNT(*) INTO v_option_count
  FROM public.rate_options
  WHERE tenant_id = v_tenant_id AND quote_id = v_quote_id AND standalone_mode = true;

  IF v_option_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 standalone options for %, found %', v_seed_ref, v_option_count;
  END IF;

  SELECT COUNT(*) INTO v_qvo_count
  FROM public.quotation_version_options
  WHERE tenant_id = v_tenant_id
    AND quotation_version_id = v_quote_version_id
    AND option_name LIKE v_seed_ref || ' / %';

  IF v_qvo_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 quotation composer options for %, found %', v_seed_ref, v_qvo_count;
  END IF;

  SELECT COUNT(*) INTO v_leg_count
  FROM public.rate_option_legs
  WHERE tenant_id = v_tenant_id AND rate_option_id IN (v_option1, v_option2, v_option3, v_option4);

  IF v_leg_count < 8 THEN
    RAISE EXCEPTION 'Expected at least 8 seeded transport legs for %, found %', v_seed_ref, v_leg_count;
  END IF;

  SELECT COUNT(*) INTO v_rate_row_count
  FROM public.rate_charge_rows
  WHERE tenant_id = v_tenant_id AND rate_option_id IN (v_option1, v_option2, v_option3, v_option4);

  IF v_rate_row_count < 12 THEN
    RAISE EXCEPTION 'Expected at least 12 seeded charge rows for %, found %', v_seed_ref, v_rate_row_count;
  END IF;

  SELECT COUNT(*) INTO v_quote_charge_count
  FROM public.quote_charges
  WHERE quote_option_id IN (v_qvo1, v_qvo2, v_qvo3, v_qvo4);

  IF v_quote_charge_count < 40 THEN
    RAISE EXCEPTION 'Expected at least 40 quote_charges rows for %, found %', v_seed_ref, v_quote_charge_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rate_option_legs l1
    JOIN public.rate_option_legs l2
      ON l2.rate_option_id = l1.rate_option_id
     AND l2.sequence_no = l1.sequence_no + 1
    WHERE l1.rate_option_id IN (v_option1, v_option2, v_option3, v_option4)
      AND UPPER(COALESCE(l1.destination_code, '')) <> UPPER(COALESCE(l2.origin_code, ''))
  ) THEN
    RAISE EXCEPTION 'Route continuity validation failed for %', v_seed_ref;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.rate_charge_cells c
    JOIN public.rate_charge_rows r ON r.id = c.charge_row_id
    WHERE r.rate_option_id IN (v_option1, v_option2, v_option3, v_option4)
      AND c.amount < 0
  ) THEN
    RAISE EXCEPTION 'Negative charge detected for %', v_seed_ref;
  END IF;

  CREATE TABLE IF NOT EXISTS public.quotation_seeding_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    quotation_number text NOT NULL,
    total_records_seeded integer NOT NULL DEFAULT 0,
    seeding_duration_ms integer NOT NULL DEFAULT 0,
    data_integrity_score numeric(5,4) NOT NULL DEFAULT 1.0,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, quotation_number)
  );

  v_end_ts := clock_timestamp();

  INSERT INTO public.quotation_seeding_metrics (
    tenant_id, quotation_number, total_records_seeded, seeding_duration_ms, data_integrity_score, created_at
  ) VALUES (
    v_tenant_id,
    v_seed_ref,
    (
      SELECT
        v_dynamic_surcharge_seed_count +
        (SELECT COUNT(*) FROM public.transfer_points tp WHERE tp.tenant_id = v_tenant_id AND tp.code IN ('JFK','EWR','PANYNJ','DXB','DEL','DED')) +
        (SELECT COUNT(*) FROM public.quote_items qi WHERE qi.quote_id = v_quote_id) +
        (SELECT COUNT(*) FROM public.quote_documents qd WHERE qd.quote_id = v_quote_id) +
        (SELECT COUNT(*) FROM public.quotation_version_options qvo WHERE qvo.quotation_version_id = v_quote_version_id) +
        (SELECT COUNT(*) FROM public.quotation_version_option_legs qvol WHERE qvol.quotation_version_option_id IN (v_qvo1, v_qvo2, v_qvo3, v_qvo4)) +
        (SELECT COUNT(*) FROM public.rate_options ro WHERE ro.id IN (v_option1, v_option2, v_option3, v_option4)) +
        (SELECT COUNT(*) FROM public.rate_option_legs rl WHERE rl.rate_option_id IN (v_option1, v_option2, v_option3, v_option4)) +
        (SELECT COUNT(*) FROM public.leg_connections lc WHERE lc.rate_option_id IN (v_option1, v_option2, v_option3, v_option4)) +
        (SELECT COUNT(*) FROM public.rate_charge_rows rr WHERE rr.rate_option_id IN (v_option1, v_option2, v_option3, v_option4)) +
        (SELECT COUNT(*) FROM public.rate_charge_cells rc JOIN public.rate_charge_rows rr ON rr.id = rc.charge_row_id WHERE rr.rate_option_id IN (v_option1, v_option2, v_option3, v_option4)) +
        (SELECT COUNT(*) FROM public.quote_charges qc WHERE qc.quote_option_id IN (v_qvo1, v_qvo2, v_qvo3, v_qvo4))
    ),
    GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (v_end_ts - v_start_ts)) * 1000)::int),
    1.0000,
    NOW()
  )
  ON CONFLICT (tenant_id, quotation_number)
  DO UPDATE SET
    total_records_seeded = EXCLUDED.total_records_seeded,
    seeding_duration_ms = EXCLUDED.seeding_duration_ms,
    data_integrity_score = EXCLUDED.data_integrity_score,
    created_at = NOW();
END $$;
