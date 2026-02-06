
BEGIN;

-- 1. Ensure quotes table has carrier_id (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'quotes' 
        AND column_name = 'carrier_id'
    ) THEN
        ALTER TABLE public.quotes 
        ADD COLUMN carrier_id UUID REFERENCES public.carriers(id);
    END IF;
END $$;

-- 2. Update create_shipment_from_quote to transfer carrier_id
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
  -- 1. Get Quote Details (including carrier_id)
  SELECT q.*, sm.name as service_mode
  INTO v_quote
  FROM public.quotes q
  LEFT JOIN public.service_types st ON q.service_type_id = st.id
  LEFT JOIN public.service_modes sm ON st.mode_id = sm.id
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
    v_shipment_type := 'ocean_freight';
  ELSIF v_quote.service_mode ILIKE '%air%' THEN
    v_shipment_type := 'air_freight';
  ELSIF v_quote.service_mode ILIKE '%truck%' OR v_quote.service_mode ILIKE '%road%' THEN
    v_shipment_type := 'inland_trucking';
  ELSIF v_quote.service_mode ILIKE '%rail%' THEN
    v_shipment_type := 'railway_transport';
  ELSE
    v_shipment_type := 'ocean_freight'; -- Default fallback
  END IF;

  -- 4. Generate Shipment Number
  v_shipment_number := public.get_next_document_number(p_tenant_id, 'SHP');

  -- 5. Create Shipment Header (Mapping carrier_id)
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
    carrier_id, -- New field mapping
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
    v_quote.carrier_id, -- Map from quote
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

  -- 7. Update Shipment Totals
  UPDATE public.shipments
  SET 
    total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM public.shipment_items WHERE shipment_id = v_shipment_id),
    total_volume_cbm = (SELECT COALESCE(SUM(volume_cbm), 0) FROM public.shipment_items WHERE shipment_id = v_shipment_id)
  WHERE id = v_shipment_id;

  RETURN v_shipment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
