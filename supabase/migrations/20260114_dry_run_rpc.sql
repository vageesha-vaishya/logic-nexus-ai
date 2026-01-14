-- Function to perform a dry-run import by attempting inserts and rolling back via exception
-- Usage: Call this RPC with a JSON object where keys are table names and values are arrays of objects.
-- The function will attempt to insert records using jsonb_populate_recordset.
-- It will always RAISE EXCEPTION at the end to ensure no data is committed.
-- Client should look for "DRY_RUN_OK" in the error message to confirm success.

CREATE OR REPLACE FUNCTION public.logic_nexus_import_dry_run(
  p_tables jsonb,
  p_schema text DEFAULT 'public'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_table text;
  v_rows jsonb;
  v_count int;
  v_errors text[] := ARRAY[]::text[];
  v_total_success int := 0;
  v_table_count int := 0;
BEGIN
  -- Loop through tables in the input JSON
  FOR v_table, v_rows IN SELECT * FROM jsonb_each(p_tables)
  LOOP
    BEGIN
      -- Validate table existence in the specified schema
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = p_schema AND table_name = v_table
      ) THEN
        v_errors := array_append(v_errors, format('Table "%s"."%s" not found', p_schema, v_table));
        CONTINUE;
      END IF;

      -- Attempt insertion using jsonb_populate_recordset
      -- This validates data types and constraints (except deferred ones)
      EXECUTE format(
        'INSERT INTO %I.%I SELECT * FROM jsonb_populate_recordset(null::%I.%I, $1)',
        p_schema, v_table, p_schema, v_table
      ) USING v_rows;
      
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_total_success := v_total_success + v_count;
      v_table_count := v_table_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Catch specific table errors
      v_errors := array_append(v_errors, format('Error in "%s": %s', v_table, SQLERRM));
    END;
  END LOOP;

  -- Final outcome
  IF array_length(v_errors, 1) > 0 THEN
    -- If there were errors, we raise a generic error with details
    RAISE EXCEPTION 'DRY_RUN_FAILED: % errors found. Details: %', array_length(v_errors, 1), array_to_string(v_errors, '; ');
  ELSE
    -- If all good, we still raise exception to rollback, but with a success signature
    RAISE EXCEPTION 'DRY_RUN_OK: Validated % rows across % tables', v_total_success, v_table_count;
  END IF;
END;
$$;
