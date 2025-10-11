-- Add INSERT policy for tenant_subscriptions and seed Starter plan
-- Ensures tenant admins can create subscriptions scoped to their tenant
-- and adds a base Starter plan for end-to-end testing.

BEGIN;

-- INSERT policy: Tenant admins can create subscriptions for their own tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_subscriptions'
      AND policyname = 'Tenant admins can create own subscriptions'
  ) THEN
    CREATE POLICY "Tenant admins can create own subscriptions"
      ON public.tenant_subscriptions
      FOR INSERT
      WITH CHECK (
        public.has_role(auth.uid(), 'tenant_admin'::app_role)
        AND tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;

-- Seed Starter plan if it does not already exist
INSERT INTO public.subscription_plans (
  name,
  slug,
  plan_type,
  tier,
  billing_period,
  price_monthly,
  price_annual,
  currency,
  features,
  limits,
  is_active,
  sort_order,
  description
)
VALUES (
  'Starter',
  'starter',
  'crm_base',
  'starter',
  'monthly',
  49.00,
  470.40,
  'USD',
  '["leads","accounts","contacts","opportunities","activities","basic reporting"]'::jsonb,
  '{"users":5,"emails_per_month":5000,"api_calls":100000}'::jsonb,
  true,
  1,
  'Perfect for small teams getting started with CRM'
)
ON CONFLICT (slug)
DO UPDATE SET
  name = EXCLUDED.name,
  plan_type = EXCLUDED.plan_type,
  tier = EXCLUDED.tier,
  billing_period = EXCLUDED.billing_period,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  description = EXCLUDED.description,
  updated_at = now();

COMMIT;