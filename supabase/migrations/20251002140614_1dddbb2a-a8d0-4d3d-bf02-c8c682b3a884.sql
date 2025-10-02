-- Add access_type column to custom_role_permissions to support grant/deny
ALTER TABLE public.custom_role_permissions 
ADD COLUMN IF NOT EXISTS access_type TEXT NOT NULL DEFAULT 'grant' 
CHECK (access_type IN ('grant', 'deny'));

-- Drop and recreate the function with new return type
DROP FUNCTION IF EXISTS public.get_user_custom_permissions(UUID);

CREATE OR REPLACE FUNCTION public.get_user_custom_permissions(check_user_id UUID)
RETURNS TABLE(permission_key TEXT, access_type TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT crp.permission_key, crp.access_type
  FROM public.user_custom_roles ucr
  JOIN public.custom_role_permissions crp ON ucr.role_id = crp.role_id
  JOIN public.custom_roles cr ON crp.role_id = cr.id
  WHERE ucr.user_id = check_user_id
    AND cr.is_active = true
  ORDER BY crp.permission_key;
$$;