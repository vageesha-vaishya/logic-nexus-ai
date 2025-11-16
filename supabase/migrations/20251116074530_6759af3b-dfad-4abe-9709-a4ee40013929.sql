-- Fix is_platform_admin function
-- Enhance the function to handle edge cases and improve reliability
-- Use CREATE OR REPLACE to avoid dependency issues

CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return false if check_user_id is NULL
  IF check_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user has platform_admin role and profile is active
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = check_user_id
      AND ur.role = 'platform_admin'
      AND p.is_active = true
  );
END;
$$;

-- Create a convenience function to check current user
CREATE OR REPLACE FUNCTION public.is_current_user_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin(auth.uid());
$$;

-- Create a function to get all platform admin users
CREATE OR REPLACE FUNCTION public.get_platform_admins()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  is_active BOOLEAN,
  assigned_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.is_active,
    ur.assigned_at
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'platform_admin'
    AND p.is_active = true
  ORDER BY ur.assigned_at DESC;
$$;

COMMENT ON FUNCTION public.is_platform_admin(UUID) IS 'Check if a specific user has platform admin role and is active. Returns false if user_id is NULL or user is inactive.';
COMMENT ON FUNCTION public.is_current_user_platform_admin() IS 'Check if the current authenticated user is a platform admin';
COMMENT ON FUNCTION public.get_platform_admins() IS 'Get list of all active platform administrators';