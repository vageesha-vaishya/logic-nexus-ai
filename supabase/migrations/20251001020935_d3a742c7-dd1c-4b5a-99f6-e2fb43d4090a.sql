-- Update RLS policies for profiles table to handle tenant/franchise access

-- Drop existing policies that need modification
DROP POLICY IF EXISTS "Franchise admins can view franchise profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admins can view tenant profiles" ON public.profiles;

-- Tenant admins can view all profiles in their tenant (including all franchises)
CREATE POLICY "Tenant admins can view tenant profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'tenant_admin') AND
  id IN (
    SELECT user_id FROM public.user_roles
    WHERE tenant_id = get_user_tenant_id(auth.uid())
  )
);

-- Franchise admins can view profiles in their franchise only
CREATE POLICY "Franchise admins can view franchise profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'franchise_admin') AND
  id IN (
    SELECT user_id FROM public.user_roles
    WHERE franchise_id = get_user_franchise_id(auth.uid())
  )
);

-- Platform admins can update user roles
DROP POLICY IF EXISTS "Platform admins can update user roles" ON public.user_roles;
CREATE POLICY "Platform admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (is_platform_admin(auth.uid()));

-- Tenant admins can update roles for users in their tenant
DROP POLICY IF EXISTS "Tenant admins can update tenant user roles" ON public.user_roles;
CREATE POLICY "Tenant admins can update tenant user roles"
ON public.user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'tenant_admin') AND
  tenant_id = get_user_tenant_id(auth.uid())
);

-- Franchise admins can update roles for users in their franchise
DROP POLICY IF EXISTS "Franchise admins can update franchise user roles" ON public.user_roles;
CREATE POLICY "Franchise admins can update franchise user roles"
ON public.user_roles
FOR UPDATE
USING (
  has_role(auth.uid(), 'franchise_admin') AND
  franchise_id = get_user_franchise_id(auth.uid())
);