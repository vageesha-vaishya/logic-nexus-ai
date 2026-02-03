BEGIN;

-- Update create_invoice_from_shipment to use aggregated total_fees for MPF/HMF
-- ensuring the Min/Max clamping logic from calculate_duty is respected.

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
                 'source', 'landed_cost_engine'
               )
             );
          END IF;
       END LOOP;
     END IF;

     -- Add SINGLE aggregated line for Import Fees (MPF/HMF) if > 0
     v_total_fees := (v_duty_result->>'total_fees')::NUMERIC;
     
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
             'source', 'landed_cost_engine'
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
