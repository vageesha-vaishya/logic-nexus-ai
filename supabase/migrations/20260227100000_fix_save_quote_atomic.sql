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
  v_basis_id uuid;
  v_currency_id uuid;
  v_basis_code text;
  v_currency_code text;
  v_quantity numeric;
  v_rate numeric;
  v_amount numeric;
  v_charge_sort integer;
  v_option_total_amount numeric;
  v_payload_leg_ids uuid[];
  v_buy_side_id uuid;
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
  -- FIX: Delete from tables directly instead of view to avoid trigger issues
  DELETE FROM logistics.quote_items_extension 
  WHERE quote_item_id IN (
    SELECT id FROM public.quote_items_core WHERE quote_id = v_quote_id
  );
  DELETE FROM public.quote_items_core WHERE quote_id = v_quote_id;
  
  -- Insert Items directly to tables to avoid view issues
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

  -- Resolve active quotation version for this quote (latest by version_number)
  SELECT id
  INTO v_version_id
  FROM quotation_versions
  WHERE quote_id = v_quote_id
  ORDER BY version_number DESC
  LIMIT 1;

  -- Create version if not exists (Fix for new quotes)
  IF v_version_id IS NULL THEN
    v_version_id := gen_random_uuid();
    INSERT INTO quotation_versions (
      id, tenant_id, quote_id, version_number, major, minor, 
      status, is_active, is_current, created_at, updated_at
    ) VALUES (
      v_version_id, v_tenant_id, v_quote_id, 1, 1, 0, 
      'draft', true, true, now(), now()
    );
    
    -- Update quote with current version
    UPDATE quotes 
    SET current_version_id = v_version_id 
    WHERE id = v_quote_id;
  END IF;

  SELECT id
  INTO v_sell_side_id
  FROM charge_sides
  WHERE lower(code) IN ('sell', 'revenue')
  LIMIT 1;

  IF v_sell_side_id IS NULL THEN
    RAISE EXCEPTION 'save_quote_atomic: no sell-side entry found in charge_sides';
  END IF;

  SELECT id
  INTO v_buy_side_id
  FROM charge_sides
  WHERE lower(code) IN ('buy', 'cost')
  LIMIT 1;

  IF v_buy_side_id IS NULL THEN
    RAISE EXCEPTION 'save_quote_atomic: no buy-side entry found in charge_sides';
  END IF;

  -- Options & Legs Updates / Inserts
  IF v_options IS NOT NULL AND jsonb_array_length(v_options) > 0 THEN
    FOR v_opt IN SELECT * FROM jsonb_array_elements(v_options)
    LOOP
      IF (v_opt ->> 'id') IS NOT NULL THEN
        v_option_id := (v_opt ->> 'id')::uuid;
        v_option_total_amount := COALESCE((v_opt ->> 'total_amount')::numeric, NULL);

        UPDATE quotation_version_options
        SET 
          is_selected = COALESCE((v_opt ->> 'is_selected')::boolean, false),
          total_amount = COALESCE((v_opt ->> 'total_amount')::numeric, total_amount),
          currency = COALESCE(v_opt ->> 'currency', currency),
          total_transit_days = COALESCE((v_opt ->> 'transit_time_days')::integer, total_transit_days)
        WHERE id = v_option_id;

        -- Build list of leg ids present in payload for this option
        v_payload_leg_ids := ARRAY[]::uuid[];

        IF (v_opt -> 'legs') IS NOT NULL AND jsonb_array_length(v_opt -> 'legs') > 0 THEN
          FOR v_leg IN SELECT * FROM jsonb_array_elements(v_opt -> 'legs')
          LOOP
            IF (v_leg ->> 'id') IS NOT NULL THEN
              v_payload_leg_ids := array_append(v_payload_leg_ids, (v_leg ->> 'id')::uuid);
            END IF;
          END LOOP;
        END IF;

        -- Delete legs that are no longer present in payload (and their charges)
        DELETE FROM quote_charges
        WHERE quote_option_id = v_option_id
          AND leg_id IN (
            SELECT id
            FROM quotation_version_option_legs
            WHERE quotation_version_option_id = v_option_id
              AND (v_payload_leg_ids IS NULL OR id <> ALL (v_payload_leg_ids))
          );

        DELETE FROM quotation_version_option_legs
        WHERE quotation_version_option_id = v_option_id
          AND (v_payload_leg_ids IS NULL OR id <> ALL (v_payload_leg_ids));

        -- Upsert legs and their charges from payload
        IF (v_opt -> 'legs') IS NOT NULL AND jsonb_array_length(v_opt -> 'legs') > 0 THEN
          v_sort_order := 0;
          FOR v_leg IN SELECT * FROM jsonb_array_elements(v_opt -> 'legs')
          LOOP
            v_sort_order := v_sort_order + 1;

            IF (v_leg ->> 'id') IS NOT NULL THEN
              v_leg_id := (v_leg ->> 'id')::uuid;

              UPDATE quotation_version_option_legs
              SET
                sort_order = v_sort_order,
                provider_id = NULLIF(v_leg ->> 'carrier_id', '')::uuid,
                carrier_id = NULLIF(v_leg ->> 'carrier_id', '')::uuid,
                carrier_name = v_leg ->> 'carrier_name',
                origin_location = v_leg ->> 'origin_location_name',
                destination_location = v_leg ->> 'destination_location_name',
                transport_mode = v_leg ->> 'transport_mode',
                transit_time = v_leg ->> 'transit_time',
                total_amount = COALESCE((v_leg ->> 'total_amount')::numeric, total_amount),
                currency = COALESCE(v_leg ->> 'currency', currency),
                transit_time_hours = COALESCE((v_leg ->> 'transit_time_hours')::integer, transit_time_hours),
                flight_number = v_leg ->> 'flight_number',
                voyage_number = v_leg ->> 'voyage_number',
                departure_date = (v_leg ->> 'departure_date')::timestamptz,
                arrival_date = (v_leg ->> 'arrival_date')::timestamptz
              WHERE id = v_leg_id;
            ELSE
              v_leg_id := gen_random_uuid();

              INSERT INTO quotation_version_option_legs (
                id,
                quotation_version_option_id,
                tenant_id,
                franchise_id,
                sort_order,
                provider_id,
                carrier_id,
                carrier_name,
                origin_location,
                destination_location,
                transport_mode,
                transit_time_hours,
                flight_number,
                voyage_number,
                departure_date,
                arrival_date
              ) VALUES (
                v_leg_id,
                v_option_id,
                v_tenant_id,
                v_franchise_id,
                v_sort_order,
                NULLIF(v_leg ->> 'carrier_id', '')::uuid,
                NULLIF(v_leg ->> 'carrier_id', '')::uuid,
                v_leg ->> 'carrier_name',
                v_leg ->> 'origin_location_name',
                v_leg ->> 'destination_location_name',
                v_leg ->> 'transport_mode',
                (v_leg ->> 'transit_time_hours')::integer,
                v_leg ->> 'flight_number',
                v_leg ->> 'voyage_number',
                (v_leg ->> 'departure_date')::timestamptz,
                (v_leg ->> 'arrival_date')::timestamptz
              );
            END IF;

            -- Replace charges for this leg with payload
            DELETE FROM quote_charges
            WHERE quote_option_id = v_option_id
              AND leg_id = v_leg_id;

            IF (v_leg -> 'charges') IS NOT NULL AND jsonb_array_length(v_leg -> 'charges') > 0 THEN
              v_charge_sort := 0;
              FOR v_charge IN SELECT * FROM jsonb_array_elements(v_leg -> 'charges')
              LOOP
                v_charge_sort := v_charge_sort + 1;

                v_charge_side := coalesce(lower(v_charge ->> 'side'), 'sell');

                IF v_charge_side IN ('buy', 'cost') THEN
                  v_charge_side_id := v_buy_side_id;
                ELSE
                  v_charge_side_id := v_sell_side_id;
                END IF;

                v_basis_code := v_charge ->> 'basis';
                v_basis_id := NULL;
                IF v_basis_code IS NOT NULL AND v_basis_code <> '' THEN
                  SELECT id
                  INTO v_basis_id
                  FROM charge_bases
                  WHERE code = v_basis_code
                    AND tenant_id = v_tenant_id
                  LIMIT 1;

                  IF v_basis_id IS NULL THEN
                    RAISE EXCEPTION 'save_quote_atomic: unknown charge basis code % for tenant %', v_basis_code, v_tenant_id;
                  END IF;
                END IF;

                v_currency_code := v_charge ->> 'currency';
                v_currency_id := NULL;
                IF v_currency_code IS NOT NULL AND v_currency_code <> '' THEN
                  SELECT id
                  INTO v_currency_id
                  FROM currencies
                  WHERE code = v_currency_code
                  LIMIT 1;
                END IF;

                IF v_currency_id IS NULL THEN
                  v_currency_id := (v_quote_data ->> 'currency_id')::uuid;
                END IF;

                v_quantity := COALESCE((v_charge ->> 'quantity')::numeric, 1);
                v_rate := COALESCE((v_charge ->> 'unit_price')::numeric, 0);
                v_amount := v_quantity * v_rate;

                INSERT INTO quote_charges (
                  quote_option_id,
                  leg_id,
                  tenant_id,
                  franchise_id,
                  category_id,
                  basis_id,
                  charge_side_id,
                  currency_id,
                  unit,
                  quantity,
                  rate,
                  amount,
                  sort_order,
                  note
                ) VALUES (
                  v_option_id,
                  v_leg_id,
                  v_tenant_id,
                  v_franchise_id,
                  NULLIF(v_charge ->> 'charge_code', '')::uuid,
                  v_basis_id,
                  v_charge_side_id,
                  v_currency_id,
                  v_charge ->> 'unit',
                  v_quantity,
                  v_rate,
                  v_amount,
                  v_charge_sort,
                  NULLIF(v_charge ->> 'note', '')
                );

                IF v_charge_side NOT IN ('buy', 'cost') THEN
                  IF v_option_total_amount IS NULL THEN
                    v_option_total_amount := 0;
                  END IF;
                  v_option_total_amount := v_option_total_amount + v_amount;
                END IF;
              END LOOP;
            END IF;
          END LOOP;
        END IF;

        DELETE FROM quote_charges
        WHERE quote_option_id = v_option_id
          AND leg_id IS NULL;

        IF (v_opt -> 'combined_charges') IS NOT NULL AND jsonb_array_length(v_opt -> 'combined_charges') > 0 THEN
          v_charge_sort := 0;
          FOR v_charge IN SELECT * FROM jsonb_array_elements(v_opt -> 'combined_charges')
          LOOP
            v_charge_sort := v_charge_sort + 1;

            v_charge_side := coalesce(lower(v_charge ->> 'side'), 'sell');

            IF v_charge_side IN ('buy', 'cost') THEN
              v_charge_side_id := v_buy_side_id;
            ELSE
              v_charge_side_id := v_sell_side_id;
            END IF;

            v_basis_code := v_charge ->> 'basis';
            v_basis_id := NULL;
            IF v_basis_code IS NOT NULL AND v_basis_code <> '' THEN
              SELECT id
              INTO v_basis_id
              FROM charge_bases
              WHERE code = v_basis_code
                AND tenant_id = v_tenant_id
              LIMIT 1;

              IF v_basis_id IS NULL THEN
                RAISE EXCEPTION 'save_quote_atomic: unknown charge basis code % for tenant %', v_basis_code, v_tenant_id;
              END IF;
            END IF;

            v_currency_code := v_charge ->> 'currency';
            v_currency_id := NULL;
            IF v_currency_code IS NOT NULL AND v_currency_code <> '' THEN
              SELECT id
              INTO v_currency_id
              FROM currencies
              WHERE code = v_currency_code
              LIMIT 1;
            END IF;

            IF v_currency_id IS NULL THEN
              v_currency_id := (v_quote_data ->> 'currency_id')::uuid;
            END IF;

            v_quantity := COALESCE((v_charge ->> 'quantity')::numeric, 1);
            v_rate := COALESCE((v_charge ->> 'unit_price')::numeric, 0);
            v_amount := v_quantity * v_rate;

            INSERT INTO quote_charges (
              quote_option_id,
              leg_id,
              tenant_id,
              franchise_id,
              category_id,
              basis_id,
              charge_side_id,
              currency_id,
              unit,
              quantity,
              rate,
              amount,
              sort_order,
              note
            ) VALUES (
              v_option_id,
              NULL,
              v_tenant_id,
              v_franchise_id,
              NULLIF(v_charge ->> 'charge_code', '')::uuid,
              v_basis_id,
              v_charge_side_id,
              v_currency_id,
              v_charge ->> 'unit',
              v_quantity,
              v_rate,
              v_amount,
              v_charge_sort,
              NULLIF(v_charge ->> 'note', '')
            );

            IF v_charge_side NOT IN ('buy', 'cost') THEN
              v_option_total_amount := v_option_total_amount + v_amount;
            END IF;
          END LOOP;
        END IF;

        IF v_option_total_amount IS NOT NULL THEN
          UPDATE quotation_version_options
          SET total_amount = v_option_total_amount
          WHERE id = v_option_id;
        END IF;
      ELSE
        IF v_version_id IS NULL THEN
          RAISE EXCEPTION 'save_quote_atomic: no quotation_versions row found for quote % when inserting option', v_quote_id;
        END IF;

        v_option_id := gen_random_uuid();

        v_option_total_amount := COALESCE((v_opt ->> 'total_amount')::numeric, 0);

        INSERT INTO quotation_version_options (
          id,
          quotation_version_id,
          tenant_id,
          franchise_id,
          is_selected,
          total_amount,
          currency,
          total_transit_days,
          rank_score,
          rank_details,
          is_recommended,
          recommendation_reason,
          created_at,
          updated_at
        ) VALUES (
          v_option_id,
          v_version_id,
          v_tenant_id,
          v_franchise_id,
          COALESCE((v_opt ->> 'is_selected')::boolean, false),
          v_option_total_amount,
          v_opt ->> 'currency',
          (v_opt ->> 'transit_time_days')::integer,
          (v_opt ->> 'rank_score')::numeric,
          (v_opt -> 'rank_details'),
          COALESCE((v_opt ->> 'is_recommended')::boolean, false),
          v_opt ->> 'recommendation_reason',
          now(),
          now()
        );

        IF (v_opt -> 'combined_charges') IS NOT NULL AND jsonb_array_length(v_opt -> 'combined_charges') > 0 THEN
          v_charge_sort := 0;
          FOR v_charge IN SELECT * FROM jsonb_array_elements(v_opt -> 'combined_charges')
          LOOP
            v_charge_sort := v_charge_sort + 1;

            v_charge_side := coalesce(lower(v_charge ->> 'side'), 'sell');

            IF v_charge_side IN ('buy', 'cost') THEN
              v_charge_side_id := v_buy_side_id;
            ELSE
              v_charge_side_id := v_sell_side_id;
            END IF;

            v_basis_code := v_charge ->> 'basis';
            v_basis_id := NULL;
            IF v_basis_code IS NOT NULL AND v_basis_code <> '' THEN
              SELECT id
              INTO v_basis_id
              FROM charge_bases
              WHERE code = v_basis_code
                AND tenant_id = v_tenant_id
              LIMIT 1;

              IF v_basis_id IS NULL THEN
                RAISE EXCEPTION 'save_quote_atomic: unknown charge basis code % for tenant %', v_basis_code, v_tenant_id;
              END IF;
            END IF;

            v_currency_code := v_charge ->> 'currency';
            v_currency_id := NULL;
            IF v_currency_code IS NOT NULL AND v_currency_code <> '' THEN
              SELECT id
              INTO v_currency_id
              FROM currencies
              WHERE code = v_currency_code
              LIMIT 1;
            END IF;

            IF v_currency_id IS NULL THEN
              v_currency_id := (v_quote_data ->> 'currency_id')::uuid;
            END IF;

            v_quantity := COALESCE((v_charge ->> 'quantity')::numeric, 1);
            v_rate := COALESCE((v_charge ->> 'unit_price')::numeric, 0);
            v_amount := v_quantity * v_rate;

            INSERT INTO quote_charges (
              quote_option_id,
              leg_id,
              tenant_id,
              franchise_id,
              category_id,
              basis_id,
              charge_side_id,
              currency_id,
              unit,
              quantity,
              rate,
              amount,
              sort_order,
              note
            ) VALUES (
              v_option_id,
              NULL,
              v_tenant_id,
              v_franchise_id,
              NULLIF(v_charge ->> 'charge_code', '')::uuid,
              v_basis_id,
              v_charge_side_id,
              v_currency_id,
              v_charge ->> 'unit',
              v_quantity,
              v_rate,
              v_amount,
              v_charge_sort,
              NULLIF(v_charge ->> 'note', '')
            );

            IF v_charge_side NOT IN ('buy', 'cost') THEN
              v_option_total_amount := v_option_total_amount + v_amount;
            END IF;
          END LOOP;

          UPDATE quotation_version_options
          SET total_amount = v_option_total_amount
          WHERE id = v_option_id;
        END IF;

        IF (v_opt -> 'legs') IS NOT NULL AND jsonb_array_length(v_opt -> 'legs') > 0 THEN
          v_sort_order := 0;
          FOR v_leg IN SELECT * FROM jsonb_array_elements(v_opt -> 'legs')
          LOOP
            v_sort_order := v_sort_order + 1;
            v_leg_id := gen_random_uuid();

            INSERT INTO quotation_version_option_legs (
              id,
              quotation_version_option_id,
              tenant_id,
              franchise_id,
              sort_order,
              provider_id,
              carrier_id,
              carrier_name,
              origin_location,
              destination_location,
              transport_mode,
              transit_time_hours,
              flight_number,
              voyage_number,
              departure_date,
              arrival_date
            ) VALUES (
              v_leg_id,
              v_option_id,
              v_tenant_id,
              v_franchise_id,
              v_sort_order,
              NULLIF(v_leg ->> 'carrier_id', '')::uuid,
              NULLIF(v_leg ->> 'carrier_id', '')::uuid,
              v_leg ->> 'carrier_name',
              v_leg ->> 'origin_location_name',
              v_leg ->> 'destination_location_name',
              v_leg ->> 'transport_mode',
              (v_leg ->> 'transit_time_hours')::integer,
              v_leg ->> 'flight_number',
              v_leg ->> 'voyage_number',
              (v_leg ->> 'departure_date')::timestamptz,
              (v_leg ->> 'arrival_date')::timestamptz
            );

            IF (v_leg -> 'charges') IS NOT NULL AND jsonb_array_length(v_leg -> 'charges') > 0 THEN
              v_charge_sort := 0;
              FOR v_charge IN SELECT * FROM jsonb_array_elements(v_leg -> 'charges')
              LOOP
                v_charge_sort := v_charge_sort + 1;

                v_charge_side := coalesce(lower(v_charge ->> 'side'), 'sell');

                IF v_charge_side IN ('buy', 'cost') THEN
                  v_charge_side_id := v_buy_side_id;
                ELSE
                  v_charge_side_id := v_sell_side_id;
                END IF;

                v_basis_code := v_charge ->> 'basis';
                v_basis_id := NULL;
                IF v_basis_code IS NOT NULL AND v_basis_code <> '' THEN
                  SELECT id
                  INTO v_basis_id
                  FROM charge_bases
                  WHERE code = v_basis_code
                    AND tenant_id = v_tenant_id
                  LIMIT 1;

                  IF v_basis_id IS NULL THEN
                    RAISE EXCEPTION 'save_quote_atomic: unknown charge basis code % for tenant %', v_basis_code, v_tenant_id;
                  END IF;
                END IF;

                v_currency_code := v_charge ->> 'currency';
                v_currency_id := NULL;
                IF v_currency_code IS NOT NULL AND v_currency_code <> '' THEN
                  SELECT id
                  INTO v_currency_id
                  FROM currencies
                  WHERE code = v_currency_code
                  LIMIT 1;
                END IF;

                IF v_currency_id IS NULL THEN
                  v_currency_id := (v_quote_data ->> 'currency_id')::uuid;
                END IF;

                v_quantity := COALESCE((v_charge ->> 'quantity')::numeric, 1);
                v_rate := COALESCE((v_charge ->> 'unit_price')::numeric, 0);
                v_amount := v_quantity * v_rate;

                INSERT INTO quote_charges (
                  quote_option_id,
                  leg_id,
                  tenant_id,
                  franchise_id,
                  category_id,
                  basis_id,
                  charge_side_id,
                  currency_id,
                  unit,
                  quantity,
                  rate,
                  amount,
                  sort_order,
                  note
                ) VALUES (
                  v_option_id,
                  v_leg_id,
                  v_tenant_id,
                  v_franchise_id,
                  NULLIF(v_charge ->> 'charge_code', '')::uuid,
                  v_basis_id,
                  v_charge_side_id,
                  v_currency_id,
                  v_charge ->> 'unit',
                  v_quantity,
                  v_rate,
                  v_amount,
                  v_charge_sort,
                  NULLIF(v_charge ->> 'note', '')
                );

                v_option_total_amount := v_option_total_amount + v_amount;
              END LOOP;
            END IF;
          END LOOP;

          UPDATE quotation_version_options
          SET total_amount = v_option_total_amount
          WHERE id = v_option_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN v_quote_id;
END $$;
