-- Migration: Quotation to Shipment Conversion & Invoice Pipeline Update
-- Description: 
-- 1. Updates create_invoice_from_shipment to use shipment_items instead of cargo_details.
-- 2. Implements convert_quote_to_shipment RPC to generate shipments from quotes.

BEGIN;

--------------------------------------------------------------------------------
-- 1. Update create_invoice_from_shipment to use shipment_items
--------------------------------------------------------------------------------

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
  -- Assuming address JSONB has { "country_code": "US" } structure
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
    -- Call Calculate Duty RPC (assuming it returns a set of rates)
    -- We need to aggregate the results. 
    -- For this simplified version, we'll just insert duty lines for each item.
    
    -- NOTE: calculate_duty RPC returns table, so we need to iterate or aggregate.
    -- Ideally, we call it per item or batch. The current calculate_duty takes a single HTS code.
    -- We need to call it for each item.
    
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
             total,
             type,
             metadata
           ) VALUES (
             v_invoice_id,
             p_tenant_id,
             'Duty: ' || duty_rec.rate_type || ' (' || (item_json->>'hts_code') || ')',
             1,
             duty_rec.duty_amount,
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
  
  -- Update Invoice Totals based on lines
  UPDATE public.invoices
  SET 
    subtotal = (SELECT COALESCE(SUM(total), 0) FROM public.invoice_line_items WHERE invoice_id = v_invoice_id AND type != 'tax'),
    tax_total = (SELECT COALESCE(SUM(total), 0) FROM public.invoice_line_items WHERE invoice_id = v_invoice_id AND type = 'tax'),
    total = (SELECT COALESCE(SUM(total), 0) FROM public.invoice_line_items WHERE invoice_id = v_invoice_id),
    balance_due = (SELECT COALESCE(SUM(total), 0) FROM public.invoice_line_items WHERE invoice_id = v_invoice_id)
  WHERE id = v_invoice_id;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- 2. Convert Quote to Shipment RPC
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.convert_quote_to_shipment(
  p_quote_id UUID,
  p_tenant_id UUID
) RETURNS UUID AS $$
DECLARE
  v_quote RECORD;
  v_option RECORD;
  v_shipment_id UUID;
  v_shipment_number TEXT;
  v_origin_loc RECORD;
  v_dest_loc RECORD;
  v_item RECORD;
  v_pkg RECORD;
  v_origin_address JSONB := '{}'::jsonb;
  v_destination_address JSONB := '{}'::jsonb;
BEGIN
  -- 1. Get Quote Details
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id AND tenant_id = p_tenant_id;
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  -- 2. Determine Selected Option
  -- Try Customer Selection first
  SELECT qvo.* INTO v_option
  FROM public.customer_selections cs
  JOIN public.quotation_version_options qvo ON cs.quotation_version_option_id = qvo.id
  WHERE cs.quote_id = p_quote_id
  LIMIT 1;

  -- If no selection, try Recommended Option from Active Version
  IF v_option IS NULL THEN
    SELECT qvo.* INTO v_option
    FROM public.quotation_versions qv
    JOIN public.quotation_version_options qvo ON qvo.quotation_version_id = qv.id
    WHERE qv.quote_id = p_quote_id 
    AND qv.is_active = true
    AND qvo.recommended = true
    LIMIT 1;
  END IF;
  
  -- If still null, just take first option from Active Version
  IF v_option IS NULL THEN
     SELECT qvo.* INTO v_option
    FROM public.quotation_versions qv
    JOIN public.quotation_version_options qvo ON qvo.quotation_version_id = qv.id
    WHERE qv.quote_id = p_quote_id 
    AND qv.is_active = true
    ORDER BY qvo.sell_subtotal ASC
    LIMIT 1;
  END IF;

  IF v_option IS NULL THEN
    RAISE EXCEPTION 'No valid quotation option found to convert';
  END IF;

  -- 3. Prepare Addresses
  -- Use Quote addresses if available
  IF v_quote.shipping_address IS NOT NULL AND v_quote.shipping_address != 'null'::jsonb THEN
     v_destination_address := v_quote.shipping_address;
  END IF;
  
  -- We could try to get origin from first leg, but for now let's leave empty or use billing?
  -- Leaving origin empty as 'Draft' allows it.

  -- 4. Generate Shipment Number
  v_shipment_number := public.get_next_document_number(p_tenant_id, 'SHP');

  -- 5. Create Shipment
  INSERT INTO public.shipments(
    tenant_id,
    shipment_number,
    quote_id,
    account_id,
    contact_id,
    status,
    origin_address,
    destination_address,
    incoterms,
    service_level,
    total_charges,
    currency,
    created_by
  )
  VALUES (
    p_tenant_id,
    v_shipment_number,
    p_quote_id,
    v_quote.account_id,
    v_quote.contact_id,
    'draft',
    v_origin_address,
    v_destination_address,
    v_quote.incoterms,
    v_quote.service_level,
    v_option.sell_subtotal,
    COALESCE(v_quote.currency, 'USD'),
    auth.uid()
  )
  RETURNING id INTO v_shipment_id;

  -- 6. Copy Quote Items to Shipment Items
  -- Map Quote Items (Products) to Shipment Items
  FOR v_item IN SELECT * FROM public.quote_items WHERE quote_id = p_quote_id LOOP
    INSERT INTO public.shipment_items(
      shipment_id,
      item_number,
      description,
      quantity,
      value,
      currency,
      weight_kg,
      volume_cbm,
      package_type
    )
    VALUES (
      v_shipment_id,
      v_item.line_number,
      v_item.product_name || CASE WHEN v_item.description IS NOT NULL THEN ' - ' || v_item.description ELSE '' END,
      v_item.quantity,
      v_item.unit_price, -- Assuming unit price is value
      'USD', -- Should match quote currency
      v_item.weight_kg,
      v_item.volume_cbm,
      'Package' -- Default, or map from extension
    );
  END LOOP;

  -- 7. Update Shipment Totals from Packages (if available)
  -- If quotation_packages exist, they are the source of truth for physical weight/dims
  DECLARE
    v_total_weight NUMERIC := 0;
    v_total_volume NUMERIC := 0;
    v_pkg_count INTEGER := 0;
  BEGIN
    SELECT 
      COALESCE(SUM(weight_kg * quantity), 0),
      COALESCE(SUM(volume_cbm * quantity), 0),
      COALESCE(SUM(quantity), 0)
    INTO v_total_weight, v_total_volume, v_pkg_count
    FROM public.quotation_packages
    WHERE quote_id = p_quote_id;

    IF v_pkg_count > 0 THEN
      UPDATE public.shipments
      SET 
        total_weight_kg = v_total_weight,
        total_volume_cbm = v_total_volume,
        total_packages = v_pkg_count
      WHERE id = v_shipment_id;
    END IF;
  END;

  RETURN v_shipment_id;
END;
$$ LANGUAGE plpgsql;

-- Grant Access
GRANT EXECUTE ON FUNCTION public.convert_quote_to_shipment(UUID, UUID) TO authenticated;

COMMIT;
