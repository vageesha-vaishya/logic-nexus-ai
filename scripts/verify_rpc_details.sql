
-- Verify search_locations RPC definition and behavior
BEGIN;

-- 1. Check RPC definition
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as result_type,
    p.prosecdef as security_definer, -- t = security definer, f = security invoker
    prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'search_locations';

-- 2. Call the function directly (simulate RPC)
SELECT * FROM search_locations('Dehra Dun', 10);

-- 3. Check for duplicates or similar names
SELECT id, location_name, location_code, location_type, city, country 
FROM ports_locations 
WHERE location_name ILIKE '%Dehra Dun%';

ROLLBACK;
