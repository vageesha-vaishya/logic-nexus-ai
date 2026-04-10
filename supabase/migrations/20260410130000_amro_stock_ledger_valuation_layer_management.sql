BEGIN;

CREATE OR REPLACE FUNCTION public.amro_stock_ledger_post_transaction(
  p_tenant_id uuid,
  p_franchise_id uuid,
  p_user_id uuid,
  p_part_inventory_id uuid,
  p_movement_type text,
  p_quantity_delta numeric,
  p_unit_cost numeric,
  p_currency text,
  p_effective_at timestamptz,
  p_source_module text,
  p_source_reference text,
  p_notes text,
  p_metadata jsonb,
  p_valuation_method text,
  p_idempotency_key text
)
RETURNS public.amro_stock_ledger_transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inventory public.parts_inventory%ROWTYPE;
  v_existing public.amro_stock_ledger_transactions%ROWTYPE;
  v_result public.amro_stock_ledger_transactions%ROWTYPE;
  v_on_hand numeric(18,6);
  v_reserved numeric(18,6);
  v_available numeric(18,6);
  v_layer record;
  v_remaining numeric(18,6);
  v_consumed numeric(18,6);
  v_actual_unit_cost numeric(18,6);
  v_total_value numeric(18,6);
  v_total_qty numeric(18,6);
