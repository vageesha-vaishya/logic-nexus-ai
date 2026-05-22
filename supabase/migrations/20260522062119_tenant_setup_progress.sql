-- tenant_setup_progress — per-(tenant, domain, task_key) checklist state
-- for the "Get set up" panel on the new-tenant Home dashboard (Phase C,
-- task U-C1).
--
-- Task definitions themselves live in TypeScript so we can iterate
-- without DB migrations every time. The DB only stores the *state* per
-- task_key: pending | completed | dismissed. Trigger-based promotions
-- (Stripe pattern, U-C3) flip pending → completed when the user does
-- the gated action; the panel surfaces remaining pending items.
--
-- See docs/plans/2026-05-22-unified-platform-onboarding-design.md.

CREATE TABLE IF NOT EXISTS public.tenant_setup_progress (
  tenant_id    uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  domain_code  text        NOT NULL,
  task_key     text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  dismissed_at timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, domain_code, task_key)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_setup_progress_status_values') THEN
    ALTER TABLE public.tenant_setup_progress
      ADD CONSTRAINT tenant_setup_progress_status_values
      CHECK (status IN ('pending', 'completed', 'dismissed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_setup_progress_tenant_domain_status
  ON public.tenant_setup_progress (tenant_id, domain_code, status);

ALTER TABLE public.tenant_setup_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_setup_progress_member_select ON public.tenant_setup_progress;
CREATE POLICY tenant_setup_progress_member_select
  ON public.tenant_setup_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.tenant_id = tenant_setup_progress.tenant_id
    )
  );

DROP POLICY IF EXISTS tenant_setup_progress_admin_write ON public.tenant_setup_progress;
CREATE POLICY tenant_setup_progress_admin_write
  ON public.tenant_setup_progress FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.tenant_id = tenant_setup_progress.tenant_id
        AND  ur.role IN ('tenant_admin'::public.app_role,
                         'franchise_admin'::public.app_role,
                         'platform_admin'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE  ur.user_id   = (SELECT auth.uid())
        AND  ur.tenant_id = tenant_setup_progress.tenant_id
        AND  ur.role IN ('tenant_admin'::public.app_role,
                         'franchise_admin'::public.app_role,
                         'platform_admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS tenant_setup_progress_service_role_all ON public.tenant_setup_progress;
CREATE POLICY tenant_setup_progress_service_role_all
  ON public.tenant_setup_progress FOR ALL TO public
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.tenant_setup_progress IS
  'Per-(tenant, domain, task_key) state for the new-tenant "Get set up" panel. Task definitions live in TypeScript (src/features/onboarding/setup-cards); this table is just the state machine: pending | completed | dismissed. See docs/plans/2026-05-22-unified-platform-onboarding-design.md.';
