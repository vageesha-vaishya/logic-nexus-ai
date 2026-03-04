
SELECT grantee, privilege_type 
FROM information_schema.role_routine_grants 
WHERE routine_name = 'search_locations';
