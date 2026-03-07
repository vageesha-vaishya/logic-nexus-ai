
-- Create RPC to fetch templates securely (bypassing RLS for cross-tenant access by admins/support)
CREATE OR REPLACE FUNCTION get_templates_secure(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_active BOOLEAN,
  tenant_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.is_active, t.tenant_id
  FROM quote_templates t
  WHERE 
    t.is_active = true
    AND (
      (p_tenant_id IS NOT NULL AND t.tenant_id = p_tenant_id)
      OR
      (p_tenant_id IS NULL AND t.tenant_id IS NULL)
    )
  ORDER BY t.name ASC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_templates_secure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_templates_secure(UUID) TO service_role;
