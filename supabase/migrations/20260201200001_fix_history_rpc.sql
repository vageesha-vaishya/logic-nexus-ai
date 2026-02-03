
-- Fix get_service_history RPC signature mismatch
BEGIN;

DROP FUNCTION IF EXISTS public.get_service_history(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_service_history(
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
    al.action::TEXT,
    al.details::JSONB,
    al.created_at,
    u.email::TEXT as user_email,
    COALESCE((u.raw_user_meta_data->>'full_name')::TEXT, '')::TEXT as user_full_name
  FROM
    public.audit_logs al
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

-- Also fix get_tier_history just in case
DROP FUNCTION IF EXISTS public.get_tier_history(UUID, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_tier_history(
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
    al.action::TEXT,
    al.details::JSONB,
    al.created_at,
    u.email::TEXT as user_email,
    COALESCE((u.raw_user_meta_data->>'full_name')::TEXT, '')::TEXT as user_full_name
  FROM
    public.audit_logs al
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

COMMIT;
