-- Fix RLS Infinite Recursion in Profiles and User Roles (ROBUST VERSION)
-- This migration fixes the "infinite recursion" error by ensuring helper functions
-- bypass RLS when checking permissions, breaking the loop.
-- It also dynamically removes ALL existing policies to ensure no recursive ones remain.

-- 1. Secure Helper Functions (SECURITY DEFINER bypasses RLS)
-- These functions are used in RLS policies, so they must not trigger RLS themselves.

CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = 'platform_admin');
$$;

CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role text)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = check_role::app_role);
$$;

-- Overload for app_role enum if needed
CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = check_user_id AND role = check_role);
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_role_tenant_id
  FROM public.user_roles
  WHERE user_id = check_user_id
  LIMIT 1;
  RETURN v_role_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_franchise_id(check_user_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_franchise_id UUID;
BEGIN
  SELECT franchise_id INTO v_role_franchise_id
  FROM public.user_roles
  WHERE user_id = check_user_id
  LIMIT 1;
  RETURN v_role_franchise_id;
END;
$$;

-- NEW: Helper to check if a profile belongs to the same tenant as the viewer
-- This encapsulates the user_roles lookup in a SECURITY DEFINER function to prevent RLS recursion
CREATE OR REPLACE FUNCTION public.is_profile_in_viewer_tenant(target_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = target_profile_id
    AND ur.tenant_id = public.get_user_tenant_id(auth.uid())
  );
$$;

-- 2. Dynamically Drop ALL Policies on User Roles and Profiles
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_roles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_roles', pol.policyname);
  END LOOP;
  
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. Re-create Policies on User Roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Platform admins can manage all roles" ON public.user_roles
  FOR ALL USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant admins can manage tenant roles" ON public.user_roles
  FOR ALL USING (
    public.get_user_tenant_id(auth.uid()) = tenant_id AND
    public.has_role(auth.uid(), 'tenant_admin')
  );

CREATE POLICY "Franchise admins can view franchise roles" ON public.user_roles
  FOR SELECT USING (
    public.get_user_franchise_id(auth.uid()) = franchise_id AND
    public.has_role(auth.uid(), 'franchise_admin')
  );

-- 4. Re-create Policies on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Platform admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.is_platform_admin(auth.uid()));

-- Use the new SECURITY DEFINER function to safely check tenant membership
CREATE POLICY "Tenant admins can view profiles in tenant" ON public.profiles
  FOR SELECT USING (public.is_profile_in_viewer_tenant(id));
