CREATE OR REPLACE FUNCTION public.get_all_database_tables()
RETURNS TABLE (
  schema_name text,
  table_name text,
  table_type text,
  rls_enabled boolean,
  policy_count bigint,
  column_count bigint,
  index_count bigint,
  row_estimate bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    n.nspname::text AS schema_name,
    c.relname::text AS table_name,
    CASE 
      WHEN c.relkind = 'r' THEN 'BASE TABLE'
      WHEN c.relkind = 'v' THEN 'VIEW'
      WHEN c.relkind = 'm' THEN 'MATERIALIZED VIEW'
      WHEN c.relkind = 'p' THEN 'PARTITIONED TABLE'
      WHEN c.relkind = 'f' THEN 'FOREIGN TABLE'
      ELSE 'OTHER'
    END::text AS table_type,
    c.relrowsecurity AS rls_enabled,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count,
    (SELECT count(*) FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS column_count,
    (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS index_count,
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions', 'vault')
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND c.relname NOT IN ('spatial_ref_sys')
    AND c.relname NOT LIKE 'pg_%'
  ORDER BY n.nspname, c.relname;
$$;
