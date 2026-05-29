-- Phase 5 — PostgREST passthrough views for finance.commission_rules
-- and finance.commissions. Consistent with the v_campaigns /
-- v_campaign_members pattern from Phase 4 CRM Step 4: the finance
-- schema is not exposed via PostgREST, so frontend admin UIs reach
-- through thin security_invoker=true views in public.

CREATE VIEW public.v_commission_rules
WITH (security_invoker = true) AS
SELECT * FROM finance.commission_rules;

COMMENT ON VIEW public.v_commission_rules IS
  'Phase 5 — read/write passthrough for finance.commission_rules. RLS lives on the base table; security_invoker=true passes auth context through.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v_commission_rules TO authenticated;
GRANT ALL ON public.v_commission_rules TO service_role;

CREATE VIEW public.v_commissions
WITH (security_invoker = true) AS
SELECT * FROM finance.commissions;

COMMENT ON VIEW public.v_commissions IS
  'Phase 5 — read passthrough for finance.commissions. Mostly read-only from the UI; writes happen via the cross-module consumer.';

GRANT SELECT ON public.v_commissions TO authenticated;
GRANT ALL ON public.v_commissions TO service_role;
