-- Seed service types with transportation modes
INSERT INTO public.service_types (name, description, is_active) VALUES
('Air Freight', 'Air cargo transportation services', true),
('Ocean Freight', 'Sea cargo transportation services', true),
('Road Freight', 'Ground transportation by truck', true),
('Rail Freight', 'Railway cargo transportation', true),
('Courier Service', 'Express delivery and courier services', true),
('Warehousing', 'Storage and distribution services', true),
('Customs Clearance', 'Import/export customs processing', true),
('Freight Forwarding', 'Multi-modal logistics coordination', true),
('Moving Services', 'Residential and commercial moving', true)
ON CONFLICT (name) DO NOTHING;

-- Seed services with different shipment types
DO $$
DECLARE
  v_tenant_id uuid := '9e2686ba-ef3c-42df-aea6-dcc880436b9f';
  v_service_id uuid;
  v_exists boolean;
  v_tenant_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = v_tenant_id) INTO v_tenant_exists;
  IF NOT v_tenant_exists THEN
    RETURN;
  END IF;
  -- Insert Air services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Express', 'AIR-EXP', 'Express air freight service', 500.00, 2, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Standard', 'AIR-STD', 'Standard air freight service', 300.00, 5, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'Air Economy', 'AIR-ECO', 'Economy air freight service', 200.00, 7, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Priority', 'USA-AIR-PRI', 'Priority air service within USA', 250.00, 1, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'USA Domestic Air Standard', 'USA-AIR-STD', 'Standard air service within USA', 150.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Express', 'INTL-AIR-EXP', 'Express international air freight', 800.00, 3, true),
  (v_tenant_id, 'air', 'air_freight'::public.shipment_type, 'International Air Standard', 'INTL-AIR-STD', 'Standard international air freight', 500.00, 7, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Ocean services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean FCL', 'OCN-FCL', 'Full Container Load ocean freight', 2000.00, 30, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'Ocean LCL', 'OCN-LCL', 'Less than Container Load ocean freight', 800.00, 35, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean FCL', 'INTL-OCN-FCL', 'International full container ocean freight', 3000.00, 28, true),
  (v_tenant_id, 'ocean', 'ocean_freight'::public.shipment_type, 'International Ocean LCL', 'INTL-OCN-LCL', 'International less than container ocean freight', 1200.00, 35, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Trucking services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Express', 'RD-EXP', 'Express road freight service', 150.00, 3, true),
  (v_tenant_id, 'trucking', 'inland_trucking'::public.shipment_type, 'Road Standard', 'RD-STD', 'Standard road freight service', 100.00, 5, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Courier services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Same Day', 'COR-SAME', 'Same day courier delivery', 50.00, 0, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, 'Next Day', 'COR-NEXT', 'Next day courier delivery', 30.00, 1, true),
  (v_tenant_id, 'courier', 'courier'::public.shipment_type, '2-Day', 'COR-2DAY', '2-day courier delivery', 20.00, 2, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Insert Moving services
  INSERT INTO public.services (tenant_id, service_type, shipment_type, service_name, service_code, description, base_price, transit_time_days, is_active) VALUES
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Local Move', 'MOV-LOCAL', 'Local residential or commercial move', 300.00, 1, true),
  (v_tenant_id, 'moving', 'movers_packers'::public.shipment_type, 'Long Distance Move', 'MOV-LD', 'Long distance moving service', 1500.00, 5, true)
  ON CONFLICT (tenant_id, service_code) DO NOTHING;

  -- Create service type mappings (check existence first)
  -- USA Domestic Air Priority mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'USA-AIR-PRI' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'air' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'air', v_service_id, false, 1, true, '{"scope": "domestic", "country": "USA"}'::jsonb);
    END IF;
  END IF;

  -- International Air Express mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'INTL-AIR-EXP' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'air' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'air', v_service_id, true, 1, true, '{"scope": "international"}'::jsonb);
    END IF;
  END IF;

  -- International Ocean FCL mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'INTL-OCN-FCL' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'ocean' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'ocean', v_service_id, true, 1, true, '{"scope": "international", "container_type": "FCL"}'::jsonb);
    END IF;
  END IF;
  
  -- Courier Next Day mapping
  SELECT id INTO v_service_id FROM public.services WHERE service_code = 'COR-NEXT' AND tenant_id = v_tenant_id LIMIT 1;
  IF v_service_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.service_type_mappings WHERE tenant_id = v_tenant_id AND service_type = 'courier' AND service_id = v_service_id) INTO v_exists;
    IF NOT v_exists THEN
      INSERT INTO public.service_type_mappings (tenant_id, service_type, service_id, is_default, priority, is_active, conditions) VALUES
      (v_tenant_id, 'courier', v_service_id, true, 1, true, '{"scope": "express"}'::jsonb);
    END IF;
  END IF;
END $$;
