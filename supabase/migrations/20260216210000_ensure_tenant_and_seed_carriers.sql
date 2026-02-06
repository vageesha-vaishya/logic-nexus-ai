
-- Ensure a default tenant exists
INSERT INTO public.tenants (name, slug, status, domain_type)
VALUES ('SOS Services', 'sos-services', 'active', 'logistics')
ON CONFLICT DO NOTHING;

-- Seed Carriers for all tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        -- Ocean Carriers
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'Maersk', 'ocean', 'MAEU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Maersk');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'MSC', 'ocean', 'MSCU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'MSC');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'CMA CGM', 'ocean', 'CMACGM', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'CMA CGM');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'Hapag-Lloyd', 'ocean', 'HLCU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Hapag-Lloyd');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'COSCO', 'ocean', 'COSU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'COSCO');

        -- Air Carriers
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, is_active)
        SELECT t.id, 'Lufthansa Cargo', 'air_cargo', 'LH', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Lufthansa Cargo');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, is_active)
        SELECT t.id, 'Emirates SkyCargo', 'air_cargo', 'EK', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Emirates SkyCargo');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, is_active)
        SELECT t.id, 'FedEx Express', 'air_cargo', 'FX', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'FedEx Express');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, is_active)
        SELECT t.id, 'DHL Aviation', 'air_cargo', 'D0', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'DHL Aviation');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, iata, is_active)
        SELECT t.id, 'Cathay Pacific Cargo', 'air_cargo', 'CX', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Cathay Pacific Cargo');

        -- Trucking
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'J.B. Hunt', 'trucking', 'JBHT', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'J.B. Hunt');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'XPO Logistics', 'trucking', 'XPO', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'XPO Logistics');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, scac, is_active)
        SELECT t.id, 'Schneider', 'trucking', 'SNDR', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Schneider');

        -- Rail
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, is_active)
        SELECT t.id, 'Union Pacific', 'rail', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Union Pacific');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, is_active)
        SELECT t.id, 'CSX', 'rail', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'CSX');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, is_active)
        SELECT t.id, 'BNSF', 'rail', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'BNSF');

    END LOOP;
END $$;
