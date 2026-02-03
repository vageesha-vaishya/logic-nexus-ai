-- Fix convert_quote_to_shipment RPC to handle shipment_type constraint
-- Description: Adds logic to determine shipment_type from quote.service_type_id or service_level, defaulting to ocean_freight.

BEGIN;

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
  v_shipment_type public.shipment_type;
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

  -- 3. Determine Shipment Type
  -- Try from service_type_id
  IF v_quote.service_type_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN code LIKE '%ocean%' THEN 'ocean_freight'::public.shipment_type
        WHEN code LIKE '%air%' THEN 'air_freight'::public.shipment_type
        WHEN code LIKE '%truck%' THEN 'inland_trucking'::public.shipment_type
        WHEN code LIKE '%rail%' THEN 'railway_transport'::public.shipment_type
        WHEN code LIKE '%courier%' THEN 'courier'::public.shipment_type
        WHEN code LIKE '%move%' THEN 'movers_packers'::public.shipment_type
        ELSE 'ocean_freight'::public.shipment_type
      END
    INTO v_shipment_type
    FROM public.service_types
    WHERE id = v_quote.service_type_id;
  END IF;

  -- Try from service_level text if still null
  IF v_shipment_type IS NULL AND v_quote.service_level IS NOT NULL THEN
     IF v_quote.service_level ILIKE '%air%' THEN
       v_shipment_type := 'air_freight';
     ELSIF v_quote.service_level ILIKE '%ocean%' OR v_quote.service_level ILIKE '%sea%' THEN
       v_shipment_type := 'ocean_freight';
     ELSIF v_quote.service_level ILIKE '%truck%' OR v_quote.service_level ILIKE '%road%' THEN
       v_shipment_type := 'inland_trucking';
     END IF;
  END IF;

  -- Default Fallback
  IF v_shipment_type IS NULL THEN
    v_shipment_type := 'ocean_freight';
  END IF;

  -- 4. Prepare Addresses
  -- Use Quote addresses if available
  IF v_quote.shipping_address IS NOT NULL AND v_quote.shipping_address != 'null'::jsonb THEN
     v_destination_address := v_quote.shipping_address;
  END IF;
  
  -- 5. Generate Shipment Number
  v_shipment_number := public.get_next_document_number(p_tenant_id, 'SHP');

  -- 6. Create Shipment
  INSERT INTO public.shipments(
    tenant_id,
    shipment_number,
    quote_id,
    account_id,
    contact_id,
    status,
    shipment_type,
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
    v_shipment_type,
    v_origin_address,
    v_destination_address,
    v_quote.incoterms,
    v_quote.service_level,
    v_option.sell_subtotal,
    COALESCE(v_quote.currency, 'USD'),
    auth.uid()
  )
  RETURNING id INTO v_shipment_id;

  -- 7. Copy Quote Items to Shipment Items
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
      v_item.unit_price,
      COALESCE(v_quote.currency, 'USD'),
      v_item.weight_kg,
      v_item.volume_cbm,
      'Package'
    );
  END LOOP;

  RETURN v_shipment_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
