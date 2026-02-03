-- Enhance Landed Cost Engine with US Import Fees (MPF, HMF)
-- Date: 2026-02-07
-- Description: Updates calculate_duty RPC to include Merchandise Processing Fee (MPF) and Harbor Maintenance Fee (HMF) for US imports.

BEGIN;

-- Update calculate_duty signature to accept service_type (transport mode)
CREATE OR REPLACE FUNCTION public.calculate_duty(
  p_origin_country TEXT,
  p_destination_country TEXT,
  p_service_type TEXT, -- 'ocean', 'air', etc.
  p_items JSONB -- Array of { "hts_code": "...", "value": 1000, "quantity": 1 }
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_duty NUMERIC := 0;
  v_total_fees NUMERIC := 0;
  v_total_mpf NUMERIC := 0;
  v_item JSONB;
  v_hts_code TEXT;
  v_item_value NUMERIC;
  v_hts_id UUID;
  v_rate_record RECORD;
  v_duty_amount NUMERIC;
  v_mpf_amount NUMERIC;
  v_hmf_amount NUMERIC;
  v_breakdown JSONB := '[]'::jsonb;
  v_currency TEXT := 'USD';
BEGIN
  -- Iterate items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_hts_code := v_item->>'hts_code';
    v_item_value := COALESCE((v_item->>'value')::NUMERIC, 0);
    v_currency := COALESCE(v_item->>'currency', 'USD');
    v_duty_amount := 0;
    v_mpf_amount := 0;
    v_hmf_amount := 0;

    -- 1. HTS Duty Lookup
    SELECT id INTO v_hts_id FROM public.aes_hts_codes WHERE hts_code = v_hts_code LIMIT 1;
    
    IF v_hts_id IS NOT NULL THEN
       SELECT * INTO v_rate_record
       FROM public.duty_rates
       WHERE aes_hts_id = v_hts_id
         AND country_code = p_destination_country
       ORDER BY CASE WHEN rate_type = 'FTA' THEN 1 WHEN rate_type = 'MFN' THEN 2 ELSE 3 END ASC
       LIMIT 1;

       IF FOUND AND v_rate_record.rate_value IS NOT NULL THEN
         v_duty_amount := v_item_value * v_rate_record.rate_value;
       END IF;
    END IF;

    -- 2. US Import Fees (MPF & HMF)
    IF p_destination_country = 'US' THEN
       -- MPF (Merchandise Processing Fee) - Ad Valorem 0.3464%
       v_mpf_amount := v_item_value * 0.003464;
       v_total_mpf := v_total_mpf + v_mpf_amount;

       -- HMF (Harbor Maintenance Fee) - Ocean only, 0.125%
       IF p_service_type = 'ocean' THEN
          v_hmf_amount := v_item_value * 0.00125;
       END IF;
    END IF;

    v_total_duty := v_total_duty + v_duty_amount;
    v_total_fees := v_total_fees + v_mpf_amount + v_hmf_amount;

    v_breakdown := v_breakdown || jsonb_build_object(
      'hts_code', v_hts_code,
      'value', v_item_value,
      'duty_amount', round(v_duty_amount, 2),
      'fees_amount', round(v_mpf_amount + v_hmf_amount, 2),
      'mpf', round(v_mpf_amount, 2),
      'hmf', round(v_hmf_amount, 2),
      'rate_applied', CASE WHEN v_rate_record.rate_value IS NOT NULL THEN (v_rate_record.rate_value * 100) || '%' ELSE 'N/A' END
    );
  END LOOP;

  -- Apply MPF Min/Max Logic (Formal Entry)
  -- Min $31.67, Max $614.35 (FY 2024 rates approx)
  -- Note: This applies to the ENTRY total, not per line. 
  -- We adjusted v_total_fees to reflect the clamped MPF? 
  -- For strict accuracy we should clamp v_total_mpf.
  -- However, since v_total_fees was built incrementally, we need to correct it.
  
  IF p_destination_country = 'US' AND v_total_mpf > 0 THEN
      DECLARE
        v_clamped_mpf NUMERIC;
      BEGIN
        v_clamped_mpf := GREATEST(31.67, LEAST(v_total_mpf, 614.35));
        -- Adjust total fees by the difference
        v_total_fees := v_total_fees - v_total_mpf + v_clamped_mpf;
      END;
  END IF;

  RETURN jsonb_build_object(
    'total_duty', round(v_total_duty, 2),
    'total_fees', round(v_total_fees, 2),
    'total_landed_cost', round(v_total_duty + v_total_fees, 2),
    'currency', v_currency,
    'breakdown', v_breakdown
  );
END;
$$;

-- Update create_invoice_from_shipment to use the enhanced calculate_duty
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
    issue_date, due_date, currency, subtotal, tax_total, total, balance_due, created_by
  )
  VALUES (
    p_tenant_id, v_invoice_number, v_customer_id, p_shipment_id, 'draft', 'standard',
    CURRENT_DATE, CURRENT_DATE + 30, v_currency, 0, 0, 0, 0, auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  -- Attempt to extract countries from shipment address JSONB
  v_origin_country := COALESCE(v_shipment.origin_address->>'country_code', v_shipment.origin_address->>'country');
  v_destination_country := COALESCE(v_shipment.destination_address->>'country_code', v_shipment.destination_address->>'country');
  
  -- Get Customs category ID
  SELECT id INTO v_duty_category_id FROM public.charge_categories WHERE code = 'customs' LIMIT 1;

  -- Collect cargo items for duty calculation
  FOR v_cargo_rec IN 
    SELECT cd.*, hts.hts_code
    FROM public.cargo_details cd
    LEFT JOIN public.aes_hts_codes hts ON hts.id = cd.aes_hts_id
    WHERE cd.service_type = 'shipment' 
      AND cd.service_id = p_shipment_id
      AND cd.is_active = true
  LOOP
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
    
    -- Call the ENHANCED duty calculation RPC with service type
    v_duty_result := public.calculate_duty(
        v_origin_country, 
        v_destination_country, 
        v_shipment.shipment_type::TEXT, 
        v_cargo_items
    );
    
    -- Extract total duty and fees
    v_duty_amount := (v_duty_result->>'total_landed_cost')::numeric; -- Use total landed cost (duty + fees)
    
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
        'Import Duties, Taxes & Fees (Est)',
        1,
        v_duty_amount,
        0,
        0,
        jsonb_build_object(
          'category_id', v_duty_category_id,
          'type', 'duty',
          'calculation_breakdown', v_duty_result->'breakdown',
          'total_duty', v_duty_result->>'total_duty',
          'total_fees', v_duty_result->>'total_fees'
        )
      );
    END IF;
  END IF;

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
