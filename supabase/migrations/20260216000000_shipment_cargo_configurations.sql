-- Migration to add shipment_cargo_configurations table and update conversion RPC
-- Mirrors quote_cargo_configurations for Shipments

BEGIN;

-- 1. Create Table
CREATE TABLE IF NOT EXISTS public.shipment_cargo_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Classification
    transport_mode TEXT NOT NULL,
    cargo_type TEXT NOT NULL,
    
    -- Equipment/Unit Details
    container_type TEXT,
    container_size TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    
    -- Weight & Volume (Per Unit)
    unit_weight_kg NUMERIC,
    unit_volume_cbm NUMERIC,
    
    -- Dimensions (Per Unit)
    length_cm NUMERIC,
    width_cm NUMERIC,
    height_cm NUMERIC,
    
    -- Special Handling
    is_hazardous BOOLEAN DEFAULT false,
    hazardous_class TEXT,
    un_number TEXT,
    is_temperature_controlled BOOLEAN DEFAULT false,
    temperature_min NUMERIC,
    temperature_max NUMERIC,
    temperature_unit TEXT DEFAULT 'C',
    
    -- References
    package_category_id UUID REFERENCES public.package_categories(id),
    package_size_id UUID REFERENCES public.package_sizes(id),
    
    remarks TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_cargo_shipment_id ON public.shipment_cargo_configurations(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_cargo_tenant_id ON public.shipment_cargo_configurations(tenant_id);

-- 3. RLS
ALTER TABLE public.shipment_cargo_configurations ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipment_cargo_configurations' AND policyname = 'Tenant read shipment cargo configs'
    ) THEN
        CREATE POLICY "Tenant read shipment cargo configs" ON public.shipment_cargo_configurations
            FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shipment_cargo_configurations' AND policyname = 'Tenant write shipment cargo configs'
    ) THEN
        CREATE POLICY "Tenant write shipment cargo configs" ON public.shipment_cargo_configurations
            FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
    END IF;
END $$;

-- 4. Triggers
DROP TRIGGER IF EXISTS update_shipment_cargo_modtime ON public.shipment_cargo_configurations;
CREATE TRIGGER update_shipment_cargo_modtime
    BEFORE UPDATE ON public.shipment_cargo_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Update Conversion RPC
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
    created_by,
    shipment_type
  )
  VALUES (
    p_tenant_id,
    v_shipment_number,
    p_quote_id,
    v_quote.account_id,
    v_quote.contact_id,
    'draft',
    v_quote.origin_address,
    v_quote.destination_address,
    v_quote.incoterms,
    v_quote.service_level,
    v_quote.total_amount, -- Use quote total amount
    COALESCE(v_quote.currency, 'USD'),
    auth.uid(),
    v_shipment_type
  )
  RETURNING id INTO v_shipment_id;

  -- 6. Copy Quote Items to Shipment Items
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
    special_instructions
  )
  SELECT 
    v_shipment_id,
    qi.line_number,
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

  -- 7. Copy Cargo Configurations
  INSERT INTO public.shipment_cargo_configurations (
    shipment_id,
    tenant_id,
    transport_mode,
    cargo_type,
    container_type,
    container_size,
    quantity,
    unit_weight_kg,
    unit_volume_cbm,
    length_cm,
    width_cm,
    height_cm,
    is_hazardous,
    hazardous_class,
    un_number,
    is_temperature_controlled,
    temperature_min,
    temperature_max,
    temperature_unit,
    package_category_id,
    package_size_id,
    remarks
  )
  SELECT 
    v_shipment_id,
    p_tenant_id,
    transport_mode,
    cargo_type,
    container_type,
    container_size,
    quantity,
    unit_weight_kg,
    unit_volume_cbm,
    length_cm,
    width_cm,
    height_cm,
    is_hazardous,
    hazardous_class,
    un_number,
    is_temperature_controlled,
    temperature_min,
    temperature_max,
    temperature_unit,
    package_category_id,
    package_size_id,
    remarks
  FROM public.quote_cargo_configurations
  WHERE quote_id = p_quote_id;

  -- 8. Update Shipment Totals
  UPDATE public.shipments
  SET 
    total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM public.shipment_items WHERE shipment_id = v_shipment_id),
    total_volume_cbm = (SELECT COALESCE(SUM(volume_cbm), 0) FROM public.shipment_items WHERE shipment_id = v_shipment_id)
  WHERE id = v_shipment_id;

  RETURN v_shipment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
