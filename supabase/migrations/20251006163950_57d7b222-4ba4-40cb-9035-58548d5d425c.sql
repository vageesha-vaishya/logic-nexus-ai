-- Create function to get detailed database schema
CREATE OR REPLACE FUNCTION public.get_database_schema()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  is_primary_key boolean,
  is_foreign_key boolean,
  references_table text,
  references_column text
)
AS $$
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable,
    c.column_default::text,
    CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
    CASE WHEN kcu2.table_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
    kcu2.table_name::text as references_table,
    kcu2.column_name::text as references_column
  FROM information_schema.columns c
  LEFT JOIN information_schema.key_column_usage kcu 
    ON c.table_name = kcu.table_name 
    AND c.column_name = kcu.column_name
    AND c.table_schema = kcu.table_schema
  LEFT JOIN information_schema.table_constraints tc 
    ON kcu.constraint_name = tc.constraint_name
    AND kcu.table_schema = tc.table_schema
  LEFT JOIN information_schema.referential_constraints rc 
    ON rc.constraint_name = kcu.constraint_name
    AND rc.constraint_schema = kcu.table_schema
  LEFT JOIN information_schema.key_column_usage kcu2 
    ON rc.unique_constraint_name = kcu2.constraint_name
    AND rc.unique_constraint_schema = kcu2.table_schema
  WHERE c.table_schema = 'public'
    AND c.table_name NOT IN ('spatial_ref_sys')
  ORDER BY c.table_name, c.ordinal_position;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Create function to get database tables overview
CREATE OR REPLACE FUNCTION public.get_database_tables()
RETURNS TABLE (
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
    t.tablename::text AS table_name,
    'BASE TABLE'::text AS table_type,
    c.relrowsecurity AS rls_enabled,
    COUNT(DISTINCT p.policyname) AS policy_count,
    COUNT(DISTINCT a.attname) AS column_count,
    COUNT(DISTINCT i.indexrelid) AS index_count,
    c.reltuples::bigint AS row_estimate
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
  LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
  LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_index i ON i.indrelid = c.oid
  WHERE t.schemaname = 'public'
  GROUP BY t.tablename, c.relrowsecurity, c.reltuples
  ORDER BY t.tablename;
$$;

-- Create function to get table constraints
CREATE OR REPLACE FUNCTION public.get_table_constraints()
RETURNS TABLE (
  table_name text,
  constraint_name text,
  constraint_type text,
  constraint_details text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tc.table_name::text,
    tc.constraint_name::text,
    tc.constraint_type::text,
    COALESCE(
      string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position),
      cc.check_clause
    )::text AS constraint_details
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
    AND tc.table_name = kcu.table_name
  LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
  WHERE tc.table_schema = 'public'
  GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type, cc.check_clause
  ORDER BY tc.table_name, tc.constraint_name;
$$;

-- Create function to get table indexes
CREATE OR REPLACE FUNCTION public.get_table_indexes()
RETURNS TABLE (
  table_name text,
  index_name text,
  is_unique boolean,
  index_columns text,
  index_definition text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.relname::text AS table_name,
    i.relname::text AS index_name,
    ix.indisunique AS is_unique,
    string_agg(a.attname, ', ' ORDER BY array_position(ix.indkey, a.attnum))::text AS index_columns,
    pg_get_indexdef(ix.indexrelid)::text AS index_definition
  FROM pg_index ix
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  WHERE n.nspname = 'public'
    AND t.relkind = 'r'
  GROUP BY t.relname, i.relname, ix.indisunique, ix.indexrelid
  ORDER BY t.relname, i.relname;
$$;