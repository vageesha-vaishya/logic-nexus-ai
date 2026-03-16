-- Function to safely delete quotes and all their dependent data
-- Accepts an array of quote IDs to delete in batch

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

  -- 2. Delete deeply nested dependencies (via quotation_versions -> options)
  
  -- A. Delete from quote_charges
  -- (references quote_option_id -> quotation_version_options)
  DELETE FROM quote_charges 
  WHERE quote_option_id IN (
    SELECT id FROM quotation_version_options 
    WHERE quotation_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids))
  );
  -- (references quote_option_id -> quote_options)
  DELETE FROM quote_charges
  WHERE quote_option_id IN (
    SELECT id FROM quote_options
    WHERE quote_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids))
  );

  -- B. Delete from quote_legs
  DELETE FROM quote_legs
  WHERE quote_option_id IN (
      SELECT id FROM quote_options
      WHERE quote_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids))
  );

  -- C. Delete from quotation_version_option_legs
  DELETE FROM quotation_version_option_legs
  WHERE quotation_version_option_id IN (
      SELECT id FROM quotation_version_options
      WHERE quotation_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids))
  );
  
  -- D. Delete from quote_option_legs
  DELETE FROM quote_option_legs
  WHERE quote_option_id IN (
      SELECT id FROM quote_options
      WHERE quote_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids))
  );

  -- 3. Delete dependencies referencing versions or options directly
  
  -- customer_selections (can ref quote_id, quotation_version_id, or option)
  DELETE FROM customer_selections
  WHERE quote_id = ANY(quote_ids); -- This should cover it if quote_id is always set
  -- Safety net for orphaned selections if quote_id is somehow null but version is linked (unlikely but safe)
  DELETE FROM customer_selections
  WHERE quotation_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids));

  -- quotation_audit_log
  DELETE FROM quotation_audit_log
  WHERE quote_id = ANY(quote_ids);
  
  -- quotation_version_options
  DELETE FROM quotation_version_options
  WHERE quotation_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids));

  -- quote_options
  DELETE FROM quote_options
  WHERE quote_version_id IN (SELECT id FROM quotation_versions WHERE quote_id = ANY(quote_ids));

  -- quotation_selection_events
  DELETE FROM quotation_selection_events
  WHERE quote_id = ANY(quote_ids);

  -- 4. Delete quotation_versions
  DELETE FROM quotation_versions WHERE quote_id = ANY(quote_ids);

  -- 5. Delete direct dependencies on quotes
  DELETE FROM compliance_checks WHERE quote_id = ANY(quote_ids);
  DELETE FROM documents WHERE quote_id = ANY(quote_ids);
  DELETE FROM portal_tokens WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_acceptances WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_access_logs WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_comments WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_documents WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_email_history WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_events WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_items WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_selection WHERE quote_id = ANY(quote_ids);
  DELETE FROM quote_shares WHERE quote_id = ANY(quote_ids);
  DELETE FROM rate_calculations WHERE quote_id = ANY(quote_ids);
  DELETE FROM quotation_packages WHERE quote_id = ANY(quote_ids);

  -- 6. Finally delete the quotes
  DELETE FROM quotes WHERE id = ANY(quote_ids);

END;
$$;
