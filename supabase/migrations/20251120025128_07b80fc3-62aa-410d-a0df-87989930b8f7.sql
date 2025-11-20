-- Fix search_path security issue for get_tier_rate function
CREATE OR REPLACE FUNCTION get_tier_rate(
  p_tier_config_id UUID,
  p_value NUMERIC
) RETURNS TABLE(
  range_id UUID,
  rate NUMERIC,
  currency_id UUID,
  min_value NUMERIC,
  max_value NUMERIC
) 
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    id,
    rate,
    currency_id,
    min_value,
    max_value
  FROM charge_tier_ranges
  WHERE tier_config_id = p_tier_config_id
    AND min_value <= p_value
    AND (max_value IS NULL OR max_value >= p_value)
  ORDER BY sort_order, min_value
  LIMIT 1;
$$;