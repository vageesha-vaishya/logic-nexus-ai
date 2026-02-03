BEGIN;

-- 1. Ensure invoice_line_items.type allows 'fees'
-- Dropping existing constraint and adding a comprehensive one
ALTER TABLE public.invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_type_check;
ALTER TABLE public.invoice_line_items ADD CONSTRAINT invoice_line_items_type_check 
  CHECK (type IN ('service', 'product', 'tax', 'fees', 'adjustment'));

-- 2. Update create_invoice_from_shipment to be robust and metadata-rich
CREATE OR REPLACE FUNCTION public.create_invoice_from_shipment(
  p_shipment_id UUID,
  p_tenant_id UUID
) RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_shipment RECORD;
  v_customer_id UUID;
  v_invoice_number TEXT;
  v_cargo_items JSONB := '[]'::JSONB;
  r_item RECORD;
  v_origin_country TEXT;
  v_destination_country TEXT;
  v_quote RECORD;
  v_duty_result JSONB;
  v_service_type TEXT;
  v_total_duty NUMERIC;
  v_total_mpf NUMERIC;
  v_total_hmf NUMERIC;
  v_total_fees NUMERIC;
  v_invoice_amount NUMERIC;
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
  INSERT INTO public.invoices (
    tenant_id,
    customer_id,
    invoice_number,
    issue_date,
    due_date,
    currency,
    status,
    notes,
    shipment_id,
    type,
    created_by
  ) VALUES (
    p_tenant_id,
    v_customer_id,
    v_invoice_number,
    CURRENT_DATE,
    CURRENT_DATE + 30, -- Net 30 default
    COALESCE(v_shipment.currency, 'USD'),
    'draft',
    'Generated from Shipment ' || v_shipment.shipment_number,
    p_shipment_id,
    'standard',
    auth.uid()
  ) RETURNING id INTO v_invoice_id;

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

  -- 5. Prepare Cargo Items for Duty Calc
  -- Use country columns if they exist, otherwise fallback to address JSONB
  v_origin_country := COALESCE(v_shipment.origin_country, v_shipment.origin_address->>'country_code');
  v_destination_country := COALESCE(v_shipment.destination_country, v_shipment.destination_address->>'country_code');

  -- Loop through CARGO DETAILS to build duty request
  -- Join with aes_hts_codes to get the actual HTS code string if aes_hts_id is present
  FOR r_item IN 
    SELECT c.*, h.hts_code as resolved_hts_code
    FROM public.cargo_details c
    LEFT JOIN public.aes_hts_codes h ON c.aes_hts_id = h.id
    WHERE c.service_id = p_shipment_id 
      AND (c.service_type = 'shipment' OR c.service_type IS NULL) -- Handle potential NULL service_type legacy
  LOOP
    -- Prioritize resolved HTS code, then local hs_code
    IF (r_item.resolved_hts_code IS NOT NULL AND r_item.resolved_hts_code != '') OR (r_item.hs_code IS NOT NULL AND r_item.hs_code != '') THEN
      v_cargo_items := v_cargo_items || jsonb_build_object(
        'hts_code', COALESCE(r_item.resolved_hts_code, r_item.hs_code),
        'value', COALESCE(r_item.value_amount, 0),
        'quantity', COALESCE(r_item.package_count, 1),
        'currency', COALESCE(r_item.value_currency, 'USD')
      );
    END IF;
  END LOOP;

  -- 6. Calculate Duties & Taxes (Landed Cost Engine)
  IF jsonb_array_length(v_cargo_items) > 0 AND v_destination_country IS NOT NULL AND v_origin_country IS NOT NULL THEN
     
     -- Call the RPC
     v_duty_result := public.calculate_duty(
        v_origin_country, 
        v_destination_country,
        v_service_type,
        v_cargo_items
     );
     
     -- Extract values safely
     v_total_duty := COALESCE((v_duty_result->>'total_duty')::NUMERIC, 0);
     v_total_mpf := COALESCE((v_duty_result->>'total_mpf')::NUMERIC, 0);
     v_total_hmf := COALESCE((v_duty_result->>'total_hmf')::NUMERIC, 0);
     
     -- Calculate Total Fees Amount
     v_invoice_amount := v_total_duty + v_total_mpf + v_total_hmf;

     -- Insert Fees Line Item IF there is any amount > 0
     IF v_invoice_amount > 0 THEN
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
         'Customs Duties & Fees',
         1,
         v_invoice_amount,
         'fees',
         jsonb_build_object(
           'duty_amount', v_total_duty,
           'mpf_amount', v_total_mpf,
           'hmf_amount', v_total_hmf,
           'source', 'landed_cost_engine',
           'calculation_log', v_duty_result
         )
       );
     END IF;
  END IF;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
