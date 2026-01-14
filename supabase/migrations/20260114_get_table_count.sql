-- Function to get exact table count for any schema
CREATE OR REPLACE FUNCTION public.get_table_count(target_schema text, target_table text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    row_count bigint;
    query text;
BEGIN
    -- Validate schema to prevent SQL injection (allow only alphanumeric and underscores)
    IF NOT (target_schema ~ '^[a-zA-Z0-9_]+$') OR NOT (target_table ~ '^[a-zA-Z0-9_]+$') THEN
        RAISE EXCEPTION 'Invalid schema or table name';
    END IF;

    -- Construct query securely
    query := format('SELECT count(*) FROM %I.%I', target_schema, target_table);
    
    -- Execute query
    EXECUTE query INTO row_count;
    
    RETURN row_count;
EXCEPTION
    WHEN OTHERS THEN
        RETURN -1; -- Return -1 on error (e.g. permission denied or table not found)
END;
$$;
