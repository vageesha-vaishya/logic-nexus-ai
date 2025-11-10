-- Migration 1: Allow global ports (tenant_id NULL) and seed USA/India
-- Makes tenant_id nullable, adds RLS policy, seeds USA and India ports

BEGIN;

-- 1) Make tenant_id nullable to support global entries
ALTER TABLE public.ports_locations
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2) RLS: allow all authenticated users to view global ports
CREATE POLICY "Users can view global ports"
  ON public.ports_locations FOR SELECT
  USING (tenant_id IS NULL);

-- 3) Seed global entries (tenant_id = NULL)
-- USA Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Los Angeles International Airport', 'LAX', 'airport', 'USA', 'Los Angeles', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'LAX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'John F. Kennedy International Airport', 'JFK', 'airport', 'USA', 'New York', 'New York', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'JFK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'O''Hare International Airport', 'ORD', 'airport', 'USA', 'Chicago', 'Illinois', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'ORD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'San Francisco International Airport', 'SFO', 'airport', 'USA', 'San Francisco', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SFO');

-- USA Seaports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Los Angeles', 'USLAX', 'seaport', 'USA', 'Los Angeles', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLAX');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Long Beach', 'USLGB', 'seaport', 'USA', 'Long Beach', 'California', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLGB');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of New York and New Jersey', 'USNYC', 'seaport', 'USA', 'New York', 'New York', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USNYC');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Savannah', 'USSAV', 'seaport', 'USA', 'Savannah', 'Georgia', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USSAV');

-- USA Inland/Terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chicago Inland Port', 'USCHI', 'inland_port', 'USA', 'Chicago', 'Illinois', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USCHI');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Newark Port Terminal', 'USNWK', 'terminal', 'USA', 'Newark', 'New Jersey', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USNWK');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Los Angeles Logistics Hub', 'USLAWH', 'warehouse', 'USA', 'Los Angeles', 'California', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'USLAWH');

-- India Airports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Indira Gandhi International Airport', 'DEL', 'airport', 'India', 'Delhi', 'Delhi', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'DEL');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chhatrapati Shivaji Maharaj International Airport', 'BOM', 'airport', 'India', 'Mumbai', 'Maharashtra', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'BOM');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chennai International Airport', 'MAA', 'airport', 'India', 'Chennai', 'Tamil Nadu', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MAA');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Kempegowda International Airport', 'BLR', 'airport', 'India', 'Bengaluru', 'Karnataka', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'BLR');

-- India Seaports
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Jawaharlal Nehru Port (Nhava Sheva)', 'INJNP', 'seaport', 'India', 'Navi Mumbai', 'Maharashtra', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INJNP');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Chennai Port', 'INMAA', 'seaport', 'India', 'Chennai', 'Tamil Nadu', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMAA');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mundra Port', 'INMUN', 'seaport', 'India', 'Mundra', 'Gujarat', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMUN');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Kolkata Port', 'INCCU', 'seaport', 'India', 'Kolkata', 'West Bengal', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INCCU');

-- India Inland/Terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Tughlakabad', 'INTKD', 'terminal', 'India', 'Delhi', 'Delhi', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INTKD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Whitefield', 'INWFD', 'terminal', 'India', 'Bengaluru', 'Karnataka', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INWFD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mumbai Logistics Park', 'INMBWH', 'warehouse', 'India', 'Mumbai', 'Maharashtra', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMBWH');

-- Migration 2: North America and Asia ports
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

-- Canada Seaports
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

-- Mexico Seaports
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

-- Migration 3: Extended additions
-- Canada: YYC
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Calgary International Airport', 'YYC', 'airport', 'Canada', 'Calgary', 'Alberta', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'YYC');

-- Mexico: additional terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Manzanillo Terminal (North)', 'MXMZO-T1', 'terminal', 'Mexico', 'Manzanillo', 'Colima', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXMZO-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Veracruz Terminal (Primary)', 'MXVER-T1', 'terminal', 'Mexico', 'Veracruz', 'Veracruz', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXVER-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Lázaro Cárdenas Terminal (APM)', 'MXLZC-T1', 'terminal', 'Mexico', 'Lázaro Cárdenas', 'Michoacán', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXLZC-T1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Port of Altamira', 'MXATM', 'seaport', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Altamira Terminal (T1)', 'MXATM-T1', 'terminal', 'Mexico', 'Altamira', 'Tamaulipas', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'MXATM-T1');

-- Singapore terminals
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 1', 'SGSIN-B1', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B1');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, customs_available, is_active, notes)
SELECT NULL, 'Singapore PSA Berth 2', 'SGSIN-B2', 'terminal', 'Singapore', 'Singapore', TRUE, TRUE, 'Global seed (extended)'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'SGSIN-B2');

-- Shenzhen variants
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