-- Phase 5 — PostgREST passthrough view for finance.invoices.
-- Consistent with the v_commissions / v_commission_rules pattern:
-- finance is not exposed via PostgREST, so the frontend reaches
-- through a thin security_invoker=true view in public.
--
-- Adds RLS UPDATE policy + column-level grants so the Draft Invoices
-- review page can flip status (draft → issued) and set issue_date on
-- finalize. Other columns stay write-once (cross-module consumer sets
-- them at insert time).

CREATE VIEW public.v_finance_invoices
WITH (security_invoker = true) AS
SELECT * FROM finance.invoices;

COMMENT ON VIEW public.v_finance_invoices IS
  'Phase 5 — read+limited-write passthrough for finance.invoices. Used by the Draft Invoices review page; the existing public.invoices Invoices page reads its own schema separately.';

GRANT SELECT ON public.v_finance_invoices TO authenticated;
GRANT SELECT, UPDATE (status, issue_date, due_date) ON public.v_finance_invoices TO authenticated;
GRANT ALL ON public.v_finance_invoices TO service_role;

CREATE POLICY finance_invoices_tenant_update ON finance.invoices
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
