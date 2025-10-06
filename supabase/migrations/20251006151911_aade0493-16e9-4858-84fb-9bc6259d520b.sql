-- Create functions for security overview page

-- Function to get all database enums
CREATE OR REPLACE FUNCTION public.get_database_enums()
RETURNS TABLE (
  enum_type text,
  labels text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.typname::text AS enum_type,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)::text AS labels
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.typname
  ORDER BY t.typname;
$$;

-- Function to get RLS status for all tables
CREATE OR REPLACE FUNCTION public.get_rls_status()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    COUNT(p.policyname) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  GROUP BY c.relname, c.relrowsecurity
  ORDER BY c.relname;
$$;

-- Function to get all RLS policies
CREATE OR REPLACE FUNCTION public.get_rls_policies()
RETURNS TABLE (
  table_name text,
  policy_name text,
  command text,
  roles text,
  using_expression text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tablename::text AS table_name,
    policyname::text AS policy_name,
    cmd::text AS command,
    roles::text,
    COALESCE(qual, with_check)::text AS using_expression
  FROM pg_policies
  WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
$$;