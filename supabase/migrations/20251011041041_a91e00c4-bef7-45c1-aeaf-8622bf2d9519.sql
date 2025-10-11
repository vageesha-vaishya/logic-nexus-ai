-- Seed carriers with SCAC/IATA codes and map to service types per tenant
BEGIN;

-- Common tenants CTE for Ocean carriers (SCAC)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, scac)
SELECT t.tenant_id, 'ocean', c.name, c.scac
FROM tenants t
CROSS JOIN (
  VALUES
    ('Maersk', 'MAEU'),
    ('MSC', 'MSCU'),
    ('CMA CGM', 'CMDU'),
    ('Hapag-Lloyd', 'HLCU'),
    ('COSCO', 'COSU')
) AS c(name, scac)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'ocean'
);

-- Air carriers (IATA)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, iata)
SELECT t.tenant_id, 'air', c.name, c.iata
FROM tenants t
CROSS JOIN (
  VALUES
    ('American Airlines Cargo', 'AA'),
    ('Delta Cargo', 'DL'),
    ('United Cargo', 'UA'),
    ('Lufthansa Cargo', 'LH'),
    ('Emirates SkyCargo', 'EK')
) AS c(name, iata)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'air'
);

-- Courier carriers (SCAC)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, scac)
SELECT t.tenant_id, 'courier', c.name, c.scac
FROM tenants t
CROSS JOIN (
  VALUES
    ('DHL Express', 'DHLA'),
    ('FedEx', 'FDXG'),
    ('UPS', 'UPSN')
) AS c(name, scac)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'courier'
);

-- Inland trucking carriers (MC/DOT)
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name, mc_dot)
SELECT t.tenant_id, 'inland_trucking', c.name, c.mc_dot
FROM tenants t
CROSS JOIN (
  VALUES
    ('Schneider National', 'DOT-264184'),
    ('J.B. Hunt', 'DOT-223911'),
    ('XPO Logistics', 'DOT-218683'),
    ('R+L Carriers', 'DOT-437075'),
    ('Old Dominion Freight Line', 'DOT-90849')
) AS c(name, mc_dot)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'inland_trucking'
);

-- Movers/Packers
WITH tenants AS (
  SELECT id AS tenant_id FROM public.tenants
)
INSERT INTO public.carriers (tenant_id, mode, carrier_name)
SELECT t.tenant_id, 'movers_packers', c.name
FROM tenants t
CROSS JOIN (
  VALUES
    ('Allied Van Lines'),
    ('North American Van Lines'),
    ('United Van Lines')
) AS c(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.carriers x
  WHERE x.tenant_id = t.tenant_id AND x.carrier_name = c.name AND x.mode = 'movers_packers'
);

-- Map carriers to service_types with code metadata
-- Ocean → ocean (SCAC)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'ocean', 'SCAC', c.scac, true, true
FROM public.carriers c
WHERE c.mode = 'ocean' AND c.scac IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Air → air (IATA)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'air', 'IATA', c.iata, true, true
FROM public.carriers c
WHERE c.mode = 'air' AND c.iata IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Courier → courier (SCAC)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'courier', 'SCAC', c.scac, true, true
FROM public.carriers c
WHERE c.mode = 'courier' AND c.scac IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Inland trucking → trucking (MC_DOT)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, code_type, code_value, is_primary, is_active)
SELECT c.tenant_id, c.id, 'trucking', 'MC_DOT', c.mc_dot, true, true
FROM public.carriers c
WHERE c.mode = 'inland_trucking' AND c.mc_dot IS NOT NULL
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

-- Movers/Packers → moving (no code)
INSERT INTO public.carrier_service_types (tenant_id, carrier_id, service_type, is_primary, is_active)
SELECT c.tenant_id, c.id, 'moving', true, true
FROM public.carriers c
WHERE c.mode = 'movers_packers'
ON CONFLICT (tenant_id, carrier_id, service_type) DO NOTHING;

COMMIT;