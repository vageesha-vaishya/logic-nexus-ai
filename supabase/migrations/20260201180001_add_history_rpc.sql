
-- RPC to fetch service history
CREATE OR REPLACE FUNCTION get_service_history(
  p_service_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  details JSONB,
  created_at TIMESTAMPTZ,
  user_email TEXT,
  user_full_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.details,
    al.created_at,
    u.email as user_email,
    (u.raw_user_meta_data->>'full_name')::TEXT as user_full_name
  FROM
    audit_logs al
  LEFT JOIN
    auth.users u ON al.user_id = u.id
  WHERE
    al.resource_type = 'services'
    AND al.resource_id = p_service_id
  ORDER BY
    al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- RPC to fetch pricing tier history
CREATE OR REPLACE FUNCTION get_tier_history(
  p_tier_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  details JSONB,
  created_at TIMESTAMPTZ,
  user_email TEXT,
  user_full_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.details,
    al.created_at,
    u.email as user_email,
    (u.raw_user_meta_data->>'full_name')::TEXT as user_full_name
  FROM
    audit_logs al
  LEFT JOIN
    auth.users u ON al.user_id = u.id
  WHERE
    al.resource_type = 'service_pricing_tiers'
    AND al.resource_id = p_tier_id
  ORDER BY
    al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
