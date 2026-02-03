BEGIN;

-- 1. Seed HTS Code if missing (for testing/demo)
DO $$
DECLARE
  v_hts_id UUID;
BEGIN
  SELECT id INTO v_hts_id FROM public.aes_hts_codes WHERE hts_code = '8517.62.00';
  
  IF v_hts_id IS NULL THEN
    INSERT INTO public.aes_hts_codes (hts_code, description, category)
    VALUES ('8517.62.00', 'Machines for the reception, conversion and transmission or regeneration of voice, images or other data', 'Electronics')
    RETURNING id INTO v_hts_id;
  END IF;

  -- 2. Seed Duty Rate if missing
  IF NOT EXISTS (SELECT 1 FROM public.duty_rates WHERE aes_hts_id = v_hts_id AND country_code = 'US') THEN
    INSERT INTO public.duty_rates (aes_hts_id, country_code, rate_type, rate_value, source)
    VALUES (v_hts_id, 'US', 'MFN', 0.05, 'Seed');
  END IF;
END $$;

-- 3. Update create_invoice_from_shipment RPC to use new calculate_duty signature
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
        'quantity', COALESCE(r_item.quantity, 1),
        'currency', COALESCE(r_item.currency, 'USD')
      );
    END IF;
  END LOOP;

  -- Calculate Duty if we have items and destination
  IF jsonb_array_length(v_cargo_items) > 0 AND v_destination_country IS NOT NULL THEN
     
     -- Call the RPC with NEW SIGNATURE (Origin, Destination, Items JSONB)
     v_duty_result := public.calculate_duty(
        v_origin_country, 
        v_destination_country,
        v_cargo_items
     );
     
     -- Iterate breakdown to create invoice lines
     IF v_duty_result IS NOT NULL AND v_duty_result->'breakdown' IS NOT NULL THEN
       FOR v_breakdown_item IN SELECT * FROM jsonb_array_elements(v_duty_result->'breakdown')
       LOOP
          -- Only add if duty_amount > 0
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
                 'source', (v_breakdown_item->>'source')
               )
             );
          END IF;
       END LOOP;
     END IF;
  END IF;
  
  -- 6. Update Invoice Totals based on lines
  -- Calculate totals into variables first
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
