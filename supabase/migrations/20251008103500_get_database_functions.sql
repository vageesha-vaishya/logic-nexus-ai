-- Create function to list implemented database functions and procedures in public schema
CREATE OR REPLACE FUNCTION public.get_database_functions()
RETURNS TABLE (
  name text,
  schema text,
  kind text,
  return_type text,
  argument_types text,
  language text,
  volatility text,
  security_definer boolean,
  description text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.proname::text AS name,
    n.nspname::text AS schema,
    CASE p.prokind 
      WHEN 'f' THEN 'function' 
      WHEN 'p' THEN 'procedure' 
      WHEN 'a' THEN 'aggregate' 
      WHEN 'w' THEN 'window' 
      ELSE p.prokind::text 
    END AS kind,
    pg_catalog.format_type(p.prorettype, NULL)::text AS return_type,
    pg_catalog.pg_get_function_identity_arguments(p.oid)::text AS argument_types,
    l.lanname::text AS language,
    CASE p.provolatile 
      WHEN 'i' THEN 'immutable' 
      WHEN 's' THEN 'stable' 
      WHEN 'v' THEN 'volatile' 
      ELSE p.provolatile::text 
    END AS volatility,
    p.prosecdef AS security_definer,
    pg_catalog.obj_description(p.oid, 'pg_proc')::text AS description
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
  ORDER BY n.nspname, p.proname;
$$;