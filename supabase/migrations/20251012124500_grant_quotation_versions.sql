-- Ensure roles can see tables in PostgREST schema cache
DO $$
BEGIN
  -- Schema usage for anon/authenticated
  BEGIN
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT USAGE ON SCHEMA public TO anon;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  -- Grants for quotation_versions
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotation_versions TO authenticated;
    GRANT SELECT ON TABLE public.quotation_versions TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.quotation_versions not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for quotation_versions: %', SQLERRM;
  END;

  -- Grants for quotation_version_options
  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quotation_version_options TO authenticated;
    GRANT SELECT ON TABLE public.quotation_version_options TO anon;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.quotation_version_options not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for quotation_version_options: %', SQLERRM;
  END;

  -- Grants for carrier_rates (read used in UI)
  BEGIN
    GRANT SELECT ON TABLE public.carrier_rates TO authenticated;
  EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table public.carrier_rates not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for carrier_rates: %', SQLERRM;
  END;

  -- RPC execute rights for selection flow
  BEGIN
    GRANT EXECUTE ON FUNCTION public.record_customer_selection(uuid, uuid, uuid, uuid, text, uuid) TO authenticated;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'Function public.record_customer_selection not found during grants';
  WHEN others THEN
    RAISE NOTICE 'Grant failed for record_customer_selection: %', SQLERRM;
  END;
END $$;

-- Hint PostgREST to reload schema cache (no-op if not supported); safe to call manually if needed:
-- SELECT pg_notify('postgrest', 'reload schema');