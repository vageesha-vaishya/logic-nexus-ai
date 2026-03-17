-- DB-VERIFICATION: schema-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-signoff

DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_domain_admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.domain_tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.platform_domains(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, domain_id)
);

CREATE TABLE IF NOT EXISTS public.domain_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  domain_id uuid REFERENCES public.platform_domains(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quotation_domain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_id uuid NOT NULL REFERENCES public.platform_domains(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, domain_id)
);

CREATE INDEX IF NOT EXISTS idx_domain_tenant_tenant_id ON public.domain_tenant(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domain_tenant_domain_id ON public.domain_tenant(domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_audit_log_batch_id ON public.domain_audit_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_domain_audit_log_tenant_id ON public.domain_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotation_domain_quote_id ON public.quotation_domain(quote_id);
CREATE INDEX IF NOT EXISTS idx_quotation_domain_tenant_domain ON public.quotation_domain(tenant_id, domain_id);

ALTER TABLE public.domain_tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_domain ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform domain admins manage domain_tenant" ON public.domain_tenant;
CREATE POLICY "Platform domain admins manage domain_tenant"
  ON public.domain_tenant
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_domain_admin')
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_domain_admin')
  );

DROP POLICY IF EXISTS "Tenant users view own domain_tenant" ON public.domain_tenant;
CREATE POLICY "Tenant users view own domain_tenant"
  ON public.domain_tenant
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS "Platform domain admins manage domain_audit_log" ON public.domain_audit_log;
CREATE POLICY "Platform domain admins manage domain_audit_log"
  ON public.domain_audit_log
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_domain_admin')
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_domain_admin')
  );

DROP POLICY IF EXISTS "Tenant admins view own domain_audit_log" ON public.domain_audit_log;
CREATE POLICY "Tenant admins view own domain_audit_log"
  ON public.domain_audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'tenant_admin')
    AND tenant_id = public.get_user_tenant_id(auth.uid())
  );

DROP POLICY IF EXISTS "Platform domain admins manage quotation_domain" ON public.quotation_domain;
CREATE POLICY "Platform domain admins manage quotation_domain"
  ON public.quotation_domain
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_domain_admin')
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_domain_admin')
  );

DROP POLICY IF EXISTS "Tenant users view own quotation_domain" ON public.quotation_domain;
CREATE POLICY "Tenant users view own quotation_domain"
  ON public.quotation_domain
  FOR SELECT
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

INSERT INTO public.domain_tenant (tenant_id, domain_id, assigned_by, is_active)
SELECT tda.tenant_id, tda.domain_id, tda.created_by, tda.is_active
FROM public.tenant_domain_assignments tda
ON CONFLICT (tenant_id, domain_id) DO UPDATE
SET is_active = EXCLUDED.is_active;

INSERT INTO public.auth_permissions (id, category, description)
VALUES
  ('domains.assign', 'domain_management', 'Assign domains to tenants and users'),
  ('domains.revoke', 'domain_management', 'Revoke domain assignments'),
  ('domains.audit.view', 'domain_management', 'View domain assignment audit history')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth_roles (id, label, description, level, can_manage_scopes, is_system)
VALUES ('platform_domain_admin', 'Platform Domain Admin', 'Manages platform domain assignment and isolation', 90, ARRAY['platform'], true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.auth_role_permissions (role_id, permission_id)
VALUES
  ('platform_domain_admin', 'domains.assign'),
  ('platform_domain_admin', 'domains.revoke'),
  ('platform_domain_admin', 'domains.audit.view'),
  ('platform_domain_admin', 'admin.settings.manage')
ON CONFLICT DO NOTHING;
