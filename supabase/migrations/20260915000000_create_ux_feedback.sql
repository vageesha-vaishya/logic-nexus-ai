-- Plan 3 (usability feedback apparatus) — see
-- docs/superpowers/specs/2026-09-13-design-system-verification-and-usability-design.md §5.1
-- and docs/superpowers/plans/2026-09-15-usability-feedback-apparatus.md.
--
-- NOT APPLIED by any automated process. Apply locally (supabase db reset)
-- or to the self-hosted instance only after explicit confirmation — see
-- the plan's Global Constraints.

CREATE TABLE public.ux_feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round        smallint NOT NULL,
  task_id      text,
  route        text NOT NULL,
  completed    text CHECK (completed IN ('yes', 'partial', 'no')),
  ease         smallint CHECK (ease BETWEEN 1 AND 5),
  comment      text,
  viewport_w   integer,
  viewport_h   integer,
  theme_mode   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ux_feedback IS
  'In-app usability-round feedback (Plan 3). One row per widget submission.';

CREATE INDEX ux_feedback_tenant_round_idx ON public.ux_feedback (tenant_id, round);
CREATE INDEX ux_feedback_round_task_idx   ON public.ux_feedback (round, task_id);

ALTER TABLE public.ux_feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may insert exactly one row for themself, scoped to
-- their own tenant (public.get_user_tenant_id resolves the caller's tenant
-- from public.user_roles — see the live definition in
-- 20260128100001_fix_profiles_rls.sql: no role filter, just
-- `SELECT tenant_id FROM public.user_roles WHERE user_id = ... LIMIT 1`
-- with no ORDER BY, so it covers ordinary staff, not just admins, but is
-- not well-defined if a user ever has more than one user_roles row).
CREATE POLICY ux_feedback_insert_own ON public.ux_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );

-- Tenant admins (and franchise admins) read their own tenant's rows;
-- platform admin reads everything.
CREATE POLICY ux_feedback_select_admin ON public.ux_feedback
  FOR SELECT TO authenticated
  USING (
    public.is_platform_admin((SELECT auth.uid()))
    OR (
      tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
      AND (
        public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
        OR public.has_role((SELECT auth.uid()), 'franchise_admin'::public.app_role)
      )
    )
  );

-- No UPDATE or DELETE policies: RLS denies both by default once enabled,
-- and feedback rows are immutable by design (spec §5.1: "no update/delete
-- from clients").

-- Feature flag, disabled by default. Uses platform.feature_flags (schema
-- "platform", not "public" — see 20260516080945_platform_feature_flags.sql).
INSERT INTO platform.feature_flags (key, name, description, enabled, tags)
VALUES (
  'ux_feedback_widget',
  'Usability feedback widget',
  'Floating in-app widget collecting task-completion/ease/comment feedback for a usability-testing round. See docs/design-system/usability/PROTOCOL.md.',
  false,
  ARRAY['design-system']
)
ON CONFLICT (key) DO NOTHING;
