-- Migration to implement Strict RLS Override for Platform Admins
-- This migration modifies core helper functions to respect user_preferences when admin_override_enabled is true.

-- 1. Create admin_override_audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.admin_override_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    tenant_id UUID REFERENCES public.tenants(id),
    franchise_id UUID REFERENCES public.franchises(id),
    enabled BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit table
ALTER TABLE public.admin_override_audit ENABLE ROW LEVEL SECURITY;

-- Audit Policies
DROP POLICY IF EXISTS "Users view own admin override audit" ON public.admin_override_audit;
CREATE POLICY "Users view own admin override audit" ON public.admin_override_audit FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Platform admins manage admin override audit" ON public.admin_override_audit;
CREATE POLICY "Platform admins manage admin override audit" ON public.admin_override_audit FOR ALL 
USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
);

-- 2. Update is_platform_admin to return FALSE if override is enabled
CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id AND role = 'platform_admin'
  ) 
  AND NOT EXISTS (
    SELECT 1 FROM user_preferences 
    WHERE user_id = check_user_id AND admin_override_enabled = true
  );
$$;

-- 3. Update has_role to masquerade as tenant/franchise admin if override is enabled
CREATE OR REPLACE FUNCTION public.has_role(check_user_id UUID, check_role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_platform_admin BOOLEAN;
  v_override_enabled BOOLEAN;
  v_override_tenant_id UUID;
  v_override_franchise_id UUID;
BEGIN
  -- Check if user is REALLY a platform admin
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = check_user_id AND role = 'platform_admin')
  INTO v_is_real_platform_admin;

  -- Check if override is enabled in preferences
  SELECT 
    (admin_override_enabled IS TRUE),
    tenant_id,
    franchise_id
  INTO v_override_enabled, v_override_tenant_id, v_override_franchise_id
  FROM user_preferences
  WHERE user_id = check_user_id;

  -- Masquerade as tenant_admin if override is enabled (and tenant is selected)
  IF v_is_real_platform_admin AND v_override_enabled THEN
    IF check_role = 'platform_admin' THEN
        RETURN FALSE;
    ELSIF check_role = 'tenant_admin' THEN
        -- Only return true if tenant is selected AND franchise is NOT selected
        -- This ensures that selecting a franchise simulates "Franchise Admin" view (strict scoping)
        RETURN v_override_tenant_id IS NOT NULL AND v_override_franchise_id IS NULL;
    ELSIF check_role = 'franchise_admin' THEN
        RETURN v_override_franchise_id IS NOT NULL;
    END IF;
  END IF;

  -- Normal role check
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = check_user_id
    AND role = check_role
  );
END;
$$;

-- 8. Fix Profiles RLS Policy to use helper functions (avoid direct join bypass)
DROP POLICY IF EXISTS "Admins can view all profiles in their scope" ON public.profiles;
CREATE POLICY "Admins can view all profiles in their scope"
  ON public.profiles FOR SELECT
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.tenant_id = public.get_user_tenant_id(auth.uid())
    )) OR
    (public.has_role(auth.uid(), 'franchise_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.franchise_id = public.get_user_franchise_id(auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Admins can update profiles in their scope" ON public.profiles;
CREATE POLICY "Admins can update profiles in their scope"
  ON public.profiles FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid()) OR
    (public.has_role(auth.uid(), 'tenant_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.tenant_id = public.get_user_tenant_id(auth.uid())
    )) OR
    (public.has_role(auth.uid(), 'franchise_admin') AND EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = public.profiles.id AND ur.franchise_id = public.get_user_franchise_id(auth.uid())
    ))
  );

-- 4. Update get_user_tenant_id to return override tenant
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_platform_admin BOOLEAN;
  v_override_enabled BOOLEAN;
  v_override_tenant_id UUID;
  v_role_tenant_id UUID;
