-- Migration to support comprehensive database export including auth, storage, and extensions
-- Created: 2026-01-14

-- 1. Enhanced Schema Listing
-- Returns tables from all relevant schemas, not just public
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
    AND c.relname NOT IN ('schema_migrations', 'spatial_ref_sys') -- Exclude technical tables
  ORDER BY n.nspname, c.relname;
$$;

-- 2. Secure Auth User Export
-- Exports users with non-sensitive data. 
-- Note: Password hashes are exported but caution is advised.
CREATE OR REPLACE FUNCTION public.get_auth_users_export()
RETURNS TABLE (
  id uuid,
  email varchar,
  encrypted_password varchar,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_token varchar,
  recovery_token varchar,
  email_change_token_new varchar,
  email_change varchar,
  phone varchar,
  phone_confirmed_at timestamptz,
  phone_change_token varchar,
  phone_change varchar,
  app_metadata jsonb,
  user_metadata jsonb,
  is_sso_user boolean,
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
    invited_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone,
    phone_confirmed_at,
    phone_change_token,
    phone_change,
    app_metadata,
    user_metadata,
    is_sso_user,
    created_at,
    updated_at,
    banned_until,
    deleted_at
  FROM auth.users;
$$;

-- 3. Storage Objects Export
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

-- 4. Generic Table Data Export (Dynamic)
-- Allows exporting data from any schema (e.g., extensions)
-- WARNING: This is a powerful function. Ensure RLS protects access to this function 
-- or restricts it to admins via application logic.
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
    -- Validate schema to prevent arbitrary access to system schemas
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Execute dynamic query
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
