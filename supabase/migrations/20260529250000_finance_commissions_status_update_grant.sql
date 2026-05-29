-- Phase 5 — let tenant admins flip commission status through the read
-- view. The cross-module consumer (service_role) creates commissions
-- in 'pending'; the admin UI walks them through
-- pending → approved → paid, or cancels at any non-paid step.
--
-- Two changes:
--   1. RLS UPDATE policy on finance.commissions for the tenant.
--   2. Column-level GRANT UPDATE (status) on public.v_commissions —
--      everything else stays read-only (rate, amount, source_outbox_id,
--      etc. are write-once at consumer time).

CREATE POLICY commissions_tenant_update ON finance.commissions
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

GRANT UPDATE (status) ON public.v_commissions TO authenticated;
