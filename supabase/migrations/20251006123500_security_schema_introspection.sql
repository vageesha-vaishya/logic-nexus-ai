-- Create function to fetch database schema (tables and columns with constraints)
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
  WITH cols AS (
    SELECT 
      c.table_name, 
      c.column_name, 
      c.data_type, 
      (c.is_nullable = 'YES') AS is_nullable, 
      c.column_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
  ),
  pk AS (
    SELECT 
      kcu.table_name, 
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
      AND tc.table_schema = kcu.table_schema 
      AND tc.table_name = kcu.table_name
    WHERE tc.table_schema = 'public' 
      AND tc.constraint_type = 'PRIMARY KEY'
  ),
  fk AS (
    SELECT
      kcu.table_name,
      kcu.column_name,
      ccu.table_name AS references_table,
      ccu.column_name AS references_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name 
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name 
      AND rc.constraint_schema = tc.table_schema
    JOIN information_schema.key_column_usage ccu
      ON ccu.constraint_name = rc.unique_constraint_name 
      AND ccu.constraint_schema = rc.unique_constraint_schema 
      AND ccu.ordinal_position = kcu.ordinal_position
    WHERE tc.table_schema = 'public' 
      AND tc.constraint_type = 'FOREIGN KEY'
  )
  SELECT 
    cols.table_name::text,
    cols.column_name::text,
    cols.data_type::text,
    cols.is_nullable,
    cols.column_default::text,
    (pk.column_name IS NOT NULL) AS is_primary_key,
    (fk.column_name IS NOT NULL) AS is_foreign_key,
    fk.references_table::text,
    fk.references_column::text
  FROM cols
  LEFT JOIN pk 
    ON pk.table_name = cols.table_name 
    AND pk.column_name = cols.column_name
  LEFT JOIN fk 
    ON fk.table_name = cols.table_name 
    AND fk.column_name = cols.column_name
  ORDER BY cols.table_name, cols.column_name;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;