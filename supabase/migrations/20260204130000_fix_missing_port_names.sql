-- Fix missing location names in ports_locations table
-- Some records have blank location_name fields. This migration populates them.

-- 1. Fix specific known missing names based on location_code
UPDATE public.ports_locations 
SET location_name = 'Port of Seattle' 
WHERE location_code = 'USSEA' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'Seattle Rail Terminal' 
WHERE location_code = 'USSEA-RL' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'Port of Tacoma' 
WHERE location_code = 'USTAC' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'San Francisco International Airport' 
WHERE location_code = 'SFO' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'Port of Oakland' 
WHERE location_code = 'USOAK' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'Portland Rail Terminal' 
WHERE location_code = 'USPDX-RL' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'Portland International Airport' 
WHERE location_code = 'PDX' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'Port of Portland' 
WHERE location_code = 'USPDX' AND (location_name IS NULL OR location_name = '');

UPDATE public.ports_locations 
SET location_name = 'Seattle-Tacoma International Airport' 
WHERE location_code = 'SEA' AND (location_name IS NULL OR location_name = '');

-- 2. Generic fallback for any other missing names
-- Construct name from City + Type (e.g. "Seattle Seaport")
UPDATE public.ports_locations 
SET location_name = city || ' ' || INITCAP(REPLACE(location_type, '_', ' '))
WHERE (location_name IS NULL OR location_name = '') 
  AND city IS NOT NULL 
  AND location_type IS NOT NULL;

-- 3. Last resort fallback if city is missing
UPDATE public.ports_locations 
SET location_name = 'Unknown Location (' || location_code || ')'
WHERE (location_name IS NULL OR location_name = '') 
  AND location_code IS NOT NULL;