BEGIN
  IF p_quantity_delta = 0 THEN
    RAISE EXCEPTION 'quantity_delta cannot be zero';
  END IF;

  IF p_movement_type NOT IN ('receipt','issue','consume','reserve','release','adjustment','transfer_in','transfer_out','return') THEN
    RAISE EXCEPTION 'Invalid movement_type: %', p_movement_type;
  END IF;

  IF p_idempotency_key IS NOT NULL AND btrim(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing
    FROM public.amro_stock_ledger_transactions
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT * INTO v_inventory
  FROM public.parts_inventory
  WHERE tenant_id = p_tenant_id
    AND id = p_part_inventory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid SKU / part_inventory_id: %', p_part_inventory_id;
  END IF;

  v_on_hand := COALESCE(v_inventory.quantity_on_hand, 0);
  v_reserved := COALESCE(v_inventory.quantity_reserved, 0);

  IF p_movement_type = 'reserve' THEN
    v_reserved := v_reserved + p_quantity_delta;
  ELSIF p_movement_type = 'release' THEN
    v_reserved := v_reserved - ABS(p_quantity_delta);
  ELSE
    v_on_hand := v_on_hand + p_quantity_delta;
  END IF;

  v_available := v_on_hand - v_reserved;

  IF v_on_hand < 0 OR v_reserved < 0 OR v_available < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for transaction: on_hand=%, reserved=%, available=%', v_on_hand, v_reserved, v_available;
  END IF;

  UPDATE public.parts_inventory
  SET quantity_on_hand = v_on_hand,
      quantity_reserved = v_reserved,
      quantity_available = v_available,
      updated_at = now()
  WHERE id = v_inventory.id
    AND tenant_id = p_tenant_id;

  -- Handle valuation layers for inbound movements
  IF p_movement_type IN ('receipt', 'transfer_in', 'return') AND p_quantity_delta > 0 THEN
    INSERT INTO public.amro_stock_valuation_layers (
      tenant_id, franchise_id, part_inventory_id, valuation_method,
      inbound_transaction_id, available_quantity, unit_cost,
      consumed_quantity, received_at, metadata, created_by
    ) VALUES (
      p_tenant_id, p_franchise_id, p_part_inventory_id,
      COALESCE(NULLIF(p_valuation_method, ''), 'weighted_average'),
      NULL, -- will be updated after transaction insert
      p_quantity_delta, GREATEST(COALESCE(p_unit_cost, 0), 0),
      0, COALESCE(p_effective_at, now()),
      COALESCE(p_metadata, '{}'::jsonb), p_user_id
    );
  END IF;

  -- Handle valuation layer consumption for outbound movements
  IF p_movement_type IN ('issue', 'consume', 'transfer_out') AND p_quantity_delta < 0 THEN
    v_remaining := ABS(p_quantity_delta);
    v_actual_unit_cost := 0;
    v_total_value := 0;
    v_total_qty := 0;

    -- Consume layers based on valuation method
    IF p_valuation_method = 'fifo' THEN
      FOR v_layer IN
        SELECT id, available_quantity, unit_cost
        FROM public.amro_stock_valuation_layers
        WHERE tenant_id = p_tenant_id
          AND part_inventory_id = p_part_inventory_id
          AND valuation_method = 'fifo'
          AND available_quantity > 0
        ORDER BY received_at ASC
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_consumed := LEAST(v_remaining, v_layer.available_quantity);
        v_total_value := v_total_value + (v_consumed * v_layer.unit_cost);
        v_total_qty := v_total_qty + v_consumed;

        UPDATE public.amro_stock_valuation_layers
        SET available_quantity = available_quantity - v_consumed,
            consumed_quantity = consumed_quantity + v_consumed,
            updated_at = now()
        WHERE id = v_layer.id;

        INSERT INTO public.amro_stock_valuation_consumptions (
          tenant_id, franchise_id, ledger_transaction_id, valuation_layer_id,
          consumed_quantity, unit_cost, metadata
        ) VALUES (
          p_tenant_id, p_franchise_id, NULL, v_layer.id,
          v_consumed, v_layer.unit_cost,
          COALESCE(p_metadata, '{}'::jsonb)
        );

        v_remaining := v_remaining - v_consumed;
      END LOOP;
    ELSIF p_valuation_method = 'lifo' THEN
      FOR v_layer IN
        SELECT id, available_quantity, unit_cost
        FROM public.amro_stock_valuation_layers
        WHERE tenant_id = p_tenant_id
          AND part_inventory_id = p_part_inventory_id
          AND valuation_method = 'lifo'
          AND available_quantity > 0
        ORDER BY received_at DESC
      LOOP
        EXIT WHEN v_remaining <= 0;
        v_consumed := LEAST(v_remaining, v_layer.available_quantity);
        v_total_value := v_total_value + (v_consumed * v_layer.unit_cost);
        v_total_qty := v_total_qty + v_consumed;

        UPDATE public.amro_stock_valuation_layers
        SET available_quantity = available_quantity - v_consumed,
            consumed_quantity = consumed_quantity + v_consumed,
            updated_at = now()
        WHERE id = v_layer.id;

        INSERT INTO public.amro_stock_valuation_consumptions (
          tenant_id, franchise_id, ledger_transaction_id, valuation_layer_id,
          consumed_quantity, unit_cost, metadata
        ) VALUES (
          p_tenant_id, p_franchise_id, NULL, v_layer.id,
          v_consumed, v_layer.unit_cost,
          COALESCE(p_metadata, '{}'::jsonb)
        );

        v_remaining := v_remaining - v_consumed;
      END LOOP;
    ELSE
      -- Weighted average: recalculate across all layers
      SELECT COALESCE(SUM(available_quantity * unit_cost), 0),
             COALESCE(SUM(available_quantity), 0)
      INTO v_total_value, v_total_qty
      FROM public.amro_stock_valuation_layers
      WHERE tenant_id = p_tenant_id
        AND part_inventory_id = p_part_inventory_id
        AND valuation_method = 'weighted_average'
        AND available_quantity > 0;

      IF v_total_qty > 0 THEN
        v_actual_unit_cost := v_total_value / v_total_qty;
      ELSE
        v_actual_unit_cost := COALESCE(p_unit_cost, 0);
      END IF;

      -- Consume proportionally from all weighted_average layers
      FOR v_layer IN
        SELECT id, available_quantity, unit_cost
        FROM public.amro_stock_valuation_layers
        WHERE tenant_id = p_tenant_id
          AND part_inventory_id = p_part_inventory_id
          AND valuation_method = 'weighted_average'
          AND available_quantity > 0
      LOOP
        IF v_remaining <= 0 THEN
          EXIT;
        END IF;
        IF v_total_qty > 0 THEN
          v_consumed := v_remaining * (v_layer.available_quantity / v_total_qty);
          v_consumed := LEAST(v_consumed, v_layer.available_quantity);
          v_consumed := LEAST(v_consumed, v_remaining);
        ELSE
          v_consumed := 0;
        END IF;

        IF v_consumed > 0 THEN
          UPDATE public.amro_stock_valuation_layers
          SET available_quantity = available_quantity - v_consumed,
              consumed_quantity = consumed_quantity + v_consumed,
              updated_at = now()
          WHERE id = v_layer.id;

          INSERT INTO public.amro_stock_valuation_consumptions (
            tenant_id, franchise_id, ledger_transaction_id, valuation_layer_id,
            consumed_quantity, unit_cost, metadata
          ) VALUES (
            p_tenant_id, p_franchise_id, NULL, v_layer.id,
            v_consumed, v_layer.unit_cost,
            COALESCE(p_metadata, '{}'::jsonb)
          );

          v_remaining := v_remaining - v_consumed;
        END IF;
      END LOOP;
    END IF;

    IF v_remaining > 0 THEN
      RAISE WARNING 'Not enough valuation layers to cover consumption: remaining=%', v_remaining;
    END IF;
  END IF;

  -- Calculate actual unit cost for outbound movements
  IF p_movement_type IN ('issue', 'consume', 'transfer_out') THEN
    IF p_valuation_method = 'weighted_average' THEN
      v_actual_unit_cost := COALESCE(v_actual_unit_cost, COALESCE(p_unit_cost, 0));
    ELSE
      IF v_total_qty > 0 THEN
        v_actual_unit_cost := v_total_value / v_total_qty;
      ELSE
        v_actual_unit_cost := COALESCE(p_unit_cost, 0);
      END IF;
    END IF;
  ELSE
    v_actual_unit_cost := GREATEST(COALESCE(p_unit_cost, 0), 0);
  END IF;

  INSERT INTO public.amro_stock_ledger_transactions (
    tenant_id, franchise_id, part_inventory_id, movement_type, valuation_method,
    quantity_delta, balance_after, unit_cost, currency, effective_at,
    source_module, source_reference, notes, metadata, created_by, updated_by,
    idempotency_key
  ) VALUES (
    p_tenant_id, p_franchise_id, p_part_inventory_id, p_movement_type,
    COALESCE(NULLIF(p_valuation_method, ''), 'weighted_average'),
    p_quantity_delta, v_available, v_actual_unit_cost,
    COALESCE(NULLIF(p_currency, ''), 'USD'),
    COALESCE(p_effective_at, now()), p_source_module, p_source_reference,
    p_notes, COALESCE(p_metadata, '{}'::jsonb), p_user_id, p_user_id,
    NULLIF(btrim(COALESCE(p_idempotency_key, '')), '')
  )
  RETURNING * INTO v_result;

  -- Update inbound layer with transaction ID
  IF p_movement_type IN ('receipt', 'transfer_in', 'return') AND p_quantity_delta > 0 THEN
    UPDATE public.amro_stock_valuation_layers
    SET inbound_transaction_id = v_result.id
    WHERE id = (
      SELECT v.id
      FROM public.amro_stock_valuation_layers v
      WHERE v.tenant_id = p_tenant_id
        AND v.part_inventory_id = p_part_inventory_id
        AND v.inbound_transaction_id IS NULL
        AND v.available_quantity = p_quantity_delta
        AND v.unit_cost = v_actual_unit_cost
      ORDER BY v.created_at DESC
      LIMIT 1
    );
  END IF;

  -- Update consumption records with actual transaction ID
  IF p_movement_type IN ('issue', 'consume', 'transfer_out') THEN
    UPDATE public.amro_stock_valuation_consumptions
    SET ledger_transaction_id = v_result.id
    WHERE tenant_id = p_tenant_id
      AND ledger_transaction_id IS NULL
      AND valuation_layer_id IN (
        SELECT id FROM public.amro_stock_valuation_layers
        WHERE tenant_id = p_tenant_id
          AND part_inventory_id = p_part_inventory_id
      )
      AND created_at >= now() - interval '10 seconds';
  END IF;

  INSERT INTO public.amro_stock_audit_timeline (
    tenant_id, franchise_id, actor_user_id, event_type, event_category, reference_id,
    event_payload, immutable_hash
  ) VALUES (
    p_tenant_id, p_franchise_id, p_user_id, 'stock_ledger.transaction.posted',
    'stock-ledger', v_result.id::text,
    jsonb_build_object(
      'movement_type', v_result.movement_type,
      'quantity_delta', v_result.quantity_delta,
      'part_inventory_id', v_result.part_inventory_id,
      'idempotency_key', v_result.idempotency_key
    ),
    encode(digest(
      concat_ws('|', p_tenant_id::text, v_result.id::text, v_result.movement_type, v_result.quantity_delta::text, now()::text),
      'sha256'
    ), 'hex')
  );

  RETURN v_result;
END;
$$;

COMMIT;
