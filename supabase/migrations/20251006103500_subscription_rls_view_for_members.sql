-- Allow tenant members (any role within tenant) to view subscription and usage
-- This complements existing admin-only policies by adding broader read access.

-- Tenant subscriptions: permit SELECT for users scoped to their tenant
CREATE POLICY IF NOT EXISTS "Tenant members can view own subscriptions"
  ON public.tenant_subscriptions
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- Usage records: permit SELECT for users scoped to their tenant
CREATE POLICY IF NOT EXISTS "Tenant members can view own usage records"
  ON public.usage_records
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );

-- Subscription invoices: optional read for tenant members
CREATE POLICY IF NOT EXISTS "Tenant members can view own subscription invoices"
  ON public.subscription_invoices
  FOR SELECT
  USING (
    tenant_id = public.get_user_tenant_id(auth.uid())
  );