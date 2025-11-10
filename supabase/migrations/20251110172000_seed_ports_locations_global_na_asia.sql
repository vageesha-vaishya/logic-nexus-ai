-- Global ports/airports seeding for North America and Asia
-- Adds major hubs for Canada, Mexico, Hong Kong, Singapore, China, Japan, South Korea, UAE
-- All rows are tenant-neutral (tenant_id = NULL) and de-duplicated by location_code.

BEGIN;

-- Canada Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Toronto Pearson International Airport', 'YYZ', 'airport', 'Canada', 'Toronto', 'Ontario', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YYZ');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Vancouver International Airport', 'YVR', 'airport', 'Canada', 'Vancouver', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YVR');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Montréal–Trudeau International Airport', 'YUL', 'airport', 'Canada', 'Montréal', 'Quebec', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YUL');

-- Canada Seaports (UN/LOCODE approximations)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Vancouver', 'CAVAN', 'seaport', 'Canada', 'Vancouver', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAVAN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Montréal', 'CAMTR', 'seaport', 'Canada', 'Montréal', 'Quebec', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAMTR');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Prince Rupert', 'CAPRR', 'seaport', 'Canada', 'Prince Rupert', 'British Columbia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CAPRR');

-- Mexico Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mexico City International Airport', 'MEX', 'airport', 'Mexico', 'Mexico City', 'Mexico City', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MEX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Monterrey International Airport', 'MTY', 'airport', 'Mexico', 'Monterrey', 'Nuevo León', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MTY');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Guadalajara International Airport', 'GDL', 'airport', 'Mexico', 'Guadalajara', 'Jalisco', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'GDL');

-- Mexico Seaports (UN/LOCODE approximations)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Manzanillo', 'MXMZO', 'seaport', 'Mexico', 'Manzanillo', 'Colima', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXMZO');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Veracruz', 'MXVER', 'seaport', 'Mexico', 'Veracruz', 'Veracruz', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXVER');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Lázaro Cárdenas', 'MXLZC', 'seaport', 'Mexico', 'Lázaro Cárdenas', 'Michoacán', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXLZC');

-- Hong Kong
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Hong Kong International Airport', 'HKG', 'airport', 'Hong Kong', 'Hong Kong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HKG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Hong Kong', 'HKHKG', 'seaport', 'Hong Kong', 'Hong Kong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HKHKG');

-- Singapore
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore Changi Airport', 'SIN', 'airport', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SIN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Singapore', 'SGSIN', 'seaport', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN');

-- China
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Shanghai Pudong International Airport', 'PVG', 'airport', 'China', 'Shanghai', 'Shanghai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'PVG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Beijing Capital International Airport', 'PEK', 'airport', 'China', 'Beijing', 'Beijing', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'PEK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Shanghai', 'CNSHG', 'seaport', 'China', 'Shanghai', 'Shanghai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSHG');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Ningbo-Zhoushan', 'CNNGB', 'seaport', 'China', 'Ningbo', 'Zhejiang', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNNGB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Yantian (Shenzhen)', 'CNYTN', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNYTN');

-- Japan
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Tokyo Narita International Airport', 'NRT', 'airport', 'Japan', 'Tokyo', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'NRT');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Tokyo Haneda Airport', 'HND', 'airport', 'Japan', 'Tokyo', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'HND');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Yokohama', 'JPYOK', 'seaport', 'Japan', 'Yokohama', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'JPYOK');

-- South Korea
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Incheon International Airport', 'ICN', 'airport', 'South Korea', 'Incheon', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'ICN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Busan', 'KRPUS', 'seaport', 'South Korea', 'Busan', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'KRPUS');

-- United Arab Emirates
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Dubai International Airport', 'DXB', 'airport', 'United Arab Emirates', 'Dubai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'DXB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Port of Jebel Ali', 'AEJEA', 'seaport', 'United Arab Emirates', 'Dubai', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'AEJEA');

COMMIT;