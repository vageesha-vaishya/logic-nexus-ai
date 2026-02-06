-- Update create_invoice_from_shipment to include container metadata
-- This ensures that the invoice is aware of the normalized container types used in the shipment.

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
  v_containers JSONB := '[]'::jsonb; -- New variable for containers
  r_item RECORD;
  v_origin_country TEXT;
  v_destination_country TEXT;
  v_quote RECORD;
  v_subtotal NUMERIC := 0;
  v_tax_total NUMERIC := 0;
  v_total NUMERIC := 0;
BEGIN
  -- 1. Get Shipment Details
  SELECT * INTO v_shipment FROM public.shipments WHERE id = p_shipment_id;
  
  IF v_shipment IS NULL THEN
    RAISE EXCEPTION 'Shipment not found';
  END IF;

  -- 2. Determine Customer (Bill To)
  -- Priority: Quote Bill-To > Shipment Account > Shipment Consignee (if linked)
  v_customer_id := v_shipment.account_id;
  
  IF v_shipment.quote_id IS NOT NULL THEN
    SELECT * INTO v_quote FROM public.quotes WHERE id = v_shipment.quote_id;
    IF v_quote IS NOT NULL AND v_quote.account_id IS NOT NULL THEN
        v_customer_id := v_quote.account_id;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'No bill-to customer found for this shipment';
  END IF;

  -- NEW: Fetch Container Summary for Metadata
  -- Using normalized shipment_containers table
  SELECT jsonb_agg(
    jsonb_build_object(
      'container_id', sc.id,
      'container_number', sc.container_number,
      'type', ct.name,
      'size', cs.name,
      'type_id', sc.container_type_id,
      'size_id', sc.container_size_id
    )
  ) INTO v_containers
  FROM public.shipment_containers sc
  LEFT JOIN public.container_types ct ON sc.container_type_id = ct.id
  LEFT JOIN public.container_sizes cs ON sc.container_size_id = cs.id
  WHERE sc.shipment_id = p_shipment_id;

  -- 3. Generate Invoice Number
  v_invoice_number := public.get_next_document_number(p_tenant_id, 'INV');

  -- 4. Create Invoice Header with Container Metadata
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
    created_by,
    metadata  -- Populate metadata
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
    auth.uid(),
    jsonb_build_object(
      'containers', COALESCE(v_containers, '[]'::jsonb),
      'generated_from', 'shipment',
      'source_rpc', 'create_invoice_from_shipment'
    )
  )
  RETURNING id INTO v_invoice_id;

  -- 5. Calculate Duties & Taxes (Landed Cost Engine)
  
  -- Get Origin/Destination Countries from Address JSONB
  v_origin_country := (v_shipment.origin_address->>'country_code');
  v_destination_country := (v_shipment.destination_address->>'country_code');

  -- Loop through shipment items to build duty request
  FOR r_item IN 
    SELECT * FROM public.shipment_items 
    WHERE shipment_id = p_shipment_id 
  LOOP
    IF r_item.hs_code IS NOT NULL AND r_item.hs_code != '' THEN
      -- Build cargo items list for duty calculation
      v_cargo_items := v_cargo_items || jsonb_build_object(
        'hts_code', r_item.hs_code,
        'value', COALESCE(r_item.value, 0),
        'quantity', COALESCE(r_item.quantity, 1)
      );
    END IF;
  END LOOP;

  -- If we have items with HTS codes and valid countries, calculate duty
  IF jsonb_array_length(v_cargo_items) > 0 AND v_origin_country IS NOT NULL AND v_destination_country IS NOT NULL THEN
    DECLARE
      item_json JSONB;
      duty_rec RECORD;
    BEGIN
      FOR item_json IN SELECT * FROM jsonb_array_elements(v_cargo_items)
      LOOP
        FOR duty_rec IN SELECT * FROM public.calculate_duty(
          (item_json->>'hts_code'),
          v_destination_country,
          (item_json->>'value')::NUMERIC
        )
        LOOP
           -- Insert Invoice Line Item for Duty
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
             'Duty: ' || duty_rec.rate_type || ' (' || (item_json->>'hts_code') || ')',
             1,
             duty_rec.duty_amount,
             'tax',
             jsonb_build_object(
               'hts_code', (item_json->>'hts_code'),
               'rate_type', duty_rec.rate_type,
               'rate', duty_rec.rate_value,
               'customs_value', (item_json->>'value')
             )
           );
        END LOOP;
      END LOOP;
    END;
  END IF;
  
  -- 6. Update Invoice Totals based on lines
  -- Calculate totals into variables first
  -- amount is generated (qty * price). tax_amount is explicit tax on the line.
  -- For duty lines, we put the duty in unit_price, so amount = duty.
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
