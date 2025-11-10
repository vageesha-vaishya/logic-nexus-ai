-- Extended global seeding: NA/Asia additions requested
-- Adds Canada YYC airport, Mexico terminal variants, and Singapore/Shenzhen port variants
-- All rows are global (tenant_id = NULL) and avoid duplicates via location_code checks.

BEGIN;

-- Canada: YYC
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Calgary International Airport', 'YYC', 'airport', 'Canada', 'Calgary', 'Alberta', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YYC');

-- Mexico: additional terminals for major ports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Manzanillo Terminal (North)', 'MXMZO-T1', 'terminal', 'Mexico', 'Manzanillo', 'Colima', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXMZO-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Veracruz Terminal (Primary)', 'MXVER-T1', 'terminal', 'Mexico', 'Veracruz', 'Veracruz', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXVER-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Lázaro Cárdenas Terminal (APM)', 'MXLZC-T1', 'terminal', 'Mexico', 'Lázaro Cárdenas', 'Michoacán', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXLZC-T1');

-- Altamira: add port + terminals (frequent Mexico coverage)
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Altamira', 'MXATM', 'seaport', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Altamira Terminal (T1)', 'MXATM-T1', 'terminal', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM-T1');

-- Singapore: SGSIN berths/terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 1', 'SGSIN-B1', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 2', 'SGSIN-B2', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B2');

-- Shenzhen: city code variants and sub-ports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Shenzhen', 'CNSZX', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSZX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Shekou Port (Shenzhen)', 'CNSHK', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNSHK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chiwan Port (Shenzhen)', 'CNCWN', 'seaport', 'China', 'Shenzhen', 'Guangdong', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'CNCWN');

COMMIT;