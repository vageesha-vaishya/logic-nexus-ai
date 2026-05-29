-- Phase 2 Step 4a — read-replacement views v_accounts + v_contacts
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 2 + core.md §3.2
--
-- These views become the read path for what the frontend today calls
-- "accounts" and "contacts". They join the identity columns from
-- core.parties (authoritative after Phase 2 Step 2 backfill) with the
-- CRM-only columns still living on public.accounts / public.contacts.
-- When Phase 4 lifts the CRM-only fields into crm.account_extensions /
-- crm.contact_extensions, this file gets edited to JOIN against the
-- extension table instead.
--
-- Naming: deliberately public.v_accounts / public.v_contacts (not
-- crm.v_*) because PostgREST doesn't currently expose the crm schema.
-- The master plan's `crm.v_*` naming will land in Phase 4 alongside
-- the extension tables + schema-exposure config update.
--
-- Identity columns (id, name, status, timestamps) come from core.parties.
-- CRM-only columns (industry, website, billing_*, custom_fields, ...)
-- come from public.accounts / public.contacts via LEFT JOIN. Every row in
-- core.parties of the right party_type appears; the JOIN is left so a
-- party that has no source row (newly created post-cutover) still shows.
--
-- These views are SELECT-only. Writes continue to go to public.accounts
-- / public.contacts until Step 6 introduces dual-write triggers, and
-- INSTEAD-OF triggers on the views themselves land if/when callers
-- start writing via supabase.from('v_accounts').update().

-- ══════════════════════════════════════════════════════════════════════
-- public.v_accounts
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_accounts AS
SELECT
  -- Identity from core.parties (authoritative)
  p.id,
  p.tenant_id,
  p.display_name           AS name,
  p.legal_name,
  -- core.parties.status uses 'active' | 'archived' | 'merged'; public.accounts.status
  -- used an enum (USER-DEFINED) — we expose the core value for the read path
  -- but keep both columns for callers that referenced the old name.
  p.status                 AS status,
  p.created_at,
  p.updated_at,
  -- Pass-through CRM-only columns from public.accounts (lifted to
  -- crm.account_extensions in Phase 4)
  a.franchise_id,
  a.account_type,
  a.industry,
  a.website,
  a.phone,
  a.email,
  a.billing_address,
  a.shipping_address,
  a.annual_revenue,
  a.employee_count,
  a.description,
  a.owner_id,
  a.created_by,
  a.parent_account_id,
  a.account_number,
  a.account_site,
  a.fax,
  a.ticker_symbol,
  a.ownership,
  a.rating,
  a.sic_code,
  a.duns_number,
  a.naics_code,
  a.billing_street,
  a.billing_city,
  a.billing_state,
  a.billing_postal_code,
  a.billing_country,
  a.shipping_street,
  a.shipping_city,
  a.shipping_state,
  a.shipping_postal_code,
  a.shipping_country,
  a.number_of_locations,
  a.active,
  a.sla,
  a.sla_expiration_date,
  a.customer_priority,
  a.support_tier,
  a.upsell_opportunity,
  a.custom_fields,
  a.last_activity_at,
  a.social_profiles,
  a.tax_id,
  a.legacy_json,
  -- core-side metadata
  p.external_refs
FROM core.parties p
LEFT JOIN public.accounts a ON a.id = p.id
WHERE p.party_type = 'organization';

COMMENT ON VIEW public.v_accounts IS
  'Phase 2 Step 4a read-replacement view for public.accounts. Identity columns come from core.parties; CRM-only columns from public.accounts via LEFT JOIN. Will move to crm.v_accounts in Phase 4 when crm.account_extensions lands.';

GRANT SELECT ON public.v_accounts TO authenticated;
GRANT SELECT ON public.v_accounts TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- public.v_contacts
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_contacts AS
SELECT
  p.id,
  p.tenant_id,
  p.first_name,
  p.last_name,
  p.display_name        AS name,
  p.status,
  p.created_at,
  p.updated_at,
  -- CRM-only columns from public.contacts
  c.franchise_id,
  c.account_id,
  c.title,
  c.email,
  c.phone,
  c.mobile,
  c.linkedin_url,
  c.address,
  c.is_primary,
  c.notes,
  c.owner_id,
  c.created_by,
  c.department,
  c.title_level,
  c.reports_to,
  c.lifecycle_stage,
  c.lead_source,
  c.custom_fields,
  c.last_activity_at,
  c.social_profiles,
  c.legacy_json,
  -- core-side metadata
  p.external_refs
FROM core.parties p
LEFT JOIN public.contacts c ON c.id = p.id
WHERE p.party_type = 'person';

COMMENT ON VIEW public.v_contacts IS
  'Phase 2 Step 4a read-replacement view for public.contacts. Identity columns come from core.parties; CRM-only columns from public.contacts via LEFT JOIN. Will move to crm.v_contacts in Phase 4 when crm.contact_extensions lands.';

GRANT SELECT ON public.v_contacts TO authenticated;
GRANT SELECT ON public.v_contacts TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- RLS via security_invoker — views run with the caller's privileges
-- ══════════════════════════════════════════════════════════════════════
--
-- security_invoker=true (PG15+) makes the view inherit RLS from the
-- underlying tables: SELECT goes through core.parties.parties_tenant_select
-- + public.accounts/contacts whatever-policies. Without this, the view
-- would run as its owner and bypass RLS on the underlying tables — a
-- silent tenant-isolation leak.
--
-- public.accounts / public.contacts already have their own RLS policies
-- enforcing tenant scope; core.parties does too. The view simply
-- delegates.

ALTER VIEW public.v_accounts SET (security_invoker = true);
ALTER VIEW public.v_contacts SET (security_invoker = true);
