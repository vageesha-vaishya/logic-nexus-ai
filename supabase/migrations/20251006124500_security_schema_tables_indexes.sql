-- Function: List public tables and views with RLS, counts, and row estimate
CREATE OR REPLACE FUNCTION public.get_database_tables()
RETURNS TABLE (
  table_name text,
  table_type text,
  rls_enabled boolean,
  policy_count bigint,
  column_count integer,
  index_count integer,
  row_estimate bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cols AS (
    SELECT table_name, COUNT(*) AS column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
  ),
  idx AS (
    SELECT tablename AS table_name, COUNT(*) AS index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    GROUP BY tablename
  ),
  pol AS (
    SELECT tablename AS table_name, COUNT(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
  )
  SELECT 
    c.relname::text AS table_name,
    CASE WHEN c.relkind = 'r' THEN 'table' WHEN c.relkind = 'v' THEN 'view' ELSE c.relkind::text END AS table_type,
    CASE WHEN c.relkind = 'r' THEN c.relrowsecurity ELSE NULL END AS rls_enabled,
    COALESCE(pol.policy_count, 0) AS policy_count,
    COALESCE(cols.column_count, 0) AS column_count,
    COALESCE(idx.index_count, 0) AS index_count,
    CASE WHEN c.relkind = 'r' THEN c.reltuples::bigint ELSE NULL END AS row_estimate
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN cols ON cols.table_name = c.relname
  LEFT JOIN idx ON idx.table_name = c.relname
  LEFT JOIN pol ON pol.table_name = c.relname
  WHERE n.nspname = 'public' AND c.relkind IN ('r','v')
  ORDER BY c.relname;
$$;

-- Function: List constraints across public tables (PK, FK, UNIQUE, CHECK)
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
  WITH tc AS (
    SELECT * FROM information_schema.table_constraints
    WHERE table_schema = 'public'
  ),
  kcu AS (
    SELECT * FROM information_schema.key_column_usage
    WHERE table_schema = 'public'
  ),
  ccu AS (
    SELECT * FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
  ),
  chk AS (
    SELECT * FROM information_schema.check_constraints
  ),
  fk AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'FOREIGN KEY'::text AS constraint_type,
      format('columns: %s; references: %s(%s)',
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position),
        max(ccu.table_name),
        string_agg(ccu.column_name, ', ' ORDER BY ccu.column_name)
      ) AS constraint_details
    FROM tc
    JOIN kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name AND kcu.table_schema = tc.table_schema
    JOIN ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
    GROUP BY tc.table_name, tc.constraint_name
  ),
  pk AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'PRIMARY KEY'::text AS constraint_type,
      format('columns: %s', string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)) AS constraint_details
    FROM tc
    JOIN kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
    GROUP BY tc.table_name, tc.constraint_name
  ),
  uq AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'UNIQUE'::text AS constraint_type,
      format('columns: %s', string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position)) AS constraint_details
    FROM tc
    JOIN kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_name = tc.table_name AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
    GROUP BY tc.table_name, tc.constraint_name
  ),
  ck AS (
    SELECT 
      tc.table_name,
      tc.constraint_name,
      'CHECK'::text AS constraint_type,
      chk.check_clause AS constraint_details
    FROM tc
    JOIN chk ON chk.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'CHECK'
  )
  SELECT * FROM fk
  UNION ALL
  SELECT * FROM pk
  UNION ALL
  SELECT * FROM uq
  UNION ALL
  SELECT * FROM ck
  ORDER BY table_name, constraint_name;
$$;

-- Function: List indexes across public tables
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
    array_to_string(array_agg(a.attname ORDER BY a.attnum), ', ') AS index_columns,
    pg_get_indexdef(ix.indexrelid)::text AS index_definition
  FROM pg_class t
  JOIN pg_index ix ON ix.indrelid = t.oid
  JOIN pg_class i ON i.oid = ix.indexrelid
  LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
  GROUP BY t.relname, i.relname, ix.indisunique, ix.indexrelid
  ORDER BY t.relname, i.relname;
$$;