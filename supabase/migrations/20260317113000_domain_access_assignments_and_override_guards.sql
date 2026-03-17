CREATE TABLE IF NOT EXISTS public.tenant_domain_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.platform_domains(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, domain_id)
);

CREATE TABLE IF NOT EXISTS public.user_domain_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.platform_domains(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_domain_assignments_tenant ON public.tenant_domain_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domain_assignments_domain ON public.tenant_domain_assignments(domain_id);
CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_user_tenant ON public.user_domain_assignments(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_domain_assignments_domain ON public.user_domain_assignments(domain_id);

ALTER TABLE public.tenant_domain_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_domain_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage tenant domain assignments" ON public.tenant_domain_assignments;
DROP POLICY IF EXISTS "Tenant members view tenant domain assignments" ON public.tenant_domain_assignments;
DROP POLICY IF EXISTS "Platform admins manage user domain assignments" ON public.user_domain_assignments;
DROP POLICY IF EXISTS "Users view own domain assignments" ON public.user_domain_assignments;
DROP POLICY IF EXISTS "Tenant admins view tenant user domain assignments" ON public.user_domain_assignments;

CREATE POLICY "Platform admins manage tenant domain assignments"
  ON public.tenant_domain_assignments
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Tenant members view tenant domain assignments"
  ON public.tenant_domain_assignments
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Platform admins manage user domain assignments"
  ON public.user_domain_assignments
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Users view own domain assignments"
  ON public.user_domain_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins view tenant user domain assignments"
  ON public.user_domain_assignments
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'tenant_admin')
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

INSERT INTO public.tenant_domain_assignments (tenant_id, domain_id, created_by)
SELECT t.id, t.domain_id, auth.uid()
FROM public.tenants t
WHERE t.domain_id IS NOT NULL
ON CONFLICT (tenant_id, domain_id) DO NOTHING;

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

    SELECT ur.tenant_id
    INTO v_owned_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
    ORDER BY
      CASE ur.role
        WHEN 'tenant_admin' THEN 1
        WHEN 'franchise_admin' THEN 2
        WHEN 'user' THEN 3
        ELSE 4
      END
    LIMIT 1;

    v_effective_tenant_id := COALESCE(p_tenant_id, v_owned_tenant_id);

    IF p_tenant_id IS NOT NULL AND v_owned_tenant_id IS NOT NULL AND p_tenant_id <> v_owned_tenant_id THEN
        RAISE EXCEPTION 'Admin override cannot cross tenant boundaries';
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

    SELECT ur.tenant_id
    INTO v_owned_tenant_id
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id IS NOT NULL
    ORDER BY
      CASE ur.role
        WHEN 'tenant_admin' THEN 1
        WHEN 'franchise_admin' THEN 2
        WHEN 'user' THEN 3
        ELSE 4
      END
    LIMIT 1;

    v_effective_tenant_id := COALESCE(p_tenant_id, v_owned_tenant_id);

    IF NOT v_is_platform_admin THEN
      v_effective_tenant_id := public.get_user_tenant_id(auth.uid());
      IF p_tenant_id IS NOT NULL AND p_tenant_id <> v_effective_tenant_id THEN
        RAISE EXCEPTION 'Scope update cannot cross tenant boundaries';
      END IF;
    ELSIF v_owned_tenant_id IS NOT NULL AND p_tenant_id IS NOT NULL AND p_tenant_id <> v_owned_tenant_id THEN
      RAISE EXCEPTION 'Scope update cannot cross tenant boundaries';
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

UPDATE public.user_preferences up
SET tenant_id = derived.tenant_id,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (ur.user_id) ur.user_id, ur.tenant_id
  FROM public.user_roles ur
  WHERE ur.tenant_id IS NOT NULL
  ORDER BY
    ur.user_id,
    CASE ur.role
      WHEN 'tenant_admin' THEN 1
      WHEN 'franchise_admin' THEN 2
      WHEN 'user' THEN 3
      ELSE 4
    END,
    ur.tenant_id
) derived
WHERE up.user_id = derived.user_id
  AND up.admin_override_enabled = true
  AND up.tenant_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles pr
    WHERE pr.user_id = up.user_id
      AND pr.role = 'platform_admin'
  );
