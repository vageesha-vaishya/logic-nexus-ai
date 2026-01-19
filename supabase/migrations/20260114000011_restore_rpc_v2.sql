-- Function to restore table data to any schema with dynamic conflict target
-- WARNING: This bypasses RLS if used with SECURITY DEFINER. Ensure proper access control.
DROP FUNCTION IF EXISTS public.restore_table_data(text, text, jsonb, text, text[]);

CREATE OR REPLACE FUNCTION public.restore_table_data(
    target_schema text,
    target_table text,
    data jsonb,
    mode text DEFAULT 'insert', -- 'insert' or 'upsert'
    conflict_target text[] DEFAULT NULL -- Array of column names for ON CONFLICT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    record jsonb;
    row_number int := 0;
    keys text[];
    values text[];
    query text;
    inserted_count int := 0;
    error_count int := 0;
    errors text[] := ARRAY[]::text[];
    error_rows jsonb := '[]'::jsonb;
    col text;
    val text;
    conflict_clause text;
    err_code text;
    err_constraint text;
BEGIN
    -- Validate schema
    IF target_schema NOT IN ('public', 'auth', 'storage', 'extensions', 'vault') THEN
        RAISE EXCEPTION 'Invalid schema: %', target_schema;
    END IF;

    -- Process each record
    FOR record IN SELECT * FROM jsonb_array_elements(data)
    LOOP
        row_number := row_number + 1;
        BEGIN
            -- Extract keys and values
            SELECT array_agg(key), array_agg(value)
            INTO keys, values
            FROM jsonb_each_text(record);

            -- Build INSERT query
            query := format(
                'INSERT INTO %I.%I (%s) VALUES (%s)',
                target_schema,
                target_table,
                array_to_string(array(SELECT format('%I', k) FROM unnest(keys) k), ','),
                array_to_string(array(SELECT format('%L', v) FROM unnest(values) v), ',')
            );

            -- Handle UPSERT
            IF mode = 'upsert' THEN
                IF conflict_target IS NOT NULL AND array_length(conflict_target, 1) > 0 THEN
                    -- Use provided conflict target
                    conflict_clause := array_to_string(array(SELECT format('%I', c) FROM unnest(conflict_target) c), ',');
                    
                    query := query || format(' ON CONFLICT (%s) DO UPDATE SET ', conflict_clause);
                    
                    -- Build SET clause for update
                    query := query || array_to_string(
                        array(
                            SELECT format('%I = EXCLUDED.%I', k, k) 
                            FROM unnest(keys) k 
                            WHERE NOT (k = ANY(conflict_target)) -- Exclude conflict columns from update
                        ), 
                        ','
                    );
                ELSE
                    -- Fallback to simplistic 'id' if exists, else DO NOTHING
                    IF 'id' = ANY(keys) THEN
                        query := query || ' ON CONFLICT (id) DO UPDATE SET ';
                         query := query || array_to_string(
                            array(
                                SELECT format('%I = EXCLUDED.%I', k, k) 
                                FROM unnest(keys) k 
                                WHERE k != 'id'
                            ), 
                            ','
                        );
                    ELSE
                         query := query || ' ON CONFLICT DO NOTHING';
                    END IF;
                END IF;
            END IF;

            EXECUTE query;
            inserted_count := inserted_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            GET STACKED DIAGNOSTICS err_code = RETURNED_SQLSTATE,
                                   err_constraint = CONSTRAINT_NAME;
            errors := array_append(errors, SQLERRM);
            error_rows := error_rows || jsonb_build_array(
                jsonb_build_object(
                    'row_number', row_number,
                    'error', SQLERRM,
                    'code', err_code,
                    'constraint', err_constraint
                )
            );
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', inserted_count,
        'failed', error_count,
        'errors', errors[1:5],
        'error_rows', error_rows
    );
END;
$$;
