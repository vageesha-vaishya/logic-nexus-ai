BEGIN;

-- 1. Update calculate_duty to return detailed MPF/HMF breakdown
CREATE OR REPLACE FUNCTION public.calculate_duty(
  p_origin_country TEXT,
  p_destination_country TEXT,
  p_service_type TEXT,
  p_items JSONB
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
  v_total_hmf NUMERIC := 0;
  v_clamped_mpf NUMERIC := 0;
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
  v_rate_applied TEXT;
  v_rate_type TEXT;
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
    v_rate_applied := 'N/A';
    v_rate_type := 'None';
    v_rate_record := NULL; -- Reset record

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
         v_rate_applied := (v_rate_record.rate_value * 100) || '%';
         v_rate_type := v_rate_record.rate_type;
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
          v_total_hmf := v_total_hmf + v_hmf_amount;
       END IF;
    END IF;

    v_total_duty := v_total_duty + v_duty_amount;
    
    -- Note: We sum up raw MPF/HMF here for per-item tracking, but total fees will be adjusted for clamping later
    
    v_breakdown := v_breakdown || jsonb_build_object(
      'hts_code', v_hts_code,
      'value', v_item_value,
      'duty_amount', round(v_duty_amount, 2),
      'fees_amount', round(v_mpf_amount + v_hmf_amount, 2),
      'mpf', round(v_mpf_amount, 2),
      'hmf', round(v_hmf_amount, 2),
      'rate_applied', v_rate_applied,
      'rate_type', v_rate_type
    );
  END LOOP;

  -- Apply MPF Min/Max Logic (Formal Entry)
  -- Min $31.67, Max $614.35 (FY 2024 rates approx)
  IF p_destination_country = 'US' AND v_total_mpf > 0 THEN
      v_clamped_mpf := GREATEST(31.67, LEAST(v_total_mpf, 614.35));
  ELSE
      v_clamped_mpf := v_total_mpf;
  END IF;

  -- Calculate final Total Fees
  v_total_fees := v_clamped_mpf + v_total_hmf;

  RETURN jsonb_build_object(
    'total_duty', round(v_total_duty, 2),
    'total_fees', round(v_total_fees, 2),
    'total_mpf', round(v_clamped_mpf, 2),
    'total_hmf', round(v_total_hmf, 2),
    'total_landed_cost', round(v_total_duty + v_total_fees, 2),
    'currency', v_currency,
    'breakdown', v_breakdown
  );
END;
$$;


-- 2. Update create_invoice_from_shipment to store enhanced metadata
CREATE OR REPLACE FUNCTION public.create_invoice_from_shipment(
  p_shipment_id UUID,
  p_tenant_id UUID
) RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_shipment RECORD;
  v_customer_id UUID;
  v_invoice_number TEXT;
  v_cargo_items JSONB := '[]'::jsonb;
  r_item RECORD;
  v_origin_country TEXT;
  v_destination_country TEXT;
  v_quote RECORD;
  v_subtotal NUMERIC := 0;
  v_tax_total NUMERIC := 0;
  v_total NUMERIC := 0;
  v_duty_result JSONB;
  v_breakdown_item JSONB;
  v_service_type TEXT;
  v_total_fees NUMERIC;
  v_total_mpf NUMERIC;
  v_total_hmf NUMERIC;
BEGIN
  -- 1. Get Shipment Details
  SELECT * INTO v_shipment FROM public.shipments WHERE id = p_shipment_id;
  
  IF v_shipment IS NULL THEN
    RAISE EXCEPTION 'Shipment not found';
  END IF;

  v_service_type := v_shipment.shipment_type::TEXT;

  -- 2. Determine Customer (Bill To)
  v_customer_id := v_shipment.account_id;
  
  -- Check for linked Quote
  IF v_shipment.quote_id IS NOT NULL THEN
    SELECT * INTO v_quote FROM public.quotes WHERE id = v_shipment.quote_id;
    IF v_quote IS NOT NULL AND v_quote.account_id IS NOT NULL THEN
        v_customer_id := v_quote.account_id;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'No bill-to customer found for this shipment';
  END IF;

  -- 3. Generate Invoice Number
  v_invoice_number := public.get_next_document_number(p_tenant_id, 'INV');

  -- 4. Create Invoice Header
  INSERT INTO public.invoices(
    tenant_id,
    invoice_number,
    customer_id,
    shipment_id,
    status,
    type,
    issue_date,
    due_date,
    currency,
    subtotal,
    total,
    balance_due,
    created_by
  )
  VALUES (
    p_tenant_id,
    v_invoice_number,
    v_customer_id,
    p_shipment_id,
    'draft',
    'standard',
    CURRENT_DATE,
    CURRENT_DATE + 30, -- Net 30 default
    COALESCE(v_shipment.currency, 'USD'),
    0, 0, 0, -- Will update after lines
    auth.uid()
  )
  RETURNING id INTO v_invoice_id;

  -- 4.1 Add Freight Charges (if available)
  IF v_shipment.total_charges > 0 THEN
     INSERT INTO public.invoice_line_items (
       invoice_id,
       tenant_id,
       description,
       quantity,
       unit_price,
       type,
       metadata
     ) VALUES (
       v_invoice_id,
       p_tenant_id,
       'Freight Charges',
       1,
       v_shipment.total_charges,
       'service',
       jsonb_build_object('source', 'shipment_total')
     );
  END IF;

  -- 5. Calculate Duties & Taxes (Landed Cost Engine)
  
  -- Get Origin/Destination Countries from Address JSONB
  v_origin_country := (v_shipment.origin_address->>'country_code');
  v_destination_country := (v_shipment.destination_address->>'country_code');

  -- Loop through CARGO DETAILS to build duty request
  FOR r_item IN 
    SELECT * FROM public.cargo_details 
    WHERE service_id = p_shipment_id 
      AND service_type = 'shipment'
  LOOP
    IF r_item.hs_code IS NOT NULL AND r_item.hs_code != '' THEN
      -- Build cargo items list for duty calculation
      v_cargo_items := v_cargo_items || jsonb_build_object(
        'hts_code', r_item.hs_code,
        'value', COALESCE(r_item.value_amount, 0),
        'quantity', COALESCE(r_item.package_count, 1),
        'currency', COALESCE(r_item.value_currency, 'USD')
      );
    END IF;
  END LOOP;

  -- Calculate Duty if we have items and destination
  IF jsonb_array_length(v_cargo_items) > 0 AND v_destination_country IS NOT NULL THEN
     
     -- Call the RPC with NEW SIGNATURE (Origin, Destination, ServiceType, Items JSONB)
     v_duty_result := public.calculate_duty(
        v_origin_country, 
        v_destination_country,
        v_service_type, -- Passed transport mode
        v_cargo_items
     );
     
     -- Iterate breakdown to create invoice lines for DUTY only
     IF v_duty_result IS NOT NULL AND v_duty_result->'breakdown' IS NOT NULL THEN
       FOR v_breakdown_item IN SELECT * FROM jsonb_array_elements(v_duty_result->'breakdown')
       LOOP
          -- Add Duty Line
          IF (v_breakdown_item->>'duty_amount')::NUMERIC > 0 THEN
             INSERT INTO public.invoice_line_items (
               invoice_id,
               tenant_id,
               description,
               quantity,
               unit_price,
               type,
               metadata
             ) VALUES (
               v_invoice_id,
               p_tenant_id,
               'Duty: ' || (v_breakdown_item->>'rate_type') || ' (' || (v_breakdown_item->>'hts_code') || ')',
               1,
               (v_breakdown_item->>'duty_amount')::NUMERIC,
               'tax',
               jsonb_build_object(
                 'hts_code', (v_breakdown_item->>'hts_code'),
                 'rate_type', (v_breakdown_item->>'rate_type'),
                 'rate', (v_breakdown_item->>'rate_applied'),
                 'source', 'landed_cost_engine',
                 'customs_value', (v_breakdown_item->>'value')
               )
             );
          END IF;
       END LOOP;
     END IF;

     -- Add SINGLE aggregated line for Import Fees (MPF/HMF) if > 0
     v_total_fees := (v_duty_result->>'total_fees')::NUMERIC;
     v_total_mpf := (v_duty_result->>'total_mpf')::NUMERIC;
     v_total_hmf := (v_duty_result->>'total_hmf')::NUMERIC;
     
     IF v_total_fees > 0 THEN
        INSERT INTO public.invoice_line_items (
           invoice_id,
           tenant_id,
           description,
           quantity,
           unit_price,
           type,
           metadata
         ) VALUES (
           v_invoice_id,
           p_tenant_id,
           'Import Fees (MPF/HMF)',
           1,
           v_total_fees,
           'tax',
           jsonb_build_object(
             'type', 'fees',
             'mpf_clamped', true,
             'source', 'landed_cost_engine',
             'mpf_fee', v_total_mpf,
             'hmf_fee', v_total_hmf
           )
         );
     END IF;

  END IF;
  
  -- 6. Update Invoice Totals based on lines
  SELECT 
    COALESCE(SUM(CASE WHEN type != 'tax' THEN (amount + COALESCE(tax_amount, 0)) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'tax' THEN (amount + COALESCE(tax_amount, 0)) ELSE 0 END), 0),
    COALESCE(SUM(amount + COALESCE(tax_amount, 0)), 0)
  INTO v_subtotal, v_tax_total, v_total
  FROM public.invoice_line_items 
  WHERE invoice_id = v_invoice_id;

  -- Update invoice with calculated values
  UPDATE public.invoices
  SET 
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total = v_total,
    balance_due = v_total
  WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
