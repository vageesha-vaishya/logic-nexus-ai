-- Fix save_quote_atomic to use correct tables for options, legs, and charges
-- Replaces usage of deprecated/non-existent tables (quotation_legs, quotation_charges)
-- with active tables (quotation_version_option_legs, quote_charges)
-- Maps columns correctly and fixes payload field mismatches
-- Adds missing logic for inserting NEW options

CREATE OR REPLACE FUNCTION save_quote_atomic(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_quote_data jsonb;
  v_items jsonb;
  v_cargo jsonb;
  v_options jsonb;
  v_item jsonb;
  v_conf jsonb;
  v_opt jsonb;
  v_leg jsonb;
  v_charge jsonb;
  v_item_id uuid;
  v_version_id uuid;
  v_option_id uuid;
  v_leg_id uuid;
  v_sort_order integer;
  v_sell_side_id uuid;
  v_buy_side_id uuid;
  v_currency_id uuid;
  v_basis_id uuid;
  v_basis_code text;
  v_currency_code text;
  v_quantity numeric;
  v_rate numeric;
  v_amount numeric;
  v_charge_sort integer;
  v_option_total_amount numeric;
  v_payload_leg_ids uuid[];
  v_charge_side_id uuid;
  v_charge_side text;
BEGIN
  v_quote_data := p_payload -> 'quote';
  v_items := p_payload -> 'items';
  v_cargo := p_payload -> 'cargo_configurations';
  v_options := p_payload -> 'options';
  
  v_quote_id := (v_quote_data ->> 'id')::uuid;
  v_tenant_id := (v_quote_data ->> 'tenant_id')::uuid;
  v_franchise_id := (v_quote_data ->> 'franchise_id')::uuid;

  -- Upsert Quote
  INSERT INTO quotes (
    id, title, description, service_type_id, service_id, incoterms, 
    incoterm_id, currency_id,
    carrier_id, consignee_id, origin_port_id, destination_port_id, 
    account_id, contact_id, opportunity_id, status, valid_until, 
    pickup_date, delivery_deadline, vehicle_type, special_handling, 
    tax_percent, shipping_amount, terms_conditions, notes, 
    billing_address, shipping_address, tenant_id, franchise_id, regulatory_data,
    created_at, updated_at,
    owner_id, created_by
  )
  VALUES (
    COALESCE(v_quote_id, gen_random_uuid()),
    v_quote_data ->> 'title',
    v_quote_data ->> 'description',
    (v_quote_data ->> 'service_type_id')::uuid,
    (v_quote_data ->> 'service_id')::uuid,
    v_quote_data ->> 'incoterms',
    (v_quote_data ->> 'incoterm_id')::uuid,
    (v_quote_data ->> 'currency_id')::uuid,
    (v_quote_data ->> 'carrier_id')::uuid,
    (v_quote_data ->> 'consignee_id')::uuid,
    (v_quote_data ->> 'origin_port_id')::uuid,
    (v_quote_data ->> 'destination_port_id')::uuid,
    (v_quote_data ->> 'account_id')::uuid,
    (v_quote_data ->> 'contact_id')::uuid,
    (v_quote_data ->> 'opportunity_id')::uuid,
    COALESCE(v_quote_data ->> 'status', 'draft'),
    (v_quote_data ->> 'valid_until')::timestamptz,
    (v_quote_data ->> 'pickup_date')::date,
    (v_quote_data ->> 'delivery_deadline')::date,
    v_quote_data ->> 'vehicle_type',
    v_quote_data -> 'special_handling',
    COALESCE((v_quote_data ->> 'tax_percent')::numeric, 0),
    COALESCE((v_quote_data ->> 'shipping_amount')::numeric, 0),
    v_quote_data ->> 'terms_conditions',
    v_quote_data ->> 'notes',
    COALESCE(v_quote_data -> 'billing_address', '{}'::jsonb),
    COALESCE(v_quote_data -> 'shipping_address', '{}'::jsonb),
    v_tenant_id,
    v_franchise_id,
    COALESCE(v_quote_data -> 'regulatory_data', '{}'::jsonb),
    COALESCE((v_quote_data ->> 'created_at')::timestamptz, now()),
    now(),
    COALESCE((v_quote_data ->> 'owner_id')::uuid, auth.uid()),
    COALESCE((v_quote_data ->> 'created_by')::uuid, auth.uid())
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    service_type_id = EXCLUDED.service_type_id,
    service_id = EXCLUDED.service_id,
    incoterms = EXCLUDED.incoterms,
    incoterm_id = EXCLUDED.incoterm_id,
    currency_id = EXCLUDED.currency_id,
    carrier_id = EXCLUDED.carrier_id,
    consignee_id = EXCLUDED.consignee_id,
    origin_port_id = EXCLUDED.origin_port_id,
    destination_port_id = EXCLUDED.destination_port_id,
    account_id = EXCLUDED.account_id,
    contact_id = EXCLUDED.contact_id,
    opportunity_id = EXCLUDED.opportunity_id,
    status = EXCLUDED.status,
    valid_until = EXCLUDED.valid_until,
    pickup_date = EXCLUDED.pickup_date,
    delivery_deadline = EXCLUDED.delivery_deadline,
    vehicle_type = EXCLUDED.vehicle_type,
    special_handling = EXCLUDED.special_handling,
    tax_percent = EXCLUDED.tax_percent,
    shipping_amount = EXCLUDED.shipping_amount,
    terms_conditions = EXCLUDED.terms_conditions,
    notes = EXCLUDED.notes,
    billing_address = EXCLUDED.billing_address,
    shipping_address = EXCLUDED.shipping_address,
    tenant_id = EXCLUDED.tenant_id,
    franchise_id = EXCLUDED.franchise_id,
    regulatory_data = EXCLUDED.regulatory_data,
    updated_at = now()
  RETURNING id INTO v_quote_id;

  -- Items
  DELETE FROM logistics.quote_items_extension 
  WHERE quote_item_id IN (
    SELECT id FROM public.quote_items_core WHERE quote_id = v_quote_id
  );
  DELETE FROM public.quote_items_core WHERE quote_id = v_quote_id;
  
  IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
      v_item_id := gen_random_uuid();
      
      -- Core
      INSERT INTO public.quote_items_core (
        id, quote_id, tenant_id, franchise_id,
        line_number, product_name, description,
        commodity_id, aes_hts_id,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total,
        created_at, updated_at
      ) VALUES (
        v_item_id, v_quote_id, v_tenant_id, v_franchise_id,
        (v_item ->> 'line_number')::int,
        v_item ->> 'product_name',
        v_item ->> 'description',
        (v_item ->> 'commodity_id')::uuid,
        (v_item ->> 'aes_hts_id')::uuid,
        (v_item ->> 'quantity')::numeric,
        (v_item ->> 'unit_price')::numeric,
        (v_item ->> 'discount_percent')::numeric,
        (v_item ->> 'discount_amount')::numeric,
        COALESCE((v_item ->> 'tax_percent')::numeric, 0),
        COALESCE((v_item ->> 'tax_amount')::numeric, 0),
        (v_item ->> 'line_total')::numeric,
        now(), now()
      );
      
      -- Extension
      INSERT INTO logistics.quote_items_extension (
        quote_item_id, tenant_id, franchise_id,
        package_category_id, package_size_id,
        weight_kg, volume_cbm, attributes,
        type, container_type_id, container_size_id
      ) VALUES (
        v_item_id, v_tenant_id, v_franchise_id,
        (v_item ->> 'package_category_id')::uuid,
        (v_item ->> 'package_size_id')::uuid,
        (v_item ->> 'weight_kg')::numeric,
        (v_item ->> 'volume_cbm')::numeric,
        COALESCE(v_item -> 'attributes', '{}'::jsonb),
        v_item ->> 'type',
        (v_item ->> 'container_type_id')::uuid,
        (v_item ->> 'container_size_id')::uuid
      );
    END LOOP;
  END IF;

  -- Cargo Configs
  DELETE FROM quote_cargo_configurations WHERE quote_id = v_quote_id;
  IF v_cargo IS NOT NULL AND jsonb_array_length(v_cargo) > 0 THEN
    FOR v_conf IN SELECT * FROM jsonb_array_elements(v_cargo)
    LOOP
      INSERT INTO quote_cargo_configurations (
        quote_id, tenant_id, transport_mode, cargo_type,
        container_type, container_size, container_type_id, container_size_id,
        quantity, unit_weight_kg, unit_volume_cbm,
        length_cm, width_cm, height_cm,
        is_hazardous, hazardous_class, un_number,
        is_temperature_controlled, temperature_min, temperature_max, temperature_unit,
        package_category_id, package_size_id, remarks
      ) VALUES (
        v_quote_id,
        v_tenant_id,
        v_conf ->> 'transport_mode',
        v_conf ->> 'cargo_type',
        v_conf ->> 'container_type',
        v_conf ->> 'container_size',
        (v_conf ->> 'container_type_id')::uuid,
        (v_conf ->> 'container_size_id')::uuid,
        (v_conf ->> 'quantity')::int,
        (v_conf ->> 'unit_weight_kg')::numeric,
        (v_conf ->> 'unit_volume_cbm')::numeric,
        (v_conf ->> 'length_cm')::numeric,
        (v_conf ->> 'width_cm')::numeric,
        (v_conf ->> 'height_cm')::numeric,
        COALESCE((v_conf ->> 'is_hazardous')::boolean, false),
        v_conf ->> 'hazardous_class',
        v_conf ->> 'un_number',
        COALESCE((v_conf ->> 'is_temperature_controlled')::boolean, false),
        (v_conf ->> 'temperature_min')::numeric,
        (v_conf ->> 'temperature_max')::numeric,
        v_conf ->> 'temperature_unit',
        (v_conf ->> 'package_category_id')::uuid,
        (v_conf ->> 'package_size_id')::uuid,
        v_conf ->> 'remarks'
      );
    END LOOP;
  END IF;

  -- Resolve active quotation version
  SELECT id
  INTO v_version_id
  FROM quotation_versions
  WHERE quote_id = v_quote_id
  ORDER BY version_number DESC
  LIMIT 1;

  -- Create version if not exists
  IF v_version_id IS NULL THEN
    v_version_id := gen_random_uuid();
    INSERT INTO quotation_versions (
      id, tenant_id, quote_id, version_number, major, minor, 
      status, is_active, is_current, created_at, updated_at, kind
    ) VALUES (
      v_version_id, v_tenant_id, v_quote_id, 1, 1, 0, 
      'draft', true, true, now(), now(), 'major'
    );
    
    UPDATE quotes 
    SET current_version_id = v_version_id 
    WHERE id = v_quote_id;
  END IF;

  SELECT id INTO v_sell_side_id FROM charge_sides WHERE lower(code) IN ('sell', 'revenue') LIMIT 1;
  IF v_sell_side_id IS NULL THEN RAISE EXCEPTION 'save_quote_atomic: no sell-side entry found'; END IF;

  SELECT id INTO v_buy_side_id FROM charge_sides WHERE lower(code) IN ('buy', 'cost') LIMIT 1;
  IF v_buy_side_id IS NULL THEN RAISE EXCEPTION 'save_quote_atomic: no buy-side entry found'; END IF;

  -- Options & Legs Updates / Inserts
  IF v_options IS NOT NULL AND jsonb_array_length(v_options) > 0 THEN
    FOR v_opt IN SELECT * FROM jsonb_array_elements(v_options)
    LOOP
      v_option_id := NULL;
      IF (v_opt ->> 'id') IS NOT NULL AND (v_opt ->> 'id') != '' THEN
         v_option_id := (v_opt ->> 'id')::uuid;
      END IF;

      v_option_total_amount := COALESCE((v_opt ->> 'total_amount')::numeric, 0);

      IF v_option_id IS NOT NULL THEN
        -- UPDATE existing option
        UPDATE quotation_version_options
        SET 
          is_selected = COALESCE((v_opt ->> 'is_selected')::boolean, false),
          total_amount = v_option_total_amount,
          currency = COALESCE(v_opt ->> 'currency', currency),
          total_transit_days = COALESCE((v_opt ->> 'transit_time_days')::integer, total_transit_days),
          updated_at = now()
        WHERE id = v_option_id;
      ELSE
        -- INSERT new option
        v_option_id := gen_random_uuid();
        INSERT INTO quotation_version_options (
          id, quotation_version_id, tenant_id, franchise_id,
          option_name, is_selected, total_amount, currency,
          total_transit_days, created_by,
          source, source_attribution, is_recommended, recommendation_reason,
          rank_score, rank_details,
          created_at, updated_at
        ) VALUES (
          v_option_id, v_version_id, v_tenant_id, v_franchise_id,
          COALESCE(v_opt ->> 'option_name', 'Option'),
          COALESCE((v_opt ->> 'is_selected')::boolean, false),
          v_option_total_amount,
          COALESCE(v_opt ->> 'currency', 'USD'),
          COALESCE((v_opt ->> 'transit_time_days')::integer, 0),
          auth.uid(),
          v_opt ->> 'source',
          v_opt ->> 'source_attribution',
          COALESCE((v_opt ->> 'is_recommended')::boolean, false),
          v_opt ->> 'recommendation_reason',
          COALESCE((v_opt ->> 'rank_score')::numeric, 0),
          COALESCE(v_opt -> 'rank_details', '{}'::jsonb),
          now(), now()
        );
      END IF;

      -- Process Legs (Common for both Insert and Update)
      IF (v_opt -> 'legs') IS NOT NULL AND jsonb_array_length(v_opt -> 'legs') > 0 THEN
        v_sort_order := 0;
        FOR v_leg IN SELECT * FROM jsonb_array_elements(v_opt -> 'legs')
        LOOP
          v_sort_order := v_sort_order + 1;
          
          v_leg_id := NULL;
          IF (v_leg ->> 'id') IS NOT NULL AND (v_leg ->> 'id') != '' THEN
             v_leg_id := (v_leg ->> 'id')::uuid;
          END IF;

          IF v_leg_id IS NOT NULL THEN
             -- Update existing leg
             UPDATE quotation_version_option_legs
             SET 
               sort_order = v_sort_order,
               transport_mode = v_leg ->> 'transport_mode',
               origin_location_id = (v_leg ->> 'origin_location_id')::uuid,
               destination_location_id = (v_leg ->> 'destination_location_id')::uuid,
               carrier_id = (v_leg ->> 'carrier_id')::uuid,
               transit_time_hours = ((v_leg ->> 'transit_time_days')::numeric * 24)::int,
               departure_date = (v_leg ->> 'start_date')::timestamp with time zone,
               arrival_date = (v_leg ->> 'end_date')::timestamp with time zone,
               updated_at = now()
             WHERE id = v_leg_id;
          ELSE
             -- Insert new leg
             v_leg_id := gen_random_uuid();
             INSERT INTO quotation_version_option_legs (
               id, quotation_version_option_id, tenant_id, sort_order,
               transport_mode, origin_location_id, destination_location_id,
               carrier_id, transit_time_hours, departure_date, arrival_date,
               created_at, updated_at
             ) VALUES (
               v_leg_id, v_option_id, v_tenant_id, v_sort_order,
               v_leg ->> 'transport_mode',
               (v_leg ->> 'origin_location_id')::uuid,
               (v_leg ->> 'destination_location_id')::uuid,
               (v_leg ->> 'carrier_id')::uuid,
               ((v_leg ->> 'transit_time_days')::numeric * 24)::int,
               (v_leg ->> 'start_date')::timestamp with time zone,
               (v_leg ->> 'end_date')::timestamp with time zone,
               now(), now()
             );
          END IF;

          -- Charges (Delete and Re-insert strategy is safest)
          DELETE FROM quote_charges WHERE leg_id = v_leg_id;

          IF (v_leg -> 'charges') IS NOT NULL AND jsonb_array_length(v_leg -> 'charges') > 0 THEN
             v_charge_sort := 0;
             FOR v_charge IN SELECT * FROM jsonb_array_elements(v_leg -> 'charges')
             LOOP
               v_charge_sort := v_charge_sort + 1;
               
               v_basis_code := v_charge ->> 'basis';
               v_currency_code := v_charge ->> 'currency';
               
               SELECT id INTO v_basis_id FROM charge_basis_types WHERE code = v_basis_code LIMIT 1;
               SELECT id INTO v_currency_id FROM currencies WHERE code = v_currency_code LIMIT 1;

               v_quantity := (v_charge ->> 'quantity')::numeric;
               v_rate := (v_charge ->> 'unit_price')::numeric; 
               v_amount := (v_charge ->> 'amount')::numeric;
               
               v_charge_side := v_charge ->> 'side';
               IF lower(v_charge_side) = 'sell' THEN
                  v_charge_side_id := v_sell_side_id;
               ELSE
                  v_charge_side_id := v_buy_side_id;
               END IF;

               INSERT INTO quote_charges (
                 leg_id, quote_option_id, tenant_id, category_id, note,
                 basis_id, currency_id, quantity, rate, amount,
                 charge_side_id, created_at, updated_at
               ) VALUES (
                 v_leg_id, v_option_id, v_tenant_id,
                 (v_charge ->> 'charge_code')::uuid, 
                 v_charge ->> 'note',
                 v_basis_id,
                 v_currency_id,
                 v_quantity,
                 v_rate,
                 v_amount,
                 v_charge_side_id,
                 now(), now()
               );
             END LOOP;
          END IF;
        END LOOP;
      END IF;

    END LOOP;
  END IF;

  RETURN v_quote_id;
END;
$$;
