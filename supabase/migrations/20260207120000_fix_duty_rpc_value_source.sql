
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
  r_cargo RECORD;
  v_hts_code TEXT;
  v_origin_country TEXT;
  v_destination_country TEXT;
  v_duty_result JSONB;
  v_duty_amount NUMERIC;
  v_duty_category_id UUID;
  v_quote_id UUID;
  v_quote RECORD;
BEGIN
  -- 1. Get Shipment Details
  SELECT * INTO v_shipment FROM public.shipments WHERE id = p_shipment_id;
  
  IF v_shipment IS NULL THEN
    RAISE EXCEPTION 'Shipment not found';
  END IF;

  -- 2. Determine Customer (Bill To)
  -- Priority: Quote Bill-To > Shipment Account > Shipment Consignee (if linked)
  v_customer_id := v_shipment.account_id;
  
  -- Check for linked Quote
  IF v_shipment.quote_id IS NOT NULL THEN
    SELECT * INTO v_quote FROM public.quotes WHERE id = v_shipment.quote_id;
    IF v_quote IS NOT NULL AND v_quote.bill_to_account_id IS NOT NULL THEN
        v_customer_id := v_quote.bill_to_account_id;
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

  -- 5. Calculate Duties & Taxes (Landed Cost Engine)
  
  -- Get Origin/Destination Countries
  v_origin_country := (v_shipment.origin_address->>'country_code');
  v_destination_country := (v_shipment.destination_address->>'country_code');

  -- Loop through cargo items to build duty request
  FOR r_cargo IN 
    SELECT c.*, h.hts_code 
    FROM public.cargo_details c
    LEFT JOIN public.aes_hts_codes h ON c.aes_hts_id = h.id
    WHERE c.service_id = p_shipment_id 
    AND c.is_active = true
  LOOP
    IF r_cargo.hts_code IS NOT NULL THEN
      -- Build cargo items list for duty calculation
      -- Use value_amount column (metadata column does not exist on cargo_details)
      v_cargo_items := v_cargo_items || jsonb_build_object(
        'hts_code', r_cargo.hts_code,
        'value', COALESCE(r_cargo.value_amount, 0),
        'quantity', r_cargo.package_count
      );
    END IF;
  END LOOP;

  -- Call Calculate Duty RPC if we have items and countries
  IF jsonb_array_length(v_cargo_items) > 0 AND v_origin_country IS NOT NULL AND v_destination_country IS NOT NULL THEN
    v_duty_result := public.calculate_duty(v_origin_country, v_destination_country, v_cargo_items);
    
    -- Extract Total Duty
    v_duty_amount := (v_duty_result->>'total_duty')::numeric;
    
    IF v_duty_amount > 0 THEN
       -- Get or Create 'Customs Duties' Charge Category
       SELECT id INTO v_duty_category_id FROM public.charge_categories WHERE name = 'Customs Duties' LIMIT 1;
       
       IF v_duty_category_id IS NULL THEN
         INSERT INTO public.charge_categories(tenant_id, name, code, description)
         VALUES (p_tenant_id, 'Customs Duties', 'DUTY', 'Import duties and taxes')
         RETURNING id INTO v_duty_category_id;
       END IF;

       -- Insert Duty Line Item
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

  -- 6. Update Invoice Totals (Simple Sum)
  UPDATE public.invoices
  SET 
    subtotal = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM public.invoice_line_items WHERE invoice_id = v_invoice_id),
    total = (SELECT COALESCE(SUM(unit_price * quantity + tax_amount), 0) FROM public.invoice_line_items WHERE invoice_id = v_invoice_id),
    balance_due = (SELECT COALESCE(SUM(unit_price * quantity + tax_amount), 0) FROM public.invoice_line_items WHERE invoice_id = v_invoice_id)
  WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;
