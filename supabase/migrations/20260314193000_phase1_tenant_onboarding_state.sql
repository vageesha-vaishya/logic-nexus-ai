BEGIN;

ALTER TABLE public.tenant_profile
ADD COLUMN IF NOT EXISTS tax_jurisdiction TEXT,
ADD COLUMN IF NOT EXISTS tax_registration_type TEXT,
ADD COLUMN IF NOT EXISTS gstin TEXT,
ADD COLUMN IF NOT EXISTS vat_number TEXT,
ADD COLUMN IF NOT EXISTS cin_or_registration_number TEXT,
ADD COLUMN IF NOT EXISTS kyc_status TEXT;

CREATE TABLE IF NOT EXISTS public.tenant_onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft',
    current_step TEXT NOT NULL DEFAULT 'identity_legal',
    started_by UUID REFERENCES auth.users(id),
    assigned_support_user_id UUID REFERENCES auth.users(id),
    step_payloads JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_onboarding_sessions_tenant_id
ON public.tenant_onboarding_sessions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_sessions_status
ON public.tenant_onboarding_sessions(status);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_sessions_step
ON public.tenant_onboarding_sessions(current_step);

CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_sessions_updated_at
ON public.tenant_onboarding_sessions(updated_at DESC);

ALTER TABLE public.tenant_onboarding_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins manage tenant profile" ON public.tenant_profile;
CREATE POLICY "Platform admins manage tenant profile"
ON public.tenant_profile
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins can insert their profile" ON public.tenant_profile;
CREATE POLICY "Tenant admins can insert their profile"
ON public.tenant_profile
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Tenant admins can update their profile" ON public.tenant_profile;
CREATE POLICY "Tenant admins can update their profile"
ON public.tenant_profile
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
  AND tenant_id = public.get_user_tenant_id(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'tenant_admin'::public.app_role)
  AND tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Tenant admins can view their profile" ON public.tenant_profile;
CREATE POLICY "Tenant admins can view their profile"
ON public.tenant_profile
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
  OR public.is_platform_admin(auth.uid())
);

DROP POLICY IF EXISTS "Platform admins manage tenant onboarding sessions" ON public.tenant_onboarding_sessions;
CREATE POLICY "Platform admins manage tenant onboarding sessions"
ON public.tenant_onboarding_sessions
FOR ALL
TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Tenant admins view tenant onboarding sessions" ON public.tenant_onboarding_sessions;
CREATE POLICY "Tenant admins view tenant onboarding sessions"
ON public.tenant_onboarding_sessions
FOR SELECT
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Tenant admins insert tenant onboarding sessions" ON public.tenant_onboarding_sessions;
CREATE POLICY "Tenant admins insert tenant onboarding sessions"
ON public.tenant_onboarding_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP POLICY IF EXISTS "Tenant admins update tenant onboarding sessions" ON public.tenant_onboarding_sessions;
CREATE POLICY "Tenant admins update tenant onboarding sessions"
ON public.tenant_onboarding_sessions
FOR UPDATE
TO authenticated
USING (
  tenant_id = public.get_user_tenant_id(auth.uid())
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id(auth.uid())
);

DROP TRIGGER IF EXISTS update_tenant_onboarding_sessions_updated_at ON public.tenant_onboarding_sessions;
CREATE TRIGGER update_tenant_onboarding_sessions_updated_at
BEFORE UPDATE ON public.tenant_onboarding_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_profile_updated_at ON public.tenant_profile;
CREATE TRIGGER update_tenant_profile_updated_at
BEFORE UPDATE ON public.tenant_profile
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON public.tenant_onboarding_sessions TO authenticated;
GRANT SELECT ON public.tenant_onboarding_sessions TO service_role;

COMMIT;
