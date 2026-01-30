-- Function to get exact table count for any schema
DROP FUNCTION IF EXISTS public.get_table_count(text, text) CASCADE;
CREATE OR REPLACE FUNCTION public.get_table_count(target_schema text, target_table text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    row_count bigint;
    query text;
BEGIN
    IF NOT (target_schema ~ '^[a-zA-Z0-9_]+$') OR NOT (target_table ~ '^[a-zA-Z0-9_]+$') THEN
        RAISE EXCEPTION 'Invalid schema or table name';
    END IF;
    query := format('SELECT count(*) FROM %I.%I', target_schema, target_table);
    EXECUTE query INTO row_count;
    RETURN row_count;
EXCEPTION
    WHEN OTHERS THEN
        RETURN -1;
END;
$$;

-- Create function to get detailed database schema
DROP FUNCTION IF EXISTS public.get_all_database_schema() CASCADE;
CREATE OR REPLACE FUNCTION public.get_all_database_schema()
RETURNS TABLE (
  schema_name text,
  table_name text,
  column_name text,
  data_type text,
  is_nullable boolean,
  column_default text,
  is_primary_key boolean,
  is_foreign_key boolean,
  references_schema text,
  references_table text,
  references_column text
)
AS $$
  SELECT 
    c.table_schema::text,
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as is_nullable,
    c.column_default::text,
    CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key,
    CASE WHEN kcu2.table_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
    kcu2.table_schema::text as references_schema,
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
  WHERE c.table_schema IN ('public', 'auth', 'storage', 'extensions', 'vault')
    AND c.table_name NOT IN ('spatial_ref_sys')
  ORDER BY c.table_schema, c.table_name, c.ordinal_position;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Returns tables from all relevant schemas
DROP FUNCTION IF EXISTS public.get_all_database_tables() CASCADE; -- Drop the 0-arg overload if it exists
DROP FUNCTION IF EXISTS public.get_all_database_tables(text[]) CASCADE;
CREATE OR REPLACE FUNCTION public.get_all_database_tables(schemas text[] DEFAULT ARRAY['public', 'auth', 'storage', 'extensions'])
RETURNS TABLE (
  schema_name text,
  table_name text,
  table_type text,
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
    c.reltuples::bigint AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = ANY(schemas)
    AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
    AND c.relname NOT IN ('schema_migrations', 'spatial_ref_sys')
  ORDER BY n.nspname, c.relname;
$$;

-- Auth User Export (using actual auth.users columns)
DROP FUNCTION IF EXISTS public.get_auth_users_export() CASCADE;
CREATE OR REPLACE FUNCTION public.get_auth_users_export()
RETURNS TABLE (
  id uuid,
  email varchar,
  encrypted_password varchar,
  email_confirmed_at timestamptz,
  phone varchar,
  phone_confirmed_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    phone,
    phone_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    banned_until,
    deleted_at
  FROM auth.users;
$$;

-- Storage Objects Export
DROP FUNCTION IF EXISTS public.get_storage_objects_export() CASCADE;
CREATE OR REPLACE FUNCTION public.get_storage_objects_export()
RETURNS TABLE (
  id uuid,
  bucket_id text,
  name text,
  owner uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_accessed_at timestamptz,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    bucket_id,
    name,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata
  FROM storage.objects;
$$;

-- Generic Table Data Export (Dynamic)
DROP FUNCTION IF EXISTS public.get_table_data_dynamic(text, text, int, int) CASCADE;
CREATE OR REPLACE FUNCTION public.get_table_data_dynamic(
    target_schema text, 
    target_table text, 
    offset_val int DEFAULT 0, 
    limit_val int DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;
    EXECUTE format(
        'SELECT jsonb_agg(t) FROM (SELECT * FROM %I.%I OFFSET %s LIMIT %s) t',
        target_schema,
        target_table,
        offset_val,
        limit_val
    ) INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;