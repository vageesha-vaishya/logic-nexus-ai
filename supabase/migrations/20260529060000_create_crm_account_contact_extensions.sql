-- Phase 4 Step 1 — crm.account_extensions + crm.contact_extensions
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- Lifts the CRM-only columns currently sitting on public.accounts /
-- public.contacts into dedicated extension tables keyed on the
-- core.parties.id. Identity (name, status, timestamps) stays in
-- core.parties; relationship + contact channels (emails, phones,
-- addresses) stay in core.parties + the core.* link tables; only
-- CRM-domain fields land here.
--
-- After this migration:
--   - crm.account_extensions rows track every public.accounts row 1:1
--     (party_id = source.id; FK to core.parties).
--   - crm.contact_extensions same for public.contacts.
--   - public.accounts / public.contacts stay authoritative for writes
--     until the parked Step 9 DROP unparks. The Phase 4 dual-write
--     triggers below keep the extensions tables in sync as long as the
--     source tables exist.
--   - public.v_accounts / public.v_contacts will rebuild against the
--     extensions in a follow-up migration; this migration deliberately
--     leaves the views unchanged so the cutover is reversible without
--     re-fetching extension data.
--
-- Strictly additive. Existing reads via v_* keep working unchanged; new
-- reads can target crm.* directly.

-- ══════════════════════════════════════════════════════════════════════
-- 1. crm.account_extensions
-- ══════════════════════════════════════════════════════════════════════
--
-- Column set mirrors every public.accounts column NOT already covered
-- by core.parties / core.email_addresses / core.phone_numbers /
-- core.addresses. Phone/email scalars (account.phone, account.email)
-- are kept as denormalised columns here too — they're already in
-- core.{email,phone}_* via the Step 2 backfill, but business code
-- references account.email directly and the cost of the duplicate
-- column is tiny (<2KB per row × 9k rows).

