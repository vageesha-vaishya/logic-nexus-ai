-- Migration to allow Platform Admins to cross tenant boundaries in override mode
-- This fixes the issue where Platform Admins associated with a home tenant couldn't switch to other tenants.

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
    v_owned_tenant_id UUID;
    v_effective_tenant_id UUID;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'platform_admin'
    ) INTO v_is_platform_admin;

    IF NOT v_is_platform_admin THEN
        RAISE EXCEPTION 'Only platform admins can use admin override';
    END IF;

    -- Platform admins can switch to any tenant. 
    -- We prioritize p_tenant_id if provided, otherwise fall back to their home tenant.
    v_effective_tenant_id := p_tenant_id;

    IF p_franchise_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.franchises f
        WHERE f.id = p_franchise_id
          AND (v_effective_tenant_id IS NULL OR f.tenant_id = v_effective_tenant_id)
      ) THEN
        RAISE EXCEPTION 'Invalid franchise scope';
      END IF;
    END IF;

    INSERT INTO public.user_preferences (user_id, admin_override_enabled, tenant_id, franchise_id)
    VALUES (auth.uid(), p_enabled, v_effective_tenant_id, p_franchise_id)
    ON CONFLICT (user_id)
    DO UPDATE SET
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        tenant_id = EXCLUDED.tenant_id,
        franchise_id = EXCLUDED.franchise_id,
        updated_at = NOW();

    INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
    VALUES (auth.uid(), v_effective_tenant_id, p_franchise_id, p_enabled);
END;
$$;

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
    v_owned_tenant_id UUID;
    v_effective_tenant_id UUID;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'platform_admin'
    ) INTO v_is_platform_admin;

    -- For Platform Admins, we allow them to set any tenant ID if they are in override mode.
    -- If not in override mode, we still allow it but it might be restricted by RLS later.
    v_effective_tenant_id := p_tenant_id;

    IF NOT v_is_platform_admin THEN
      -- Standard users and Tenant Admins are strictly bound to their own tenant.
      v_effective_tenant_id := public.get_user_tenant_id(auth.uid());
      IF p_tenant_id IS NOT NULL AND p_tenant_id <> v_effective_tenant_id THEN
        RAISE EXCEPTION 'Scope update cannot cross tenant boundaries';
      END IF;
    END IF;

    IF p_franchise_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.franchises f
        WHERE f.id = p_franchise_id
          AND (v_effective_tenant_id IS NULL OR f.tenant_id = v_effective_tenant_id)
      ) THEN
        RAISE EXCEPTION 'Invalid franchise scope';
      END IF;
    END IF;

    INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
    VALUES (auth.uid(), v_effective_tenant_id, p_franchise_id, p_admin_override)
    ON CONFLICT (user_id)
    DO UPDATE SET
        tenant_id = EXCLUDED.tenant_id,
        franchise_id = EXCLUDED.franchise_id,
        admin_override_enabled = EXCLUDED.admin_override_enabled,
        updated_at = NOW();

    IF v_is_platform_admin AND p_admin_override THEN
        INSERT INTO public.admin_override_audit (user_id, tenant_id, franchise_id, enabled)
        VALUES (auth.uid(), v_effective_tenant_id, p_franchise_id, true);
    END IF;
END;
$$;
