-- Create a function to get all carriers grouped by mode
-- This avoids the "function not found" error in the frontend
CREATE OR REPLACE FUNCTION public.get_all_carriers_grouped_by_mode()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT 
    jsonb_object_agg(
      mode,
      carriers
    ) INTO result
  FROM (
    SELECT 
      mode,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'carrier_name', carrier_name,
          'carrier_code', carrier_code,
          'carrier_type', carrier_type,
          'scac', scac,
          'iata', iata,
          'mc_dot', mc_dot,
          'mode', mode,
          'is_preferred', false, -- Default to false if we don't have preference logic yet
          'service_types', '[]'::jsonb -- Placeholder for service types
        ) ORDER BY carrier_name
      ) as carriers
    FROM public.carriers
    WHERE is_active = true
    GROUP BY mode
  ) sub;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
