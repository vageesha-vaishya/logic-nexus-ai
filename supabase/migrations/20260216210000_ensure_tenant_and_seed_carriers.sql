
-- Ensure a default tenant exists
DO $$
DECLARE
    v_logistics_domain_id uuid;
BEGIN
    -- Get the ID for the 'logistics' domain (case-insensitive check on code)
    SELECT id INTO v_logistics_domain_id 
    FROM public.platform_domains 
    WHERE lower(code) = 'logistics' 
    LIMIT 1;

    -- If we found the domain ID, insert the tenant
    IF v_logistics_domain_id IS NOT NULL THEN
        INSERT INTO public.tenants (name, slug, domain_id)
        VALUES ('SOS Services', 'sos-services', v_logistics_domain_id)
        ON CONFLICT (slug) DO NOTHING; -- Explicitly target the unique constraint on slug
    ELSE
        -- Fallback: Try to insert without domain_id if the column isn't strictly required yet
        -- (This handles cases where platform_domains might be empty or misconfigured)
        BEGIN
            INSERT INTO public.tenants (name, slug)
            VALUES ('SOS Services', 'sos-services')
            ON CONFLICT (slug) DO NOTHING;
        EXCEPTION WHEN not_null_violation THEN
            -- If domain_id is NOT NULL, we must have a domain. 
            -- Attempt to create the logistics domain first.
            INSERT INTO public.platform_domains (code, name, description)
            VALUES ('LOGISTICS', 'Logistics', 'Logistics and Supply Chain Management')
            ON CONFLICT (code) DO UPDATE SET code=EXCLUDED.code -- Ensure we get the ID even if it exists
            RETURNING id INTO v_logistics_domain_id;
            
            -- If RETURNING didn't give us an ID (because of DO UPDATE not returning in some contexts or race condition), fetch it again
            IF v_logistics_domain_id IS NULL THEN
                 SELECT id INTO v_logistics_domain_id FROM public.platform_domains WHERE lower(code) = 'logistics';
            END IF;

            INSERT INTO public.tenants (name, slug, domain_id)
            VALUES ('SOS Services', 'sos-services', v_logistics_domain_id)
            ON CONFLICT (slug) DO NOTHING;
        END;
    END IF;
END $$;

-- Seed Carriers for all tenants
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM public.tenants LOOP
        -- Ocean Carriers
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'Maersk', 'ocean', 'ocean', 'MAEU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Maersk');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'MSC', 'ocean', 'ocean', 'MSCU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'MSC');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'CMA CGM', 'ocean', 'ocean', 'CMACGM', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'CMA CGM');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'Hapag-Lloyd', 'ocean', 'ocean', 'HLCU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Hapag-Lloyd');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'COSCO', 'ocean', 'ocean', 'COSU', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'COSCO');

        -- Air Carriers
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, iata, is_active)
        SELECT t.id, 'Lufthansa Cargo', 'air_cargo', 'air', 'LH', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Lufthansa Cargo');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, iata, is_active)
        SELECT t.id, 'Emirates SkyCargo', 'air_cargo', 'air', 'EK', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Emirates SkyCargo');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, iata, is_active)
        SELECT t.id, 'FedEx Express', 'air_cargo', 'air', 'FX', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'FedEx Express');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, iata, is_active)
        SELECT t.id, 'DHL Aviation', 'air_cargo', 'air', 'D0', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'DHL Aviation');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, iata, is_active)
        SELECT t.id, 'Cathay Pacific Cargo', 'air_cargo', 'air', 'CX', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Cathay Pacific Cargo');

        -- Trucking
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'J.B. Hunt', 'trucking', 'inland_trucking', 'JBHT', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'J.B. Hunt');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'XPO Logistics', 'trucking', 'inland_trucking', 'XPO', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'XPO Logistics');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, scac, is_active)
        SELECT t.id, 'Schneider', 'trucking', 'inland_trucking', 'SNDR', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Schneider');

        -- Rail
        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, is_active)
        SELECT t.id, 'Union Pacific', 'rail', 'rail', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'Union Pacific');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, is_active)
        SELECT t.id, 'CSX', 'rail', 'rail', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'CSX');

        INSERT INTO public.carriers (tenant_id, carrier_name, carrier_type, mode, is_active)
        SELECT t.id, 'BNSF', 'rail', 'rail', true
        WHERE NOT EXISTS (SELECT 1 FROM public.carriers WHERE tenant_id = t.id AND carrier_name = 'BNSF');

    END LOOP;
END $$;
