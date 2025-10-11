-- Allow tenant members (any role within tenant) to view subscription and usage
-- This complements existing admin-only policies by adding broader read access.

-- Tenant subscriptions: permit SELECT for users scoped to their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_subscriptions'
      AND policyname = 'Tenant members can view own subscriptions'
  ) THEN
    CREATE POLICY "Tenant members can view own subscriptions"
      ON public.tenant_subscriptions
      FOR SELECT
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;

-- Usage records: permit SELECT for users scoped to their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usage_records'
      AND policyname = 'Tenant members can view own usage records'
  ) THEN
    CREATE POLICY "Tenant members can view own usage records"
      ON public.usage_records
      FOR SELECT
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;

-- Subscription invoices: optional read for tenant members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_invoices'
      AND policyname = 'Tenant members can view own subscription invoices'
  ) THEN
    CREATE POLICY "Tenant members can view own subscription invoices"
      ON public.subscription_invoices
      FOR SELECT
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
      );
  END IF;
END$$;