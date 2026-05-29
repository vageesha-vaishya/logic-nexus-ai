-- Phase 4 CRM Step 4 (continued) — public views for crm.campaigns / crm.campaign_members
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- PostgREST's exposed-schemas list on prod is {public, graphql_public,
-- markets, platform, core, comms}. crm is not exposed, so the frontend
-- cannot reach crm.campaigns directly. Two ways to fix that:
--
--   1. Add 'crm' to the exposed-schemas array in the Supabase dashboard.
--      Clean but couples this slice to a one-off config change.
--   2. Create thin public.v_* views that wrap crm.* with security_invoker=true.
--      Consistent with the v_accounts / v_contacts pattern already shipped
--      in Phase 1 / Phase 4 CRM Step 2, and updatable through PostgREST
--      because they're simple 1:1 SELECTs on a single base table.
--
-- Going with (2) — keeps the API surface uniform and lets future writers
-- INSERT / UPDATE / DELETE through PostgREST as if they were public tables.
-- The base tables remain crm.* and RLS lives on the base tables.

CREATE VIEW public.v_campaigns
WITH (security_invoker = true) AS
SELECT * FROM crm.campaigns;

COMMENT ON VIEW public.v_campaigns IS
  'Phase 4 CRM Step 4 — read/write passthrough for crm.campaigns. RLS lives on the base table; security_invoker=true passes auth context through.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v_campaigns TO authenticated;
GRANT ALL ON public.v_campaigns TO service_role;

CREATE VIEW public.v_campaign_members
WITH (security_invoker = true) AS
SELECT * FROM crm.campaign_members;

COMMENT ON VIEW public.v_campaign_members IS
  'Phase 4 CRM Step 4 — read/write passthrough for crm.campaign_members. RLS lives on the base table; security_invoker=true passes auth context through.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v_campaign_members TO authenticated;
GRANT ALL ON public.v_campaign_members TO service_role;
