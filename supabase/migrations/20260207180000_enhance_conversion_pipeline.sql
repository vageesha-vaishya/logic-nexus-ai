BEGIN;

-- 1. Enhance create_shipment_from_quote to copy cargo_details
CREATE OR REPLACE FUNCTION public.create_shipment_from_quote(
  p_quote_id UUID,
  p_tenant_id UUID
) RETURNS UUID AS $$
DECLARE
  v_shipment_id UUID;
  v_quote RECORD;
  v_shipment_number TEXT;
  v_shipment_type public.shipment_type;
  v_service_mode TEXT;
BEGIN
  -- 1. Get Quote Details
  SELECT q.*, st.mode as service_mode
  INTO v_quote
  FROM public.quotes q
  LEFT JOIN public.service_types st ON q.service_type_id = st.id
  WHERE q.id = p_quote_id AND q.tenant_id = p_tenant_id;

  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  -- 2. Check for existing shipment (Idempotency)
  SELECT id INTO v_shipment_id
  FROM public.shipments
  WHERE quote_id = p_quote_id AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_shipment_id IS NOT NULL THEN
    RETURN v_shipment_id;
  END IF;

  -- 3. Determine Shipment Type
  IF v_quote.service_mode ILIKE '%ocean%' OR v_quote.service_mode ILIKE '%sea%' THEN
    v_shipment_type := 'ocean';
  ELSIF v_quote.service_mode ILIKE '%air%' THEN
    v_shipment_type := 'air';
  ELSIF v_quote.service_mode ILIKE '%truck%' OR v_quote.service_mode ILIKE '%road%' THEN
    v_shipment_type := 'inland_trucking';
  ELSIF v_quote.service_mode ILIKE '%rail%' THEN
    v_shipment_type := 'rail';
  ELSE
    v_shipment_type := 'ocean'; -- Default fallback
  END IF;

  -- 4. Generate Shipment Number
  v_shipment_number := public.get_next_document_number(p_tenant_id, 'SHP');

  -- 5. Create Shipment Header
  INSERT INTO public.shipments(
    tenant_id,
    franchise_id,
    quote_id,
    shipment_number,
    shipment_type,
    status,
    account_id,
    contact_id,
    origin_address,
    destination_address,
    total_weight_kg,
    total_volume_cbm,
    total_charges,
    currency,
    special_instructions,
    created_by
  ) VALUES (
    p_tenant_id,
    v_quote.franchise_id,
    p_quote_id,
    v_shipment_number,
    v_shipment_type,
    'draft',
    v_quote.account_id,
    v_quote.contact_id,
    COALESCE(v_quote.origin_location, '{}'::jsonb),
    COALESCE(v_quote.destination_location, '{}'::jsonb),
    0, -- Will update after items
    0, -- Will update after items
    v_quote.total_amount, 
    v_quote.currency,
    v_quote.notes,
    auth.uid()
  )
  RETURNING id INTO v_shipment_id;

  -- 6. Create Shipment Items (from Quote Items)
  INSERT INTO public.shipment_items(
    shipment_id,
    item_number,
    description,
    quantity,
    weight_kg,
    volume_cbm,
    package_type,
    hs_code,
    value,
    currency,
    special_handling
  )
  SELECT
    v_shipment_id,
    row_number() OVER (ORDER BY qi.line_number),
    qi.product_name || COALESCE(' - ' || qi.description, ''),
    qi.quantity,
    qi.weight_kg,
    qi.volume_cbm,
    NULL,
    NULL,
    qi.unit_price,
    v_quote.currency,
    qi.special_instructions
  FROM public.quote_items qi
  WHERE qi.quote_id = p_quote_id;

  -- 7. Copy Cargo Details (CRITICAL for Duty Calculation)
  INSERT INTO public.cargo_details (
    tenant_id,
    service_type,
    service_id,
    cargo_type_id,
    commodity_description,
    hs_code,
    aes_hts_id,
    package_count,
    total_weight_kg,
    total_volume_cbm,
    dimensions,
    hazmat,
    hazmat_class,
    value_amount,
    value_currency,
    created_by
  )
  SELECT
    p_tenant_id,
    'shipment',
    v_shipment_id,
    cargo_type_id,
    commodity_description,
    hs_code,
    aes_hts_id,
    package_count,
    total_weight_kg,
    total_volume_cbm,
    dimensions,
    hazmat,
    hazmat_class,
    value_amount,
    value_currency,
    auth.uid()
  FROM public.cargo_details
  WHERE service_id = p_quote_id AND service_type = 'quote';

  -- 8. Update Shipment Totals (using Cargo Details if available, else items)
  -- Prefer cargo_details for weight/volume as it's more physical
  IF EXISTS (SELECT 1 FROM public.cargo_details WHERE service_id = v_shipment_id AND service_type = 'shipment') THEN
      UPDATE public.shipments
      SET 
        total_weight_kg = (SELECT COALESCE(SUM(total_weight_kg), 0) FROM public.cargo_details WHERE service_id = v_shipment_id AND service_type = 'shipment'),
        total_volume_cbm = (SELECT COALESCE(SUM(total_volume_cbm), 0) FROM public.cargo_details WHERE service_id = v_shipment_id AND service_type = 'shipment')
      WHERE id = v_shipment_id;
  ELSE
      UPDATE public.shipments
      SET 
        total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM public.shipment_items WHERE shipment_id = v_shipment_id),
        total_volume_cbm = (SELECT COALESCE(SUM(volume_cbm), 0) FROM public.shipment_items WHERE shipment_id = v_shipment_id)
      WHERE id = v_shipment_id;
  END IF;

  RETURN v_shipment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update create_invoice_from_shipment to use cargo_details for Duty
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
  v_hts_code TEXT;
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
    WHERE service_id = p_shipment_id AND service_type = 'shipment'
  LOOP
    -- Resolve HTS Code (Prefer direct code, then lookup from ID if needed)
    v_hts_code := r_item.hs_code;
    
    IF (v_hts_code IS NULL OR v_hts_code = '') AND r_item.aes_hts_id IS NOT NULL THEN
        SELECT hts_code INTO v_hts_code FROM public.aes_hts_codes WHERE id = r_item.aes_hts_id;
    END IF;

    IF v_hts_code IS NOT NULL AND v_hts_code != '' THEN
      -- Build cargo items list for duty calculation
      v_cargo_items := v_cargo_items || jsonb_build_object(
        'hts_code', v_hts_code,
        'value', COALESCE(r_item.value_amount, 0),
        'quantity', COALESCE(r_item.package_count, 1),
        'currency', COALESCE(r_item.value_currency, 'USD')
      );
    END IF;
  END LOOP;

  -- Calculate Duty if we have items and destination
  IF jsonb_array_length(v_cargo_items) > 0 AND v_destination_country IS NOT NULL THEN
     
     -- Call the RPC
     v_duty_result := public.calculate_duty(
        v_origin_country, 
        v_destination_country,
        v_service_type, 
        v_cargo_items
     );
     
     -- Iterate breakdown to create invoice lines
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
                 'source', (v_breakdown_item->>'source'),
                 'customs_value', (v_breakdown_item->>'customs_value')
               )
             );
          END IF;

          -- Add Fees Line (MPF/HMF) if present
          IF (v_breakdown_item->>'fees_amount')::NUMERIC > 0 THEN
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
               'Import Fees (MPF/HMF): ' || (v_breakdown_item->>'hts_code'),
               1,
               (v_breakdown_item->>'fees_amount')::NUMERIC,
               'tax',
               jsonb_build_object(
                 'hts_code', (v_breakdown_item->>'hts_code'),
                 'mpf', (v_breakdown_item->>'mpf'),
                 'hmf', (v_breakdown_item->>'hmf')
               )
             );
          END IF;
       END LOOP;
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
