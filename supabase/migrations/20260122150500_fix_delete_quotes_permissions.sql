-- Grant execute permission to authenticated users and service_role
GRANT EXECUTE ON FUNCTION delete_quotes_cascade(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_quotes_cascade(UUID[]) TO service_role;

-- Optional: verify function exists by replacing it (idempotent)
CREATE OR REPLACE FUNCTION delete_quotes_cascade(quote_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Unlink Opportunities (set primary_quote_id to NULL)
  UPDATE opportunities 
  SET primary_quote_id = NULL 
  WHERE primary_quote_id = ANY(quote_ids);

  -- 2. Explicitly delete dependent tables
  
  -- Delete quote_charges linked to options of these quotes
  DELETE FROM quote_charges 
  WHERE quote_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );

  -- Delete legs (quotation_version_option_legs)
  DELETE FROM quotation_version_option_legs 
  WHERE quotation_version_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );
  
  -- Delete legacy/other legs (quote_legs)
  DELETE FROM quote_legs 
  WHERE quote_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (
      SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
    )
  );

  -- Delete options
  DELETE FROM quotation_version_options 
  WHERE quotation_version_id IN (
    SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids)
  );

  -- Delete versions
  DELETE FROM quotation_versions 
  WHERE quote_id = ANY(quote_ids);

  -- Finally delete the quotes
  DELETE FROM quotes WHERE id = ANY(quote_ids);
END;
$$;
