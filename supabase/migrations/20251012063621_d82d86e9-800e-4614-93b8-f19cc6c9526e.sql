-- Grant permissions on quotation_versions tables

-- Grant permissions on quotation_versions table
GRANT ALL ON public.quotation_versions TO authenticated;
GRANT ALL ON public.quotation_versions TO service_role;

-- Grant permissions on quotation_version_options table
GRANT ALL ON public.quotation_version_options TO authenticated;
GRANT ALL ON public.quotation_version_options TO service_role;

-- Grant permissions on customer_selections table
GRANT ALL ON public.customer_selections TO authenticated;
GRANT ALL ON public.customer_selections TO service_role;

-- Grant permissions on carrier_rate_charges table
GRANT ALL ON public.carrier_rate_charges TO authenticated;
GRANT ALL ON public.carrier_rate_charges TO service_role;

-- Grant usage on sequences if they exist
DO $$
BEGIN
  -- Grant sequence permissions if using serial columns
  IF EXISTS (
    SELECT 1 FROM information_schema.sequences 
    WHERE sequence_schema = 'public' 
    AND sequence_name LIKE 'quotation%'
  ) THEN
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
  END IF;
END $$;