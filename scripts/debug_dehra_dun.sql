
-- Check ports_locations columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ports_locations'
ORDER BY ordinal_position;

-- Check Dehra Dun data
SELECT * FROM ports_locations 
WHERE location_name ILIKE '%Dehra%' 
   OR city ILIKE '%Dehra%'
   OR location_code ILIKE 'DDN';

-- Test RPC
SELECT * FROM search_locations('Dehra', 5);
