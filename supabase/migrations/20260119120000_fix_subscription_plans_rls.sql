-- Fix RLS policy for subscription_plans to allow platform admins to manage plans
-- even when "Admin Override" (masquerading) is enabled.
-- This ensures global configuration can be managed regardless of the current view scope.

-- 1. Create a helper function to check for ACTUAL platform admin role, ignoring overrides.
CREATE OR REPLACE FUNCTION public.is_actual_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = check_user_id AND role = 'platform_admin'
  );
$$;

COMMENT ON FUNCTION public.is_actual_platform_admin(UUID) IS 'Check if a user has the platform_admin role, ignoring any admin_override_enabled preferences.';

-- 2. Update the RLS policy for subscription_plans to use the new function.
-- This allows platform admins to Insert/Update/Delete plans even if they are currently viewing as a tenant.

DROP POLICY IF EXISTS "Platform admins can manage subscription plans" ON public.subscription_plans;

CREATE POLICY "Platform admins can manage subscription plans"
  ON public.subscription_plans
  FOR ALL
  USING (public.is_actual_platform_admin(auth.uid()));
