BEGIN;

-- Ensure 'Customs' charge category exists
INSERT INTO public.charge_categories (name, code, description, is_active)
SELECT 'Customs', 'customs', 'Customs clearance and duty fees', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.charge_categories WHERE code = 'customs'
);

CREATE OR REPLACE FUNCTION public.create_invoice_from_shipment(
  p_shipment_id uuid,
  p_tenant_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shipment RECORD;
  v_quote RECORD;
  v_customer_id uuid;
  v_currency text;
  v_option_id uuid;
  v_sell_side_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal numeric;
  v_duty_category_id uuid;
  v_origin_country text;
  v_destination_country text;
  v_cargo_items jsonb := '[]'::jsonb;
  v_duty_result jsonb;
  v_duty_amount numeric;
  v_cargo_rec RECORD;
  v_hts_code text;
BEGIN
  -- Verify shipment exists and belongs to tenant
  SELECT s.* INTO v_shipment
  FROM public.shipments s
  WHERE s.id = p_shipment_id AND s.tenant_id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment not found or not accessible';
  END IF;

  -- Idempotency: return existing invoice for this shipment if present
  SELECT i.id INTO v_invoice_id
  FROM public.invoices i
  WHERE i.shipment_id = p_shipment_id
    AND i.tenant_id = p_tenant_id
    AND i.status IN ('draft','issued','partial','overdue','paid');
    
  IF FOUND THEN
    RETURN v_invoice_id;
  END IF;

  -- Determine quote and customer
  IF v_shipment.quote_id IS NOT NULL THEN
    SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = v_shipment.quote_id;
    v_customer_id := v_quote.account_id;
    v_currency := COALESCE(v_quote.currency, 'USD');
  ELSE
    v_currency := 'USD';
    v_customer_id := NULL;
  END IF;

  -- Prefer shipment.account_id if available
  IF v_customer_id IS NULL THEN
    BEGIN
      SELECT s.account_id INTO v_customer_id FROM public.shipments s WHERE s.id = p_shipment_id;
    EXCEPTION WHEN undefined_column THEN
      v_customer_id := NULL;
    END;
  END IF;

  -- Determine selected quotation option
  IF v_shipment.quote_id IS NOT NULL THEN
    SELECT cs.quotation_version_option_id INTO v_option_id
    FROM public.customer_selections cs
    WHERE cs.quote_id = v_shipment.quote_id
    ORDER BY cs.selected_at DESC
    LIMIT 1;

    IF v_option_id IS NULL THEN
      SELECT qvo.id INTO v_option_id
      FROM public.quotation_version_options qvo
      JOIN public.quotation_versions qv ON qvo.quotation_version_id = qv.id
      WHERE qv.quote_id = v_shipment.quote_id
      ORDER BY qvo.is_recommended DESC, qvo.created_at DESC
      LIMIT 1;
    END IF;
  END IF;

  -- Get SELL side id (filter charges to customer)
  SELECT id INTO v_sell_side_id FROM public.charge_sides WHERE code = 'sell' LIMIT 1;

  -- Generate invoice number
  v_invoice_number := public.get_next_document_number(p_tenant_id, 'invoice');

  -- Insert invoice shell
  INSERT INTO public.invoices(
    tenant_id, invoice_number, customer_id, shipment_id, status, type,
    issue_date, currency, subtotal, tax_total, total, balance_due
  )
  VALUES (
    p_tenant_id, v_invoice_number, v_customer_id, p_shipment_id, 'issued', 'standard',
    CURRENT_DATE, v_currency, 0, 0, 0, 0
  )
  RETURNING id INTO v_invoice_id;

  -- Insert line items from quote_charges (SELL side)
  IF v_option_id IS NOT NULL THEN
    INSERT INTO public.invoice_line_items(
      invoice_id, description, quantity, unit_price, tax_rate, tax_amount, charge_id, metadata
    )
    SELECT
      v_invoice_id,
      COALESCE(cc.name, 'Charge') || COALESCE(' - ' || qc.note, ''),
      COALESCE(qc.quantity, 1),
      CASE 
        WHEN qc.rate IS NOT NULL THEN qc.rate
        WHEN qc.amount IS NOT NULL AND COALESCE(qc.quantity,1) > 0 THEN qc.amount / COALESCE(qc.quantity,1)
        ELSE 0
      END,
      0,
      0,
      qc.id,
      jsonb_build_object(
        'quote_option_id', qc.quote_option_id,
        'currency_id', qc.currency_id,
        'basis_id', qc.basis_id,
        'category_id', qc.category_id,
        'leg_id', qc.leg_id
      )
    FROM public.quote_charges qc
    LEFT JOIN public.charge_categories cc ON cc.id = qc.category_id
    WHERE qc.quote_option_id = v_option_id
      AND (v_sell_side_id IS NULL OR qc.charge_side_id = v_sell_side_id);
  END IF;

  -- -----------------------------------------------------------------------
  -- Landed Cost / Duty Calculation Integration
  -- -----------------------------------------------------------------------
  
  -- Attempt to extract countries from shipment address JSONB
  -- Assumes structure like { "country": "US", ... } or { "country_code": "US", ... }
  v_origin_country := COALESCE(v_shipment.origin_address->>'country_code', v_shipment.origin_address->>'country');
  v_destination_country := COALESCE(v_shipment.destination_address->>'country_code', v_shipment.destination_address->>'country');
  
  -- Get Customs category ID
  SELECT id INTO v_duty_category_id FROM public.charge_categories WHERE code = 'customs' LIMIT 1;

  -- Collect cargo items for duty calculation
  -- Look for cargo details linked to this shipment
  FOR v_cargo_rec IN 
    SELECT cd.*, hts.hts_code
    FROM public.cargo_details cd
    LEFT JOIN public.aes_hts_codes hts ON hts.id = cd.aes_hts_id
    WHERE cd.service_type = 'shipment' 
      AND cd.service_id = p_shipment_id
      AND cd.is_active = true
  LOOP
    -- Only add if HTS code and value are present
    IF v_cargo_rec.hts_code IS NOT NULL AND v_cargo_rec.value_amount IS NOT NULL AND v_cargo_rec.value_amount > 0 THEN
      v_cargo_items := v_cargo_items || jsonb_build_object(
        'hts_code', v_cargo_rec.hts_code,
        'value', v_cargo_rec.value_amount,
        'quantity', COALESCE(v_cargo_rec.package_count, 1),
        'currency', COALESCE(v_cargo_rec.value_currency, 'USD')
      );
    END IF;
  END LOOP;

  -- If we have items and valid countries, calculate duty
  IF jsonb_array_length(v_cargo_items) > 0 AND v_origin_country IS NOT NULL AND v_destination_country IS NOT NULL THEN
    
    -- Call the duty calculation RPC
    v_duty_result := public.calculate_duty(v_origin_country, v_destination_country, v_cargo_items);
    
    -- Extract total duty
    v_duty_amount := (v_duty_result->>'total_duty')::numeric;
    
    -- If duty applies, add a line item
    IF v_duty_amount > 0 THEN
       INSERT INTO public.invoice_line_items(
        invoice_id, 
        description, 
        quantity, 
        unit_price, 
        tax_rate, 
        tax_amount, 
        metadata
      )
      VALUES (
        v_invoice_id,
        'Import Duties & Taxes (Estimated)',
        1,
        v_duty_amount,
        0,
        0,
        jsonb_build_object(
          'category_id', v_duty_category_id,
          'type', 'duty',
          'calculation_breakdown', v_duty_result->'breakdown'
        )
      );
    END IF;
  END IF;

  -- -----------------------------------------------------------------------

  -- Recalculate totals
  SELECT COALESCE(SUM(amount),0) INTO v_subtotal
  FROM public.invoice_line_items
  WHERE invoice_id = v_invoice_id;

  UPDATE public.invoices
    SET subtotal = v_subtotal,
        tax_total = 0,
        total = v_subtotal,
        balance_due = v_subtotal,
        updated_at = now()
    WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$;

COMMIT;
