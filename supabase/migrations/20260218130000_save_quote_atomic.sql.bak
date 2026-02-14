CREATE OR REPLACE FUNCTION save_quote_atomic(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
  v_tenant_id uuid;
  v_quote_data jsonb;
  v_items jsonb;
  v_cargo jsonb;
  v_options jsonb;
  v_item jsonb;
  v_conf jsonb;
  v_opt jsonb;
  v_leg jsonb;
BEGIN
  v_quote_data := p_payload -> 'quote';
  v_items := p_payload -> 'items';
  v_cargo := p_payload -> 'cargo_configurations';
  v_options := p_payload -> 'options';
  
  -- Extract ID if exists, or generate new one if not provided (though usually provided by client or null)
  v_quote_id := (v_quote_data ->> 'id')::uuid;
  v_tenant_id := (v_quote_data ->> 'tenant_id')::uuid;

  -- Upsert Quote
  INSERT INTO quotes (
    id, title, description, service_type_id, service_id, incoterms, 
    carrier_id, consignee_id, origin_port_id, destination_port_id, 
    account_id, contact_id, opportunity_id, status, valid_until, 
    pickup_date, delivery_deadline, vehicle_type, special_handling, 
    tax_percent, shipping_amount, terms_conditions, notes, 
    billing_address, shipping_address, tenant_id, regulatory_data,
    created_at, updated_at
  )
  VALUES (
    COALESCE(v_quote_id, gen_random_uuid()),
    v_quote_data ->> 'title',
    v_quote_data ->> 'description',
    (v_quote_data ->> 'service_type_id')::uuid,
    (v_quote_data ->> 'service_id')::uuid,
    v_quote_data ->> 'incoterms',
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
    COALESCE(v_quote_data -> 'regulatory_data', '{}'::jsonb),
    COALESCE((v_quote_data ->> 'created_at')::timestamptz, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    service_type_id = EXCLUDED.service_type_id,
    service_id = EXCLUDED.service_id,
    incoterms = EXCLUDED.incoterms,
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
    regulatory_data = EXCLUDED.regulatory_data,
    updated_at = now()
  RETURNING id INTO v_quote_id;

  -- Items
  DELETE FROM quote_items WHERE quote_id = v_quote_id;
  IF v_items IS NOT NULL AND jsonb_array_length(v_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
      INSERT INTO quote_items (
        quote_id, line_number, type, container_type_id, container_size_id,
        product_name, commodity_id, aes_hts_id, description, quantity,
        unit_price, discount_percent, discount_amount, line_total,
        package_category_id, package_size_id, weight_kg, volume_cbm, attributes
      ) VALUES (
        v_quote_id,
        (v_item ->> 'line_number')::int,
        v_item ->> 'type',
        (v_item ->> 'container_type_id')::uuid,
        (v_item ->> 'container_size_id')::uuid,
        v_item ->> 'product_name',
        (v_item ->> 'commodity_id')::uuid,
        (v_item ->> 'aes_hts_id')::uuid,
        v_item ->> 'description',
        (v_item ->> 'quantity')::numeric,
        (v_item ->> 'unit_price')::numeric,
        (v_item ->> 'discount_percent')::numeric,
        (v_item ->> 'discount_amount')::numeric,
        (v_item ->> 'line_total')::numeric,
        (v_item ->> 'package_category_id')::uuid,
        (v_item ->> 'package_size_id')::uuid,
        (v_item ->> 'weight_kg')::numeric,
        (v_item ->> 'volume_cbm')::numeric,
        COALESCE(v_item -> 'attributes', '{}'::jsonb)
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

  -- Options & Legs Updates
  IF v_options IS NOT NULL AND jsonb_array_length(v_options) > 0 THEN
    FOR v_opt IN SELECT * FROM jsonb_array_elements(v_options)
    LOOP
      IF (v_opt ->> 'id') IS NOT NULL THEN
        -- Update Option Selection
        UPDATE quotation_version_options
        SET is_selected = COALESCE((v_opt ->> 'is_selected')::boolean, false)
        WHERE id = (v_opt ->> 'id')::uuid;

        -- Update Legs
        IF (v_opt -> 'legs') IS NOT NULL AND jsonb_array_length(v_opt -> 'legs') > 0 THEN
          FOR v_leg IN SELECT * FROM jsonb_array_elements(v_opt -> 'legs')
          LOOP
            IF (v_leg ->> 'id') IS NOT NULL THEN
              UPDATE quotation_version_option_legs
              SET
                provider_id = (v_leg ->> 'carrier_id')::uuid,
                carrier_id = (v_leg ->> 'carrier_id')::uuid,
                mode = v_leg ->> 'transport_mode',
                origin_location = v_leg ->> 'origin_location_name',
                destination_location = v_leg ->> 'destination_location_name',
                origin_location_id = (v_leg ->> 'origin_location_id')::uuid,
                destination_location_id = (v_leg ->> 'destination_location_id')::uuid,
                transit_time_hours = (v_leg ->> 'transit_time_hours')::int,
                flight_number = v_leg ->> 'flight_number',
                voyage_number = v_leg ->> 'voyage_number',
                departure_date = (v_leg ->> 'departure_date')::timestamptz,
                arrival_date = (v_leg ->> 'arrival_date')::timestamptz
              WHERE id = (v_leg ->> 'id')::uuid;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN v_quote_id;
END;
$$;
