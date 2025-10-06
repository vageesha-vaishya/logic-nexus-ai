-- Create function to execute read-only SQL queries
CREATE OR REPLACE FUNCTION public.execute_sql_query(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_data jsonb;
BEGIN
  -- Only allow SELECT queries
  IF NOT (query_text ~* '^\s*SELECT') THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block any mutations
  IF query_text ~* '(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Execute the query and return as JSON
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', query_text) INTO result_data;
  
  RETURN COALESCE(result_data, '[]'::jsonb);
END;
$$;