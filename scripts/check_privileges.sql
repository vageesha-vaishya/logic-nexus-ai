SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'ports_locations';

SELECT grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_name = 'ports_locations';
