-- Create function to get detailed database schema for all relevant schemas
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
  references_column text,
  udt_schema text,
  udt_name text,
  character_maximum_length integer
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
    kcu2.column_name::text as references_column,
    c.udt_schema::text as udt_schema,
    c.udt_name::text as udt_name,
    c.character_maximum_length
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
