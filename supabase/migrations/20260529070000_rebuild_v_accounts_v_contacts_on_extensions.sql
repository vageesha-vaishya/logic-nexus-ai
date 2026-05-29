-- Phase 4 CRM Step 2 — rebuild v_accounts / v_contacts on top of crm.*_extensions
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- After Phase 4 Step 1 backfilled crm.account_extensions and
-- crm.contact_extensions (migration 20260529060000), the read path can
-- skip public.accounts / public.contacts entirely. This migration swaps
-- the LEFT JOIN target in the views from the legacy tables to the new
-- extensions while keeping the same column shape — frontend keeps working
-- without any code changes.
--
-- This is the read-side prerequisite for the parked Phase 2 Step 9 DROP
-- to eventually unpark: once nothing reads public.accounts/contacts,
-- and dual-write triggers have kept the extensions current for 30 days,
-- the legacy tables can drop without consumer impact.
--
-- DROP VIEW (not CREATE OR REPLACE): column order on the view must remain
-- byte-identical to the previous version OR PostgreSQL rejects the
-- replace. Easier to drop + recreate. The frontend's PostgREST query
-- shape only cares about column NAMES, not order.

DROP VIEW IF EXISTS public.v_accounts;
DROP VIEW IF EXISTS public.v_contacts;

-- ══════════════════════════════════════════════════════════════════════
-- public.v_accounts — identity from core.parties, CRM from crm.account_extensions
-- ══════════════════════════════════════════════════════════════════════

CREATE VIEW public.v_accounts AS
SELECT
  -- Identity from core.parties (unchanged from previous version)
  p.id,
  p.tenant_id,
  p.display_name           AS name,
  p.legal_name,
  p.status,
  p.created_at,
  p.updated_at,
  -- CRM-only columns — now from crm.account_extensions (was public.accounts)
  x.franchise_id,
  x.account_type,
  x.industry,
  x.website,
  x.phone,
  x.email,
  x.billing_address,
  x.shipping_address,
  x.annual_revenue,
  x.employee_count,
  x.description,
  x.owner_id,
  x.created_by,
  x.parent_account_id,
  x.account_number,
  x.account_site,
  x.fax,
  x.ticker_symbol,
  x.ownership,
  x.rating,
  x.sic_code,
  x.duns_number,
  x.naics_code,
  x.billing_street,
  x.billing_city,
  x.billing_state,
  x.billing_postal_code,
  x.billing_country,
  x.shipping_street,
  x.shipping_city,
  x.shipping_state,
  x.shipping_postal_code,
  x.shipping_country,
  x.number_of_locations,
  x.active,
  x.sla,
  x.sla_expiration_date,
  x.customer_priority,
  x.support_tier,
  x.upsell_opportunity,
  x.custom_fields,
  x.last_activity_at,
  x.social_profiles,
  x.tax_id,
  x.legacy_json,
  -- core-side metadata (unchanged from previous version)
  p.external_refs
FROM core.parties p
LEFT JOIN crm.account_extensions x ON x.party_id = p.id
WHERE p.party_type = 'organization';

COMMENT ON VIEW public.v_accounts IS
  'Phase 4 CRM Step 2 — rebuilt 2026-05-29 to JOIN crm.account_extensions instead of public.accounts. Read path no longer touches the legacy table. Identity columns still from core.parties.';

GRANT SELECT ON public.v_accounts TO authenticated;
GRANT SELECT ON public.v_accounts TO service_role;

ALTER VIEW public.v_accounts SET (security_invoker = true);

-- ══════════════════════════════════════════════════════════════════════
-- public.v_contacts — identity from core.parties, CRM from crm.contact_extensions
-- ══════════════════════════════════════════════════════════════════════

CREATE VIEW public.v_contacts AS
SELECT
  p.id,
  p.tenant_id,
  p.first_name,
  p.last_name,
  p.display_name        AS name,
  p.status,
  p.created_at,
  p.updated_at,
  -- CRM-only columns from crm.contact_extensions (was public.contacts)
  x.franchise_id,
  x.account_id,
  x.title,
  x.email,
  x.phone,
  x.mobile,
  x.linkedin_url,
  x.address,
  x.is_primary,
  x.notes,
  x.owner_id,
  x.created_by,
  x.department,
  x.title_level,
  x.reports_to,
  x.lifecycle_stage,
  x.lead_source,
  x.custom_fields,
  x.last_activity_at,
  x.social_profiles,
  x.legacy_json,
  p.external_refs
FROM core.parties p
LEFT JOIN crm.contact_extensions x ON x.party_id = p.id
WHERE p.party_type = 'person';

COMMENT ON VIEW public.v_contacts IS
  'Phase 4 CRM Step 2 — rebuilt 2026-05-29 to JOIN crm.contact_extensions instead of public.contacts. Read path no longer touches the legacy table.';

GRANT SELECT ON public.v_contacts TO authenticated;
GRANT SELECT ON public.v_contacts TO service_role;

ALTER VIEW public.v_contacts SET (security_invoker = true);