BEGIN
  -- Check if user is REALLY a platform admin (ignoring the modified is_platform_admin function)
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = check_user_id AND role = 'platform_admin')
  INTO v_is_real_platform_admin;

  -- Check if override is enabled in preferences
  SELECT 
    (admin_override_enabled IS TRUE),
    tenant_id
  INTO v_override_enabled, v_override_tenant_id
  FROM user_preferences
  WHERE user_id = check_user_id;

  -- Return override tenant if applicable
  IF v_is_real_platform_admin AND v_override_enabled THEN
    RETURN v_override_tenant_id;
  END IF;

  -- Otherwise return normal role-based tenant
  -- (Prioritize tenant_admin, then franchise_admin, then user)
  SELECT tenant_id INTO v_role_tenant_id
  FROM user_roles
  WHERE user_id = check_user_id
  ORDER BY 
    CASE role 
      WHEN 'tenant_admin' THEN 1 
      WHEN 'franchise_admin' THEN 2 
      ELSE 3 
    END
  LIMIT 1;

  RETURN v_role_tenant_id;
END;
$$;

-- 5. Update get_user_franchise_id to return override franchise
CREATE OR REPLACE FUNCTION public.get_user_franchise_id(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_real_platform_admin BOOLEAN;
  v_override_enabled BOOLEAN;
  v_override_franchise_id UUID;
  v_role_franchise_id UUID;
BEGIN
  -- Check if user is REALLY a platform admin
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = check_user_id AND role = 'platform_admin')
  INTO v_is_real_platform_admin;

  -- Check if override is enabled in preferences
  SELECT 
    (admin_override_enabled IS TRUE),
    franchise_id
  INTO v_override_enabled, v_override_franchise_id
  FROM user_preferences
  WHERE user_id = check_user_id;

  -- Return override franchise if applicable
  IF v_is_real_platform_admin AND v_override_enabled THEN
    RETURN v_override_franchise_id;
  END IF;

  -- Otherwise return normal role-based franchise
  SELECT franchise_id INTO v_role_franchise_id
  FROM user_roles
  WHERE user_id = check_user_id
  AND franchise_id IS NOT NULL
  LIMIT 1;

  RETURN v_role_franchise_id;
END;
$$;

-- 6. Update set_admin_override to log audit
CREATE OR REPLACE FUNCTION public.set_admin_override(
    p_enabled BOOLEAN,
    p_tenant_id UUID DEFAULT NULL,
    p_franchise_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_platform_admin BOOLEAN;
BEGIN
    -- Check if user is platform admin (using direct check to avoid recursion)
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'platform_admin'
    ) INTO v_is_platform_admin;

    IF NOT v_is_platform_admin THEN
        RAISE EXCEPTION 'Only platform admins can use admin override';
    END IF;

    -- Update Preferences
    INSERT INTO public.user_preferences (user_id, admin_override_enabled, tenant_id, franchise_id)
    VALUES (auth.uid(), p_enabled, p_tenant_id, p_franchise_id)
    ON CONFLICT (user_id)
    DO UPDATE SET
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        tenant_id = COALESCE(p_tenant_id, user_preferences.tenant_id),
        franchise_id = COALESCE(p_franchise_id, user_preferences.franchise_id),
        updated_at = NOW();

    -- Audit Log
    INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
    VALUES (auth.uid(), p_tenant_id, p_franchise_id, p_enabled);
END;
$$;

-- 7. Update set_user_scope_preference to log audit for platform admins
CREATE OR REPLACE FUNCTION public.set_user_scope_preference(
    p_tenant_id UUID,
    p_franchise_id UUID,
    p_admin_override BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_platform_admin BOOLEAN;
BEGIN
    -- Update Preferences
    INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
    VALUES (auth.uid(), p_tenant_id, p_franchise_id, p_admin_override)
    ON CONFLICT (user_id)
    DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        franchise_id = EXCLUDED.franchise_id,
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        updated_at = NOW();

    -- Audit Log if Platform Admin and Override is enabled
    -- We check if they are a platform admin first
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() AND role = 'platform_admin'
    ) INTO v_is_platform_admin;

    IF v_is_platform_admin AND p_admin_override THEN
        INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
        VALUES (auth.uid(), p_tenant_id, p_franchise_id, true);
    END IF;
END;
$$;
