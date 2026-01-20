-- Migration: Fix Tenant Creation RLS and Permissions
-- Description: Ensures the specified super user has the 'platform_admin' role and re-applies RLS policies for the tenants table to allow creation.
-- Author: Trae AI
-- Date: 2026-01-20

-- 1. Ensure the user has the platform_admin role
DO $$
DECLARE
  v_user_email TEXT := 'bahuguna.vimal@gmail.com';
  v_user_id UUID;
  v_role_exists BOOLEAN;
  v_profile_exists BOOLEAN;
BEGIN
  -- Find the user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_user_email;

  IF v_user_id IS NOT NULL THEN
    -- Ensure profile exists (idempotent check)
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) INTO v_profile_exists;
    
    IF NOT v_profile_exists THEN
       INSERT INTO public.profiles (id, email, first_name, last_name, is_active)
       VALUES (v_user_id, v_user_email, 'Vimal', 'Bahuguna', true);
    END IF;

    -- Check if role exists
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'platform_admin'
    ) INTO v_role_exists;

    -- Assign role if missing
    IF NOT v_role_exists THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_user_id, 'platform_admin');
    END IF;
  END IF;
END $$;

-- 2. Reset and Re-apply RLS policies for tenants to ensure INSERT is allowed
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Platform admins full access to tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can insert tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can view all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can update tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can delete tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can update all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Platform admins can delete all tenants" ON public.tenants;

-- Create explicit policies for clarity and coverage

-- SELECT: Platform admins can see all
CREATE POLICY "Platform admins can view all tenants"
  ON public.tenants FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

-- INSERT: Only Platform admins can create tenants
CREATE POLICY "Platform admins can insert tenants"
  ON public.tenants FOR INSERT
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- UPDATE: Platform admins can update all
CREATE POLICY "Platform admins can update all tenants"
  ON public.tenants FOR UPDATE
  USING (public.is_platform_admin(auth.uid()));

-- DELETE: Platform admins can delete all
CREATE POLICY "Platform admins can delete all tenants"
  ON public.tenants FOR DELETE
  USING (public.is_platform_admin(auth.uid()));

-- Ensure Tenant Admin policies are preserved/restored
-- (Dropping first to ensure no duplicates if naming varied)
DROP POLICY IF EXISTS "Tenant admins can view own tenant" ON public.tenants;

CREATE POLICY "Tenant admins can view own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_user_tenant_id(auth.uid()));

-- 3. Verify is_platform_admin function (idempotent replacement)
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
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
