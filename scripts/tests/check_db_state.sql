-- Check finance schema tables
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema = 'finance';

-- Check platform_domains constraints
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.platform_domains'::regclass;
