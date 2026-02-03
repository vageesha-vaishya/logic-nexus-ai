
CREATE OR REPLACE FUNCTION public.create_invoice_from_shipment(
  p_shipment_id UUID,
  p_tenant_id UUID
) RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_shipment RECORD;
  v_customer_id UUID;
  v_currency TEXT;
  v_cargo_items JSONB := '[]'::JSONB;
  v_origin_country TEXT;
  v_destination_country TEXT;
  v_duty_result JSONB;
  v_service_type TEXT;
  r_item RECORD;
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

  -- 2. Determine Customer (Bill To)
  -- Mapping account_id to customer_id
  v_customer_id := v_shipment.account_id;
  
  -- 3. Determine Currency
  v_currency := 'USD'; -- Default
  
  -- 4. Create Invoice Header
  INSERT INTO public.invoices (
    tenant_id,
    customer_id,
    invoice_number,
    status,
    issue_date,
    due_date,
    currency,
    shipment_id
  ) VALUES (
    p_tenant_id,
    v_customer_id,
    'INV-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISS') || '-' || substring(p_shipment_id::text, 1, 4),
    'draft',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    v_currency,
    p_shipment_id
  ) RETURNING id INTO v_invoice_id;

  -- 5. Prepare Cargo Items for Duty Calc
  -- Use country columns if they exist, otherwise fallback or error
  -- Assuming they exist based on previous successful inserts
  v_origin_country := v_shipment.origin_country;
  v_destination_country := v_shipment.destination_country;
  v_service_type := v_shipment.shipment_type;

  -- Rebuild the loop to join with aes_hts_codes to get string code
  FOR r_item IN 
    SELECT c.*, h.hts_code 
    FROM public.cargo_details c
    LEFT JOIN public.aes_hts_codes h ON c.aes_hts_id = h.id
    WHERE c.service_id = p_shipment_id AND c.service_type = 'shipment'
  LOOP
     v_cargo_items := v_cargo_items || jsonb_build_object(
        'hts_code', r_item.hts_code,
        'value', r_item.value_amount,
        'quantity', r_item.package_count
     );
  END LOOP;

  -- 6. Calculate Duties
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
  
  -- Total Invoice Line Item Amount = Duty + MPF + HMF
  v_invoice_amount := v_total_duty + v_total_mpf + v_total_hmf;

  -- 7. Insert Fees Line Item with Enhanced Metadata
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
      'hmf_amount', v_total_hmf
    )
  );

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql;
