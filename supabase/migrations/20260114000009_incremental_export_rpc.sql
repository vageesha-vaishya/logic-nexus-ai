-- Function to export data incrementally based on timestamp
CREATE OR REPLACE FUNCTION public.get_table_data_incremental(
    target_schema text, 
    target_table text, 
    min_timestamp timestamptz,
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
    has_created boolean;
    has_updated boolean;
    query text;
BEGIN
    -- Validate schema
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions', 'vault') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Check if columns exist
    SELECT 
        EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = target_schema AND table_name = target_table AND column_name = 'created_at'
        ),
        EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = target_schema AND table_name = target_table AND column_name = 'updated_at'
        )
    INTO has_created, has_updated;

    -- Build query
    query := format('SELECT * FROM %I.%I', target_schema, target_table);
    
    IF has_created AND has_updated THEN
        query := query || format(' WHERE created_at >= %L OR updated_at >= %L', min_timestamp, min_timestamp);
    ELSIF has_created THEN
        query := query || format(' WHERE created_at >= %L', min_timestamp);
    ELSIF has_updated THEN
        query := query || format(' WHERE updated_at >= %L', min_timestamp);
    ELSE
        -- No timestamp columns, return empty if incremental requested? 
        -- Or return everything? Usually incremental implies we can filter.
        -- Returning empty prevents re-exporting static tables.
        RETURN '[]'::jsonb;
    END IF;

    query := query || format(' OFFSET %s LIMIT %s', offset_val, limit_val);

    EXECUTE format('SELECT jsonb_agg(t) FROM (%s) t', query) INTO result;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
