
-- Check for Dehra Dun and Mumbai (mum) in ports_locations using correct columns
SELECT 
    id, 
    location_name, 
    location_code, 
    is_ocean_port, 
    is_airport, 
    is_icd 
FROM ports_locations 
WHERE location_name ILIKE '%Dehra Dun%' 
   OR location_name ILIKE '%Mumbai%'
   OR location_code ILIKE '%MUM%';
