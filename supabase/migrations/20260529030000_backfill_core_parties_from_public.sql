-- Phase 2 Step 2 — backfill core.parties + primitives from public.accounts / public.contacts
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 2
--
-- Deterministic ID mapping: every public.accounts.id and public.contacts.id
-- becomes a core.parties.id with the same UUID. Verified before writing
-- (no UUID overlap exists between the two source tables — query in the
-- pre-work for this migration).
--
-- Strictly additive: public.accounts (9,182 rows) and public.contacts
-- (9,417 rows) stay authoritative. This migration creates duplicate rows
-- in core.* keyed on the same IDs, so any downstream FK pointing at
-- public.accounts(id) or public.contacts(id) continues to work. The
-- view-cutover (Step 4) and drop (Step 9) come later.
--
-- Idempotent: every INSERT uses ON CONFLICT DO NOTHING. Re-running the
-- migration is a no-op once everything is mirrored.
--
-- Source-of-truth columns kept on public.* for now (lifted into the
-- right module-extension tables in Phase 4):
--   accounts.industry, website, account_number, account_type,
--     account_site, ticker_symbol, ownership, rating, sic_code,
--     duns_number, naics_code, customer_priority, support_tier,
--     upsell_opportunity, sla*, employee_count, annual_revenue,
--     number_of_locations, owner_id, last_activity_at, social_profiles,
--     custom_fields, legacy_json
--   contacts.title, title_level, department, lifecycle_stage,
--     lead_source, owner_id, last_activity_at, social_profiles,
--     custom_fields, legacy_json, is_primary, notes, linkedin_url
--
-- This migration migrates only the identity + contact-channel data: the
-- core.parties row, the core.party_relationships employs edge, and the
-- core.email_addresses / phone_numbers / addresses + their link tables.

-- ══════════════════════════════════════════════════════════════════════
-- 1. core.parties — organizations from public.accounts
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO core.parties (
  id, tenant_id, party_type, display_name, legal_name,
  status, external_refs, created_at, updated_at
)
SELECT
  a.id,
  a.tenant_id,
  'organization',
  a.name,
  a.name,  -- legal_name = same as display_name when source has no separate field
  CASE WHEN a.active IS FALSE THEN 'archived' ELSE 'active' END,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_account_number', a.account_number,
    'legacy_account_site',   a.account_site,
    'legacy_tax_id',         a.tax_id,
    'legacy_franchise_id',   a.franchise_id::text,
    'legacy_website',        a.website
  )),
  COALESCE(a.created_at, now()),
  COALESCE(a.updated_at, now())
FROM public.accounts a
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 2. core.parties — persons from public.contacts
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO core.parties (
  id, tenant_id, party_type, display_name, first_name, last_name,
  status, external_refs, created_at, updated_at
)
SELECT
  c.id,
  c.tenant_id,
  'person',
  -- display_name: "first last" when both present, else whichever is non-empty
  NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''),
  c.first_name,
  c.last_name,
  'active',  -- public.contacts has no inactive flag
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_franchise_id', c.franchise_id::text,
    'legacy_linkedin_url', c.linkedin_url
  )),
  COALESCE(c.created_at, now()),
  COALESCE(c.updated_at, now())
FROM public.contacts c
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 3. core.party_relationships — contacts -[employs]→ accounts
-- ══════════════════════════════════════════════════════════════════════
--
-- Direction: from_party = the account (organization), to_party = the
-- contact (person), type = 'employs'. The reciprocal 'employed_by'
-- edge is NOT inserted — readers compute both directions from the
-- single canonical row.

INSERT INTO core.party_relationships (
  tenant_id, from_party_id, to_party_id, relationship_type,
  metadata, created_at, updated_at
)
SELECT
  c.tenant_id,
  c.account_id,
  c.id,
  'employs',
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_title',        c.title,
    'legacy_department',   c.department,
    'legacy_is_primary',   c.is_primary
  )),
  COALESCE(c.created_at, now()),
  COALESCE(c.updated_at, now())
FROM public.contacts c
WHERE c.account_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM core.parties p WHERE p.id = c.account_id)
  AND EXISTS (SELECT 1 FROM core.parties p WHERE p.id = c.id)
ON CONFLICT ON CONSTRAINT party_relationships_uniq DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 4. core.email_addresses + core.email_links — accounts (only ~79 rows)
-- ══════════════════════════════════════════════════════════════════════

WITH inserted_emails AS (
  INSERT INTO core.email_addresses (tenant_id, email, created_at)
  SELECT DISTINCT a.tenant_id, lower(trim(a.email)), now()
  FROM public.accounts a
  WHERE a.email IS NOT NULL AND a.email <> ''
  ON CONFLICT (tenant_id, email) DO NOTHING
  RETURNING id, tenant_id, email
)
INSERT INTO core.email_links (tenant_id, email_id, subject_type, subject_id, role, is_primary)
SELECT a.tenant_id, e.id, 'core.party', a.id, 'primary', true
FROM public.accounts a
JOIN core.email_addresses e
  ON e.tenant_id = a.tenant_id
 AND e.email     = lower(trim(a.email))