CREATE TABLE crm.account_extensions (
  party_id              uuid PRIMARY KEY REFERENCES core.parties(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL,
  franchise_id          uuid,
  account_type          text,
  industry              text,
  description           text,
  annual_revenue        numeric,
  employee_count        integer,
  number_of_locations   integer,
  active                boolean,
  account_number        text,
  account_site          text,
  -- parent_account_id keeps pointing at public.accounts(id) for now; the
  -- parked Step 9 DROP migration will rewire this FK to core.parties(id).
  parent_account_id     uuid,
  owner_id              uuid,
  created_by            uuid,
  rating                text,
  ownership             text,
  customer_priority     text,
  support_tier          text,
  upsell_opportunity    text,
  sla                   text,
  sla_expiration_date   date,
  ticker_symbol         text,
  sic_code              text,
  duns_number           text,
  naics_code            text,
  fax                   text,
  website               text,
  phone                 text,
  email                 text,
  billing_address       jsonb,
  shipping_address      jsonb,
  billing_street        text,
  billing_city          text,
  billing_state         text,
  billing_postal_code   text,
  billing_country       text,
  shipping_street       text,
  shipping_city         text,
  shipping_state        text,
  shipping_postal_code  text,
  shipping_country      text,
  custom_fields         jsonb NOT NULL DEFAULT '{}'::jsonb,
  social_profiles       jsonb,
  legacy_json           jsonb,
  last_activity_at      timestamptz,
  tax_id                text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crm.account_extensions IS
  'Phase 4 Step 1 — CRM-domain fields lifted from public.accounts; keyed 1:1 on core.parties.id. Per master design §3.2 + crm.md.';

CREATE INDEX account_extensions_tenant_idx ON crm.account_extensions (tenant_id);
CREATE INDEX account_extensions_owner_idx  ON crm.account_extensions (owner_id) WHERE owner_id IS NOT NULL;

ALTER TABLE crm.account_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_extensions_tenant_select ON crm.account_extensions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- Reuse core.touch_updated_at
CREATE TRIGGER trg_crm_account_extensions_updated_at
  BEFORE UPDATE ON crm.account_extensions
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON crm.account_extensions TO authenticated;
GRANT ALL    ON crm.account_extensions TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. crm.contact_extensions
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE crm.contact_extensions (
  party_id          uuid PRIMARY KEY REFERENCES core.parties(id) ON DELETE CASCADE,
  tenant_id         uuid NOT NULL,
  franchise_id      uuid,
  -- account_id: the employs-org pointer. Mirrored in core.party_relationships
  -- (type='employs'); kept here for sub-200µs joins in CRM dashboards.
  account_id        uuid,
  title             text,
  email             text,
  phone             text,
  mobile            text,
  linkedin_url      text,
  -- address: source column is jsonb on public.contacts.
  address           jsonb,
  is_primary        boolean,
  notes             text,
  owner_id          uuid,
  created_by        uuid,
  department        text,
  title_level       text,
  reports_to        uuid,
  lifecycle_stage   text,
  lead_source       text,
  custom_fields     jsonb NOT NULL DEFAULT '{}'::jsonb,
  social_profiles   jsonb,
  legacy_json       jsonb,
  last_activity_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE crm.contact_extensions IS
  'Phase 4 Step 1 — CRM-domain fields lifted from public.contacts; keyed 1:1 on core.parties.id.';

CREATE INDEX contact_extensions_tenant_idx     ON crm.contact_extensions (tenant_id);
CREATE INDEX contact_extensions_account_id_idx ON crm.contact_extensions (account_id) WHERE account_id IS NOT NULL;
CREATE INDEX contact_extensions_owner_idx      ON crm.contact_extensions (owner_id)   WHERE owner_id   IS NOT NULL;

ALTER TABLE crm.contact_extensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_extensions_tenant_select ON crm.contact_extensions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_crm_contact_extensions_updated_at
  BEFORE UPDATE ON crm.contact_extensions
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON crm.contact_extensions TO authenticated;
GRANT ALL    ON crm.contact_extensions TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Backfill from public.accounts → crm.account_extensions
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO crm.account_extensions (
  party_id, tenant_id, franchise_id, account_type, industry, description,
  annual_revenue, employee_count, number_of_locations, active,
  account_number, account_site, parent_account_id, owner_id, created_by,
  rating, ownership, customer_priority, support_tier, upsell_opportunity,
  sla, sla_expiration_date, ticker_symbol, sic_code, duns_number, naics_code,
  fax, website, phone, email,
  billing_address, shipping_address,
  billing_street, billing_city, billing_state, billing_postal_code, billing_country,
  shipping_street, shipping_city, shipping_state, shipping_postal_code, shipping_country,
  custom_fields, social_profiles, legacy_json, last_activity_at, tax_id,
  created_at, updated_at
)
SELECT
  a.id, a.tenant_id, a.franchise_id, a.account_type::text, a.industry, a.description,
  a.annual_revenue, a.employee_count, a.number_of_locations, a.active,
  a.account_number, a.account_site, a.parent_account_id, a.owner_id, a.created_by,
  a.rating, a.ownership, a.customer_priority, a.support_tier, a.upsell_opportunity,
  a.sla, a.sla_expiration_date, a.ticker_symbol, a.sic_code, a.duns_number, a.naics_code,
  a.fax, a.website, a.phone, a.email,
  a.billing_address, a.shipping_address,
  a.billing_street, a.billing_city, a.billing_state, a.billing_postal_code, a.billing_country,
  a.shipping_street, a.shipping_city, a.shipping_state, a.shipping_postal_code, a.shipping_country,
  COALESCE(a.custom_fields, '{}'::jsonb), a.social_profiles, a.legacy_json, a.last_activity_at, a.tax_id,
  COALESCE(a.created_at, now()), COALESCE(a.updated_at, now())
FROM public.accounts a
ON CONFLICT (party_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Backfill from public.contacts → crm.contact_extensions
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO crm.contact_extensions (
  party_id, tenant_id, franchise_id, account_id, title, email, phone, mobile,
  linkedin_url, address, is_primary, notes, owner_id, created_by,
  department, title_level, reports_to, lifecycle_stage, lead_source,
  custom_fields, social_profiles, legacy_json, last_activity_at,
  created_at, updated_at
)
SELECT
  c.id, c.tenant_id, c.franchise_id, c.account_id, c.title, c.email, c.phone, c.mobile,
  c.linkedin_url, c.address, c.is_primary, c.notes, c.owner_id, c.created_by,
  c.department, c.title_level, c.reports_to, c.lifecycle_stage, c.lead_source,
  COALESCE(c.custom_fields, '{}'::jsonb), c.social_profiles, c.legacy_json, c.last_activity_at,
  COALESCE(c.created_at, now()), COALESCE(c.updated_at, now())
FROM public.contacts c
ON CONFLICT (party_id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Dual-write triggers: public.accounts → crm.account_extensions
-- ══════════════════════════════════════════════════════════════════════
--
-- Same fail-open pattern as the Phase 2 Step 6 dual-write on core.parties.
-- These triggers stack: a single INSERT on public.accounts now fires
-- (1) the Phase 2 trigger writing to core.parties, then
-- (2) the Phase 4 trigger writing to crm.account_extensions.

CREATE OR REPLACE FUNCTION crm.dual_write_to_account_extensions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = crm, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm.account_extensions (
      party_id, tenant_id, franchise_id, account_type, industry, description,
      annual_revenue, employee_count, number_of_locations, active,
      account_number, account_site, parent_account_id, owner_id, created_by,
      rating, ownership, customer_priority, support_tier, upsell_opportunity,
      sla, sla_expiration_date, ticker_symbol, sic_code, duns_number, naics_code,
      fax, website, phone, email,
      billing_address, shipping_address,
      billing_street, billing_city, billing_state, billing_postal_code, billing_country,
      shipping_street, shipping_city, shipping_state, shipping_postal_code, shipping_country,
      custom_fields, social_profiles, legacy_json, last_activity_at, tax_id,
      created_at, updated_at
    ) VALUES (
      NEW.id, NEW.tenant_id, NEW.franchise_id, NEW.account_type::text, NEW.industry, NEW.description,
      NEW.annual_revenue, NEW.employee_count, NEW.number_of_locations, NEW.active,
      NEW.account_number, NEW.account_site, NEW.parent_account_id, NEW.owner_id, NEW.created_by,
      NEW.rating, NEW.ownership, NEW.customer_priority, NEW.support_tier, NEW.upsell_opportunity,
      NEW.sla, NEW.sla_expiration_date, NEW.ticker_symbol, NEW.sic_code, NEW.duns_number, NEW.naics_code,
      NEW.fax, NEW.website, NEW.phone, NEW.email,
      NEW.billing_address, NEW.shipping_address,
      NEW.billing_street, NEW.billing_city, NEW.billing_state, NEW.billing_postal_code, NEW.billing_country,
      NEW.shipping_street, NEW.shipping_city, NEW.shipping_state, NEW.shipping_postal_code, NEW.shipping_country,
      COALESCE(NEW.custom_fields, '{}'::jsonb), NEW.social_profiles, NEW.legacy_json, NEW.last_activity_at, NEW.tax_id,
      COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (party_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      industry  = EXCLUDED.industry,
      description = EXCLUDED.description,
      annual_revenue = EXCLUDED.annual_revenue,
      employee_count = EXCLUDED.employee_count,
      number_of_locations = EXCLUDED.number_of_locations,
      active = EXCLUDED.active,
      website = EXCLUDED.website,
      phone   = EXCLUDED.phone,
      email   = EXCLUDED.email,
      custom_fields = EXCLUDED.custom_fields,
      updated_at = EXCLUDED.updated_at;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE crm.account_extensions SET
      tenant_id            = NEW.tenant_id,
      franchise_id         = NEW.franchise_id,
      account_type         = NEW.account_type::text,
      industry             = NEW.industry,
      description          = NEW.description,
      annual_revenue       = NEW.annual_revenue,
      employee_count       = NEW.employee_count,
      number_of_locations  = NEW.number_of_locations,
      active               = NEW.active,
      account_number       = NEW.account_number,
      account_site         = NEW.account_site,
      parent_account_id    = NEW.parent_account_id,
      owner_id             = NEW.owner_id,
      rating               = NEW.rating,
      ownership            = NEW.ownership,
      customer_priority    = NEW.customer_priority,
      support_tier         = NEW.support_tier,
      upsell_opportunity   = NEW.upsell_opportunity,
      sla                  = NEW.sla,
      sla_expiration_date  = NEW.sla_expiration_date,
      ticker_symbol        = NEW.ticker_symbol,
      sic_code             = NEW.sic_code,
      duns_number          = NEW.duns_number,
      naics_code           = NEW.naics_code,
      fax                  = NEW.fax,
      website              = NEW.website,
      phone                = NEW.phone,
      email                = NEW.email,
      billing_address      = NEW.billing_address,
      shipping_address     = NEW.shipping_address,
      billing_street       = NEW.billing_street,
      billing_city         = NEW.billing_city,
      billing_state        = NEW.billing_state,
      billing_postal_code  = NEW.billing_postal_code,
      billing_country      = NEW.billing_country,
      shipping_street      = NEW.shipping_street,
      shipping_city        = NEW.shipping_city,
      shipping_state       = NEW.shipping_state,
      shipping_postal_code = NEW.shipping_postal_code,
      shipping_country     = NEW.shipping_country,
      custom_fields        = COALESCE(NEW.custom_fields, '{}'::jsonb),
      social_profiles      = NEW.social_profiles,
      legacy_json          = NEW.legacy_json,
      last_activity_at     = NEW.last_activity_at,
      tax_id               = NEW.tax_id,
      updated_at           = COALESCE(NEW.updated_at, now())
    WHERE party_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM crm.account_extensions WHERE party_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_to_account_extensions (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_accounts_dual_write_to_extensions
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION crm.dual_write_to_account_extensions();

-- ══════════════════════════════════════════════════════════════════════
-- 6. Dual-write triggers: public.contacts → crm.contact_extensions
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION crm.dual_write_to_contact_extensions()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = crm, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO crm.contact_extensions (
      party_id, tenant_id, franchise_id, account_id, title, email, phone, mobile,
      linkedin_url, address, is_primary, notes, owner_id, created_by,
      department, title_level, reports_to, lifecycle_stage, lead_source,
      custom_fields, social_profiles, legacy_json, last_activity_at,
      created_at, updated_at
    ) VALUES (
      NEW.id, NEW.tenant_id, NEW.franchise_id, NEW.account_id, NEW.title, NEW.email, NEW.phone, NEW.mobile,
      NEW.linkedin_url, NEW.address, NEW.is_primary, NEW.notes, NEW.owner_id, NEW.created_by,
      NEW.department, NEW.title_level, NEW.reports_to, NEW.lifecycle_stage, NEW.lead_source,
      COALESCE(NEW.custom_fields, '{}'::jsonb), NEW.social_profiles, NEW.legacy_json, NEW.last_activity_at,
      COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
    )
    ON CONFLICT (party_id) DO UPDATE SET
      tenant_id     = EXCLUDED.tenant_id,
      account_id    = EXCLUDED.account_id,
      title         = EXCLUDED.title,
      email         = EXCLUDED.email,
      phone         = EXCLUDED.phone,
      mobile        = EXCLUDED.mobile,
      custom_fields = EXCLUDED.custom_fields,
      updated_at    = EXCLUDED.updated_at;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE crm.contact_extensions SET
      tenant_id        = NEW.tenant_id,
      franchise_id     = NEW.franchise_id,
      account_id       = NEW.account_id,
      title            = NEW.title,
      email            = NEW.email,
      phone            = NEW.phone,
      mobile           = NEW.mobile,
      linkedin_url     = NEW.linkedin_url,
      address          = NEW.address,
      is_primary       = NEW.is_primary,
      notes            = NEW.notes,
      owner_id         = NEW.owner_id,
      department       = NEW.department,
      title_level      = NEW.title_level,
      reports_to       = NEW.reports_to,
      lifecycle_stage  = NEW.lifecycle_stage,
      lead_source      = NEW.lead_source,
      custom_fields    = COALESCE(NEW.custom_fields, '{}'::jsonb),
      social_profiles  = NEW.social_profiles,
      legacy_json      = NEW.legacy_json,
      last_activity_at = NEW.last_activity_at,
      updated_at       = COALESCE(NEW.updated_at, now())
    WHERE party_id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM crm.contact_extensions WHERE party_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_to_contact_extensions (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_contacts_dual_write_to_extensions
  AFTER INSERT OR UPDATE OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION crm.dual_write_to_contact_extensions();

-- ══════════════════════════════════════════════════════════════════════
-- 7. Reconciliation helper
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION crm.extensions_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = crm, public, pg_catalog
AS $$
  SELECT 'accounts_minus_account_extensions',
         (SELECT count(*) FROM public.accounts)
       - (SELECT count(*) FROM crm.account_extensions)
  UNION ALL
  SELECT 'contacts_minus_contact_extensions',
         (SELECT count(*) FROM public.contacts)
       - (SELECT count(*) FROM crm.contact_extensions);
$$;

COMMENT ON FUNCTION crm.extensions_drift_check IS
  'Phase 4 Step 1 drift monitor. Both deltas should remain 0 — non-zero means a trigger failure or a backfill gap.';

GRANT EXECUTE ON FUNCTION crm.extensions_drift_check TO service_role;
