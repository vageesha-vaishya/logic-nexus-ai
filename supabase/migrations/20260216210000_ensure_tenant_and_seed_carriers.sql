
-- Ensure a default tenant exists
DO $$
DECLARE
  v_domain_id UUID;
BEGIN
  -- Attempt to find existing domain_id for 'logistics'
  SELECT id INTO v_domain_id FROM public.platform_domains WHERE code = 'logistics' LIMIT 1;

  -- If not found, create it (idempotent safety)
  IF v_domain_id IS NULL THEN
    INSERT INTO public.platform_domains (code, name, description, is_active)
    VALUES ('logistics', 'Logistics & Freight', 'Core logistics domain', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_domain_id;
  END IF;

  -- Insert tenant with correct columns
  -- status -> is_active (boolean)
  -- domain_type -> domain_id (UUID)
  INSERT INTO public.tenants (name, slug, is_active, domain_id)
  VALUES ('SOS Services', 'sos-services', true, v_domain_id)
  ON CONFLICT DO NOTHING;
END $$;

-- Seed Global Carriers (tenant_id IS NULL)
-- This ensures we have a standard set of carriers available globally.
-- We check for existence by name (case-insensitive) to avoid unique constraint violations.

DO $$
BEGIN
    -- Ocean Carriers
    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'Maersk', 'ocean', 'MAEU', 'ocean', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('Maersk')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'MSC', 'ocean', 'MSCU', 'ocean', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('MSC')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'CMA CGM', 'ocean', 'CMACGM', 'ocean', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('CMA CGM')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'Hapag-Lloyd', 'ocean', 'HLCU', 'ocean', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('Hapag-Lloyd')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'COSCO', 'ocean', 'COSU', 'ocean', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('COSCO')));

    -- Air Carriers
    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, mode, is_active)
    SELECT NULL, 'Lufthansa Cargo', 'air_cargo', 'LH', 'air', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('Lufthansa Cargo')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, mode, is_active)
    SELECT NULL, 'Emirates SkyCargo', 'air_cargo', 'EK', 'air', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('Emirates SkyCargo')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, mode, is_active)
    SELECT NULL, 'FedEx Express', 'air_cargo', 'FX', 'air', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('FedEx Express')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, mode, is_active)
    SELECT NULL, 'DHL Aviation', 'air_cargo', 'D0', 'air', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('DHL Aviation')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, mode, is_active)
    SELECT NULL, 'Cathay Pacific Cargo', 'air_cargo', 'CX', 'air', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('Cathay Pacific Cargo')));

    -- Trucking
    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'J.B. Hunt', 'trucking', 'JBHT', 'inland_trucking', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('J.B. Hunt')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'XPO Logistics', 'trucking', 'XPO', 'inland_trucking', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('XPO Logistics')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, mode, is_active)
    SELECT NULL, 'Schneider', 'trucking', 'SNDR', 'inland_trucking', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('Schneider')));

    -- Rail
    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, is_active)
    SELECT NULL, 'Union Pacific', 'rail', 'rail', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('Union Pacific')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, is_active)
    SELECT NULL, 'CSX', 'rail', 'rail', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('CSX')));

    INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, is_active)
    SELECT NULL, 'BNSF', 'rail', 'rail', true
    WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE lower(trim(carrier_name)) = lower(trim('BNSF')));

END $$;