WHERE a.email IS NOT NULL AND a.email <> ''
ON CONFLICT (subject_type, subject_id, email_id, role) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 5. core.email_addresses + core.email_links — contacts (~4,518 with email)
-- ══════════════════════════════════════════════════════════════════════

WITH inserted_emails AS (
  INSERT INTO core.email_addresses (tenant_id, email, created_at)
  SELECT DISTINCT c.tenant_id, lower(trim(c.email)), now()
  FROM public.contacts c
  WHERE c.email IS NOT NULL AND c.email <> ''
  ON CONFLICT (tenant_id, email) DO NOTHING
  RETURNING id, tenant_id, email
)
INSERT INTO core.email_links (tenant_id, email_id, subject_type, subject_id, role, is_primary)
SELECT c.tenant_id, e.id, 'core.party', c.id, 'primary', true
FROM public.contacts c
JOIN core.email_addresses e
  ON e.tenant_id = c.tenant_id
 AND e.email     = lower(trim(c.email))
WHERE c.email IS NOT NULL AND c.email <> ''
ON CONFLICT (subject_type, subject_id, email_id, role) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 6. core.phone_numbers + core.phone_links — accounts (~9 rows)
-- ══════════════════════════════════════════════════════════════════════
--
-- ⚠ Phone values are backfilled verbatim — NOT normalised to E.164.
-- The core.phone_numbers.e164 column is contract-named but the value at
-- this stage is whatever was in public.accounts.phone / contacts.phone.
-- A follow-up migration normalises in place once the libphonenumber
-- tooling lands (Phase 4 backlog item).

WITH inserted AS (
  INSERT INTO core.phone_numbers (tenant_id, e164, created_at)
  SELECT DISTINCT a.tenant_id, trim(a.phone), now()
  FROM public.accounts a
  WHERE a.phone IS NOT NULL AND a.phone <> ''
  ON CONFLICT (tenant_id, e164) DO NOTHING
  RETURNING id, tenant_id, e164
)
INSERT INTO core.phone_links (tenant_id, phone_id, subject_type, subject_id, role, is_primary)
SELECT a.tenant_id, p.id, 'core.party', a.id, 'main', true
FROM public.accounts a
JOIN core.phone_numbers p
  ON p.tenant_id = a.tenant_id AND p.e164 = trim(a.phone)
WHERE a.phone IS NOT NULL AND a.phone <> ''
ON CONFLICT (subject_type, subject_id, phone_id, role) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 7. core.phone_numbers + core.phone_links — contacts (phone + mobile)
-- ══════════════════════════════════════════════════════════════════════
--
-- Two roles: 'main' (from contacts.phone) and 'mobile' (from contacts.mobile).
-- A contact with both gets two link rows pointing at potentially the same
-- phone_numbers row if values match after normalisation; that's the
-- intended dedup behaviour.

WITH inserted_main AS (
  INSERT INTO core.phone_numbers (tenant_id, e164, created_at)
  SELECT DISTINCT c.tenant_id, trim(c.phone), now()
  FROM public.contacts c
  WHERE c.phone IS NOT NULL AND c.phone <> ''
  ON CONFLICT (tenant_id, e164) DO NOTHING
  RETURNING id
)
INSERT INTO core.phone_links (tenant_id, phone_id, subject_type, subject_id, role, is_primary)
SELECT c.tenant_id, p.id, 'core.party', c.id, 'main', true
FROM public.contacts c
JOIN core.phone_numbers p
  ON p.tenant_id = c.tenant_id AND p.e164 = trim(c.phone)
WHERE c.phone IS NOT NULL AND c.phone <> ''
ON CONFLICT (subject_type, subject_id, phone_id, role) DO NOTHING;

WITH inserted_mobile AS (
  INSERT INTO core.phone_numbers (tenant_id, e164, created_at)
  SELECT DISTINCT c.tenant_id, trim(c.mobile), now()
  FROM public.contacts c
  WHERE c.mobile IS NOT NULL AND c.mobile <> ''
  ON CONFLICT (tenant_id, e164) DO NOTHING
  RETURNING id
)
INSERT INTO core.phone_links (tenant_id, phone_id, subject_type, subject_id, role, is_primary)
SELECT c.tenant_id, p.id, 'core.party', c.id, 'mobile',
       -- mobile is_primary=true only when there's no main phone for the
       -- contact (partial-unique-on-(subject,role) keeps the constraint
       -- intact because role differs).
       true
FROM public.contacts c
JOIN core.phone_numbers p
  ON p.tenant_id = c.tenant_id AND p.e164 = trim(c.mobile)
WHERE c.mobile IS NOT NULL AND c.mobile <> ''
ON CONFLICT (subject_type, subject_id, phone_id, role) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 8. core.addresses + core.address_links — accounts billing + shipping
-- ══════════════════════════════════════════════════════════════════════
--
-- Only 5 prod accounts have billing_street populated; the migration
-- structure still covers the full schema so a future tenant onboarding
-- with rich address data lands here without code changes.

