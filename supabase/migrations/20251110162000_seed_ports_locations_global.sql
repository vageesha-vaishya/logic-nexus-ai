-- Allow global ports (tenant_id NULL) and seed USA/India
-- This migration:
-- 1) Makes tenant_id nullable on ports_locations
-- 2) Adds a SELECT policy to expose global rows (tenant_id IS NULL)
-- 3) Seeds global ports/airports/terminals for USA and India

BEGIN;

-- 1) Make tenant_id nullable to support global entries
ALTER TABLE public.ports_locations
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 2) RLS: allow all authenticated users to view global ports
-- Existing policies restrict SELECT to tenant rows; this adds visibility for global rows.
DROP POLICY IF EXISTS "Users can view global ports" ON public.ports_locations;
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

-- USA Seaports (UN/LOCODE approximations)
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

-- USA Inland/Terminals/Warehouses
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

-- India Seaports (UN/LOCODE approximations)
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

-- India Inland/Terminals/Warehouses
INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Tughlakabad', 'INTKD', 'terminal', 'India', 'Delhi', 'Delhi', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INTKD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'ICD Whitefield', 'INWFD', 'terminal', 'India', 'Bengaluru', 'Karnataka', TRUE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INWFD');

INSERT INTO public.ports_locations (tenant_id, location_name, location_code, location_type, country, city, state_province, customs_available, is_active, notes)
SELECT NULL, 'Mumbai Logistics Park', 'INMBWH', 'warehouse', 'India', 'Mumbai', 'Maharashtra', FALSE, TRUE, 'Global seed'
WHERE NOT EXISTS (SELECT 1 FROM public.ports_locations WHERE tenant_id IS NULL AND location_code = 'INMBWH');

COMMIT;
