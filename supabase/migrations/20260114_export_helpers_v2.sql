-- Enhanced export helpers with cross-schema support

-- 1. Get Table Constraints (Schema-aware)
CREATE OR REPLACE FUNCTION public.get_table_constraints()
RETURNS TABLE (
    schema_name text,
    table_name text,
    constraint_name text,
    constraint_type text,
    constraint_details text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''  -- Force schema qualification in outputs where dependent on search_path
AS $$
    SELECT 
        n.nspname::text AS schema_name,
        rel.relname::text AS table_name,
        con.conname::text AS constraint_name,
        CASE 
            WHEN con.contype = 'p' THEN 'PRIMARY KEY'
            WHEN con.contype = 'u' THEN 'UNIQUE'
            WHEN con.contype = 'f' THEN 'FOREIGN KEY'
            WHEN con.contype = 'c' THEN 'CHECK'
            ELSE 'OTHER'
        END::text AS constraint_type,
        pg_get_constraintdef(con.oid)::text AS constraint_details
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
    ORDER BY n.nspname, rel.relname, con.contype;
$$;

-- 2. Get Table Indexes (Schema-aware)
CREATE OR REPLACE FUNCTION public.get_table_indexes()
RETURNS TABLE (
    schema_name text,
    table_name text,
    index_name text,
    index_definition text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = '' -- Force schema qualification
AS $$
    SELECT 
        n.nspname::text AS schema_name,
        t.relname::text AS table_name,
        i.relname::text AS index_name,
        pg_get_indexdef(i.oid)::text AS index_definition
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
      AND NOT x.indisprimary
      AND NOT x.indisunique
    ORDER BY n.nspname, t.relname, i.relname;
$$;

-- 3. Get RLS Policies (Schema-aware)
CREATE OR REPLACE FUNCTION public.get_rls_policies()
RETURNS TABLE (
    schema_name text,
    table_name text,
    policy_name text,
    command text,
    roles text[],
    using_expression text,
    with_check_expression text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = '' -- Force schema qualification
AS $$
    SELECT 
        n.nspname::text AS schema_name,
        t.relname::text AS table_name,
        pol.polname::text AS policy_name,
        CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
        END::text AS command,
        ARRAY(
            SELECT r.rolname 
            FROM pg_roles r 
            WHERE r.oid = ANY(pol.polroles)
        )::text[] AS roles,
        pg_get_expr(pol.polqual, pol.polrelid)::text AS using_expression,
        pg_get_expr(pol.polwithcheck, pol.polrelid)::text AS with_check_expression
    FROM pg_policy pol
    JOIN pg_class t ON t.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
    ORDER BY n.nspname, t.relname, pol.polname;
$$;