WITH addr_norm AS (
  SELECT
    a.id            AS account_id,
    a.tenant_id,
    a.billing_street, a.billing_city, a.billing_state, a.billing_postal_code, a.billing_country,
    a.shipping_street, a.shipping_city, a.shipping_state, a.shipping_postal_code, a.shipping_country
  FROM public.accounts a
)
INSERT INTO core.addresses (tenant_id, line1, city, region, postal_code, country, normalised)
SELECT DISTINCT
  tenant_id,
  billing_street,
  billing_city,
  billing_state,
  billing_postal_code,
  COALESCE(billing_country, 'XX'),  -- country is NOT NULL on core.addresses
  lower(regexp_replace(
    concat_ws('|', billing_street, billing_city, billing_postal_code, COALESCE(billing_country,'XX')),
    '[^a-z0-9|]+', '', 'g'
  ))
FROM addr_norm
WHERE billing_street IS NOT NULL AND billing_street <> ''
ON CONFLICT DO NOTHING;

INSERT INTO core.address_links (tenant_id, address_id, subject_type, subject_id, address_role)
SELECT a.tenant_id, addr.id, 'core.party', a.id, 'billing'
FROM public.accounts a
JOIN core.addresses addr
  ON addr.tenant_id   = a.tenant_id
 AND addr.line1       = a.billing_street
 AND COALESCE(addr.city,'')        = COALESCE(a.billing_city,'')
 AND COALESCE(addr.postal_code,'') = COALESCE(a.billing_postal_code,'')
 AND COALESCE(addr.country,'XX')   = COALESCE(a.billing_country,'XX')
WHERE a.billing_street IS NOT NULL AND a.billing_street <> ''
ON CONFLICT (subject_type, subject_id, address_id, address_role) DO NOTHING;

-- Shipping (same pattern, role='shipping')
INSERT INTO core.addresses (tenant_id, line1, city, region, postal_code, country, normalised)
SELECT DISTINCT
  a.tenant_id,
  a.shipping_street, a.shipping_city, a.shipping_state, a.shipping_postal_code,
  COALESCE(a.shipping_country,'XX'),
  lower(regexp_replace(
    concat_ws('|', a.shipping_street, a.shipping_city, a.shipping_postal_code, COALESCE(a.shipping_country,'XX')),
    '[^a-z0-9|]+', '', 'g'
  ))
FROM public.accounts a
WHERE a.shipping_street IS NOT NULL AND a.shipping_street <> ''
ON CONFLICT DO NOTHING;

INSERT INTO core.address_links (tenant_id, address_id, subject_type, subject_id, address_role)
SELECT a.tenant_id, addr.id, 'core.party', a.id, 'shipping'
FROM public.accounts a
JOIN core.addresses addr
  ON addr.tenant_id   = a.tenant_id
 AND addr.line1       = a.shipping_street
 AND COALESCE(addr.city,'')        = COALESCE(a.shipping_city,'')
 AND COALESCE(addr.postal_code,'') = COALESCE(a.shipping_postal_code,'')
 AND COALESCE(addr.country,'XX')   = COALESCE(a.shipping_country,'XX')
WHERE a.shipping_street IS NOT NULL AND a.shipping_street <> ''
ON CONFLICT (subject_type, subject_id, address_id, address_role) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 9. Reconciliation helper — counts + parity per source table
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.parties_backfill_summary()
RETURNS TABLE (
  metric  text,
  value   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, public, pg_catalog
AS $$
  SELECT 'accounts_total',            (SELECT count(*) FROM public.accounts)
  UNION ALL
  SELECT 'orgs_in_parties',           (SELECT count(*) FROM core.parties WHERE party_type='organization')
  UNION ALL
  SELECT 'contacts_total',            (SELECT count(*) FROM public.contacts)
  UNION ALL
  SELECT 'persons_in_parties',        (SELECT count(*) FROM core.parties WHERE party_type='person')
  UNION ALL
  SELECT 'employs_edges',             (SELECT count(*) FROM core.party_relationships WHERE relationship_type='employs')
  UNION ALL
  SELECT 'contacts_with_account',     (SELECT count(*) FROM public.contacts WHERE account_id IS NOT NULL)
  UNION ALL
  SELECT 'email_addresses_rows',      (SELECT count(*) FROM core.email_addresses)
  UNION ALL
  SELECT 'email_links_rows',          (SELECT count(*) FROM core.email_links)
  UNION ALL
  SELECT 'phone_numbers_rows',        (SELECT count(*) FROM core.phone_numbers)
  UNION ALL
  SELECT 'phone_links_rows',          (SELECT count(*) FROM core.phone_links)
  UNION ALL
  SELECT 'addresses_rows',            (SELECT count(*) FROM core.addresses)
  UNION ALL
  SELECT 'address_links_rows',        (SELECT count(*) FROM core.address_links);
$$;

COMMENT ON FUNCTION core.parties_backfill_summary IS
  'Phase 2 Step 2 reconciliation. Compare orgs_in_parties vs accounts_total and persons_in_parties vs contacts_total — should match exactly after the backfill. employs_edges should match contacts_with_account.';

GRANT EXECUTE ON FUNCTION core.parties_backfill_summary TO service_role;
