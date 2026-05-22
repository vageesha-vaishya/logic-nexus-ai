-- Unified platform onboarding — foundation migration (Phase A · task U-A1).
-- See docs/plans/2026-05-22-unified-platform-onboarding-design.md.
--
-- Lands four pieces that unblock the rest of Phase A:
--   1. subscription_plans.domain_id — kills the duplicate-Starter bug by
--      tagging each plan to its platform_domain. Backfill is plan_type=lnai
--      → markets, plan_type=crm_base → logistics.
--   2. Freemium plans for both self-serve domains (logistics, markets) so
--      provision_org_tenant has a default plan_id to assign new tenants.
--   3. tenant_domain_assignments extensions: plan_id, trial_ends_at,
--      activated_at, razorpay_subscription_id + a (tenant_id, domain_id)
--      uniqueness guard. The existing subscription_status text column is
--      reused for the active|trialing|past_due|cancelled state machine.
--   4. user_active_membership table — stores which user_roles row the
--      user is currently operating under. Read by useActiveMembership()
--      at app boot; written by the topbar context switcher.

-- ─── 1. subscription_plans.domain_id ────────────────────────────────────────

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS domain_id uuid REFERENCES public.platform_domains(id);

-- Backfill: plan_type drives the mapping. lnai-* are Markets-advisor
-- plans, crm_base-* are Logistics plans. Any future plan_type values
-- need explicit domain_id assignment at insert time.
UPDATE public.subscription_plans sp
SET    domain_id = pd.id
FROM   public.platform_domains pd
WHERE  sp.domain_id IS NULL
  AND  pd.code = CASE
         WHEN sp.plan_type = 'lnai'     THEN 'markets'
         WHEN sp.plan_type = 'crm_base' THEN 'logistics'
       END;

-- Enforce NOT NULL once every existing row is tagged. If a future
-- plan_type lands without a domain mapping the INSERT will fail loud
-- rather than silently corrupting the catalog.
DO $$
DECLARE
  v_untagged int;
BEGIN
  SELECT count(*) INTO v_untagged
  FROM   public.subscription_plans
  WHERE  domain_id IS NULL;

  IF v_untagged > 0 THEN
    RAISE EXCEPTION 'Cannot mark subscription_plans.domain_id NOT NULL — % untagged rows', v_untagged;
  END IF;
END $$;

ALTER TABLE public.subscription_plans
  ALTER COLUMN domain_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_domain_id_active
  ON public.subscription_plans (domain_id) WHERE is_active = true;

COMMENT ON COLUMN public.subscription_plans.domain_id IS
  'Which platform_domain this plan belongs to. Filters the package catalog in the B2B signup wizard so we never show duplicate "Starter" tiles across domains (2026-05-22 fix). Backfill rule: plan_type=lnai → markets, plan_type=crm_base → logistics.';

-- ─── 2. Freemium plan seeds (one per self-serve domain) ─────────────────────

INSERT INTO public.subscription_plans (
  slug, name, plan_type, tier, billing_period,
  price_monthly, price_annual, currency,
  features, limits, is_active, domain_id, description, sort_order
)
SELECT 'logistics-freemium', 'Free', 'crm_base', 'free'::subscription_tier, 'monthly',
       0, 0, 'INR',
       '["1 user","50 shipments / month","Basic dashboard","Community support"]'::jsonb,
       '{"users":1,"shipments_per_month":50,"storage_gb":1}'::jsonb,
       true, pd.id,
       'Free forever for very small teams. Upgrade for more users + integrations.',
       0
FROM   public.platform_domains pd
WHERE  pd.code = 'logistics'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.subscription_plans (
  slug, name, plan_type, tier, billing_period,
  price_monthly, price_annual, currency,
  features, limits, is_active, domain_id, description, sort_order
)
SELECT 'markets-freemium', 'Free', 'lnai', 'free'::subscription_tier, 'monthly',
       0, 0, 'INR',
       '["1 advisor","1 portfolio","50 signals / month","Paper trading only"]'::jsonb,
       '{"users":1,"portfolios":1,"signals_per_month":50}'::jsonb,
       true, pd.id,
       'Free forever for solo advisors. Upgrade for more advisors + unlimited signals.',
       0
FROM   public.platform_domains pd
WHERE  pd.code = 'markets'
ON CONFLICT (slug) DO NOTHING;

-- ─── 3. tenant_domain_assignments extensions ────────────────────────────────

ALTER TABLE public.tenant_domain_assignments
  ADD COLUMN IF NOT EXISTS plan_id                 uuid REFERENCES public.subscription_plans(id),
  ADD COLUMN IF NOT EXISTS trial_ends_at           timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at            timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

-- One assignment per (tenant, domain). The existing schema allowed
-- duplicates; tighten it now while no production data violates it.
DO $$
DECLARE
  v_dupes int;
BEGIN
  SELECT count(*) INTO v_dupes
  FROM (
    SELECT tenant_id, domain_id, count(*) AS c
    FROM   public.tenant_domain_assignments
    GROUP  BY tenant_id, domain_id
    HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'Cannot add unique index — % duplicate (tenant_id, domain_id) pairs exist', v_dupes;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tenant_domain_assignments_tenant_domain
  ON public.tenant_domain_assignments (tenant_id, domain_id);

COMMENT ON COLUMN public.tenant_domain_assignments.plan_id IS
  'Which subscription_plans row this assignment runs on. NULL only during the transition window before checkout is wired (2026-05-22 onwards).';
COMMENT ON COLUMN public.tenant_domain_assignments.trial_ends_at IS
  '14-day no-card trial expiry. When passed and razorpay_subscription_id is still NULL, the nightly auto-downgrade cron flips subscription_status=active + plan_id=freemium.';
COMMENT ON COLUMN public.tenant_domain_assignments.razorpay_subscription_id IS
  'Razorpay subscription id once the user adds a card and the trial converts to paid. NULL while trialing or on freemium.';
COMMENT ON COLUMN public.tenant_domain_assignments.subscription_status IS
  'State machine for billing: active | trialing | past_due | cancelled. Default active works for both freemium (no trial) and paid (after card add).';

-- ─── 4. user_active_membership ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_active_membership (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id)       ON DELETE CASCADE,
  membership_id uuid NOT NULL  REFERENCES public.user_roles(id)  ON DELETE CASCADE,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_active_membership IS
  'Which user_roles row the user is currently operating under. One row per user; the topbar context switcher writes here, useActiveMembership() reads it on every app boot. RLS limits read/write to the owning user. See docs/plans/2026-05-22-unified-platform-onboarding-design.md.';

ALTER TABLE public.user_active_membership ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_active_membership_owner_select
  ON public.user_active_membership FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_active_membership_owner_insert
  ON public.user_active_membership FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_active_membership_owner_update
  ON public.user_active_membership FOR UPDATE TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY user_active_membership_owner_delete
  ON public.user_active_membership FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_active_membership_service_role_all
  ON public.user_active_membership FOR ALL TO public
  USING      (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
