-- Phase 2 Step 1 — create core.parties + relationships + shared primitives
-- Per docs/plans/2026-05-28-modules/core.md §3.2 + §3.3
--
-- Strictly additive — zero impact on existing data. Public-side
-- public.accounts (9k rows) and public.contacts (9k rows) stay
-- authoritative until the backfill + dual-write + view-cutover slices
-- ship in later sessions per docs/plans/2026-05-28-platform-modules-redesign.md
-- §7.4 Phase 2 plan.
--
-- Tables created (11):
--   core.parties              — unified person + organization registry
--   core.party_relationships  — directed edges between parties (employs,
--                                subsidiary_of, parent_of, household_of, ...)
--   core.addresses            — deduplicated address rows (per tenant)
--   core.address_links        — polymorphic (subject_type, subject_id) → address
--   core.phone_numbers        — deduplicated E.164 phone rows
--   core.phone_links          — polymorphic phone attachments
--   core.email_addresses      — deduplicated email rows
--   core.email_links          — polymorphic email attachments
--   core.tax_ids              — per-party jurisdictional tax identifiers
--   core.tags                 — namespaced tag catalogue per tenant
--   core.tag_assignments      — polymorphic tag attachments
--
-- Convention: polymorphic links use the §2.4 schema.entity subject_type
-- pattern ('core.party', 'logistics.shipment', 'amro.work_order', etc.)
-- so the same primitive table serves every module without per-module
-- foreign keys.
--
-- RLS: tenant-isolated SELECT for authenticated; service_role full
-- access. Writes flow through the per-module APIs in later phases. The
-- richer party-visibility model (party_visibility_for_user) per core.md
-- §4 is deferred to Phase 2 Step 5.

-- ══════════════════════════════════════════════════════════════════════
-- core.parties
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.parties (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  party_type      text NOT NULL
                  CHECK (party_type IN ('person','organization')),
  -- The canonical render-friendly name. For organizations: the trading name.
  -- For persons: usually first + last, but caller may override (titles, etc.).
  display_name    text NOT NULL,
  -- Organization-only — the registered legal entity name. NULL for persons.
  legal_name      text,
  -- Person-only — split from display_name for sort/filter use. NULL for orgs.
  first_name      text,
  last_name       text,
  -- Lifecycle. 'active' is the steady state; 'archived' soft-deletes
  -- without losing FK targets; 'merged' marks a duplicate that has been
  -- collapsed into another row via the dedup-assistant flow.
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','archived','merged')),
  -- Cross-system identifier bag for external integrations.
  -- Shape: {"salesforce_id":"...","sap_id":"...","oracle_id":"..."}
  external_refs   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.parties IS
  'Unified person+organization registry. Replaces the future-dropped public.accounts (organizations) and public.contacts (persons). Per master design §3.2 + core.md §3.2.';
COMMENT ON COLUMN core.parties.party_type IS
  'person | organization. CRM "account" = organization-typed party; CRM "contact" = person-typed party.';
COMMENT ON COLUMN core.parties.external_refs IS
  'jsonb {provider_key: external_id, ...}. Keys are stable (salesforce_id, sap_id, etc.). Lookups go through the parties_external_refs_gin index.';

CREATE INDEX parties_tenant_type_idx
  ON core.parties (tenant_id, party_type)
  WHERE status = 'active';

CREATE INDEX parties_tenant_status_idx
  ON core.parties (tenant_id, status);

CREATE INDEX parties_tenant_display_name_idx
  ON core.parties (tenant_id, display_name);

-- Cross-system ID lookup. e.g. find party by salesforce_id without scanning.
CREATE INDEX parties_external_refs_gin
  ON core.parties USING gin (external_refs jsonb_path_ops);

ALTER TABLE core.parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY parties_tenant_select ON core.parties
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_core_parties_updated_at
  BEFORE UPDATE ON core.parties
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON core.parties TO authenticated;
GRANT ALL    ON core.parties TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- core.party_relationships
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.party_relationships (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  from_party_id      uuid NOT NULL REFERENCES core.parties(id) ON DELETE CASCADE,
  to_party_id        uuid NOT NULL REFERENCES core.parties(id) ON DELETE CASCADE,
  relationship_type  text NOT NULL
                     CHECK (relationship_type IN (
                       'employs',         -- org → person
                       'employed_by',     -- person → org (reciprocal of employs)
                       'subsidiary_of',   -- org → org
                       'parent_of',       -- org → org (reciprocal of subsidiary_of)
                       'household_of',    -- person ↔ person
                       'spouse_of',       -- person ↔ person
                       'authorized_signer', -- person → org
                       'beneficial_owner'   -- person → org
                     )),
  -- Optional period for time-bounded relationships (a person's tenure
  -- at a company, a subsidiary acquired/divested).
  effective_from     date,
  effective_to       date,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- An edge of the same type between the same two parties is forbidden;
  -- repeated employment periods etc. should use effective_from/_to ranges
  -- on a single row, OR multiple rows of distinct types.
  CONSTRAINT party_relationships_no_self CHECK (from_party_id <> to_party_id),
  CONSTRAINT party_relationships_uniq UNIQUE (from_party_id, to_party_id, relationship_type)
);

COMMENT ON TABLE core.party_relationships IS
  'Directed edges between parties. Replaces ad-hoc account_contacts join + per-module relationship tables. Per core.md §3.2.';

CREATE INDEX party_relationships_from_idx
  ON core.party_relationships (tenant_id, from_party_id, relationship_type);
CREATE INDEX party_relationships_to_idx
  ON core.party_relationships (tenant_id, to_party_id, relationship_type);

ALTER TABLE core.party_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY party_relationships_tenant_select ON core.party_relationships
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_core_party_relationships_updated_at
  BEFORE UPDATE ON core.party_relationships
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON core.party_relationships TO authenticated;
GRANT ALL    ON core.party_relationships TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- core.addresses + core.address_links
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  line1         text NOT NULL,
  line2         text,
  city          text,
  region        text,                 -- state / province / county
  postal_code   text,
  country       text NOT NULL,        -- ISO 3166-1 alpha-2 by convention ('IN','US',...)
  lat           numeric(9,6),
  lng           numeric(9,6),
  -- Deduplication key. Lowercased + punctuation-stripped concatenation of
  -- line1+city+postal_code+country, populated by the inserter. Two writes
  -- with the same normalised value resolve to the same address row.
  normalised    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.addresses IS
  'Per-tenant deduplicated address registry. Polymorphic attachments to entities go through core.address_links. Per core.md §3.3.';

CREATE INDEX addresses_tenant_country_postal_idx
  ON core.addresses (tenant_id, country, postal_code);
CREATE INDEX addresses_normalised_idx
  ON core.addresses (tenant_id, normalised)
  WHERE normalised IS NOT NULL;

ALTER TABLE core.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY addresses_tenant_select ON core.addresses
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_core_addresses_updated_at
  BEFORE UPDATE ON core.addresses
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON core.addresses TO authenticated;
GRANT ALL    ON core.addresses TO service_role;

CREATE TABLE core.address_links (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL,
  address_id     uuid NOT NULL REFERENCES core.addresses(id) ON DELETE CASCADE,
  -- §2.4 schema.entity: 'core.party','logistics.shipment','finance.invoice',...
  subject_type   text NOT NULL,
  subject_id     uuid NOT NULL,
  -- 'billing','shipping','registered','site','mailing','primary',...
  address_role   text NOT NULL DEFAULT 'primary',
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- A subject may attach the same address in multiple roles; same role
  -- shouldn't duplicate.
  UNIQUE (subject_type, subject_id, address_id, address_role)
);

COMMENT ON TABLE core.address_links IS
  'Polymorphic attachment between core.addresses and any module entity. subject_type follows the §2.4 schema.entity convention.';

CREATE INDEX address_links_subject_idx
  ON core.address_links (tenant_id, subject_type, subject_id);
CREATE INDEX address_links_address_idx
  ON core.address_links (address_id);

ALTER TABLE core.address_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY address_links_tenant_select ON core.address_links
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON core.address_links TO authenticated;
GRANT ALL    ON core.address_links TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- core.phone_numbers + core.phone_links
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.phone_numbers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  -- E.164 international format ('+919876543210', '+14155551234'). The
  -- inserter normalises before write; downstream lookups use this column
  -- verbatim with no further normalisation.
  e164         text NOT NULL,
  country      text,                              -- ISO 3166-1 alpha-2 (best-effort)
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- One row per (tenant, e164). Different tenants may share the same
  -- phone (a contractor working for two clients) but each gets its own
  -- row keyed on tenant.
  UNIQUE (tenant_id, e164)
);

COMMENT ON TABLE core.phone_numbers IS
  'Per-tenant deduplicated phone registry, E.164. Polymorphic attachments via core.phone_links. Per core.md §3.3.';

CREATE INDEX phone_numbers_tenant_country_idx
  ON core.phone_numbers (tenant_id, country)
  WHERE country IS NOT NULL;

ALTER TABLE core.phone_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY phone_numbers_tenant_select ON core.phone_numbers
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_core_phone_numbers_updated_at
  BEFORE UPDATE ON core.phone_numbers
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON core.phone_numbers TO authenticated;
GRANT ALL    ON core.phone_numbers TO service_role;

CREATE TABLE core.phone_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  phone_id      uuid NOT NULL REFERENCES core.phone_numbers(id) ON DELETE CASCADE,
  subject_type  text NOT NULL,
  subject_id    uuid NOT NULL,
  -- 'work','mobile','home','main','emergency','fax',...
  role          text NOT NULL DEFAULT 'main',
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_id, phone_id, role)
);

COMMENT ON TABLE core.phone_links IS
  'Polymorphic attachment between core.phone_numbers and any module entity.';

CREATE INDEX phone_links_subject_idx
  ON core.phone_links (tenant_id, subject_type, subject_id);
CREATE INDEX phone_links_phone_idx
  ON core.phone_links (phone_id);
-- At most one primary phone per (subject, role). Soft-enforced via
-- partial unique to allow callers to flip-flop without an explicit
-- DELETE-before-INSERT dance.
CREATE UNIQUE INDEX phone_links_primary_per_subject_role
  ON core.phone_links (subject_type, subject_id, role)
  WHERE is_primary = true;

ALTER TABLE core.phone_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY phone_links_tenant_select ON core.phone_links
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON core.phone_links TO authenticated;
GRANT ALL    ON core.phone_links TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- core.email_addresses + core.email_links
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.email_addresses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  -- Stored lowercased + trimmed by the inserter. Lookups must apply the
  -- same normalisation; the unique index enforces it at row level.
  email        text NOT NULL,
  verified_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

COMMENT ON TABLE core.email_addresses IS
  'Per-tenant deduplicated email registry (normalised lowercase). Polymorphic attachments via core.email_links. Per core.md §3.3.';

ALTER TABLE core.email_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_addresses_tenant_select ON core.email_addresses
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_core_email_addresses_updated_at
  BEFORE UPDATE ON core.email_addresses
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON core.email_addresses TO authenticated;
GRANT ALL    ON core.email_addresses TO service_role;

CREATE TABLE core.email_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  email_id      uuid NOT NULL REFERENCES core.email_addresses(id) ON DELETE CASCADE,
  subject_type  text NOT NULL,
  subject_id    uuid NOT NULL,
  -- 'work','personal','billing','support','primary',...
  role          text NOT NULL DEFAULT 'primary',
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_id, email_id, role)
);

COMMENT ON TABLE core.email_links IS
  'Polymorphic attachment between core.email_addresses and any module entity.';

CREATE INDEX email_links_subject_idx
  ON core.email_links (tenant_id, subject_type, subject_id);
CREATE INDEX email_links_email_idx
  ON core.email_links (email_id);
CREATE UNIQUE INDEX email_links_primary_per_subject_role
  ON core.email_links (subject_type, subject_id, role)
  WHERE is_primary = true;

ALTER TABLE core.email_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_links_tenant_select ON core.email_links
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON core.email_links TO authenticated;
GRANT ALL    ON core.email_links TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- core.tax_ids
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.tax_ids (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  party_id        uuid NOT NULL REFERENCES core.parties(id) ON DELETE CASCADE,
  -- ISO 3166-1 alpha-2 ('IN','US','GB','AE') OR a supra-national namespace
  -- ('EU' for EU-VAT) when the tax authority spans countries.
  jurisdiction    text NOT NULL,
  -- 'gstin' (India GST), 'pan' (India), 'ein' (US), 'ssn' (US, restricted),
  -- 'vat' (EU/UK VAT), 'tin' (generic), 'trn' (UAE), ...
  kind            text NOT NULL,
  value           text NOT NULL,
  validated_at    timestamptz,
  -- e.g. India GSTIN check-API response, EU VIES response.
  validation      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- One value per (tenant, party, jurisdiction, kind). A party with two
  -- GSTINs in different states would use different jurisdiction values
  -- (e.g. 'IN-KA','IN-MH') OR carry them as multiple rows with kind
  -- 'gstin' once we model state-level. Phase 2 keeps it simple.
  UNIQUE (tenant_id, party_id, jurisdiction, kind)
);

COMMENT ON TABLE core.tax_ids IS
  'Per-party jurisdictional tax identifiers (GSTIN, PAN, EIN, VAT, TIN, TRN, ...). Validation status + provider response are stored alongside. Per core.md §3.3.';

CREATE INDEX tax_ids_party_idx
  ON core.tax_ids (party_id);
CREATE INDEX tax_ids_tenant_value_idx
  ON core.tax_ids (tenant_id, value);

ALTER TABLE core.tax_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_ids_tenant_select ON core.tax_ids
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_core_tax_ids_updated_at
  BEFORE UPDATE ON core.tax_ids
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON core.tax_ids TO authenticated;
GRANT ALL    ON core.tax_ids TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- core.tags + core.tag_assignments
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE core.tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  -- Namespace separates module-defined system tags from user-defined ones.
  -- Convention: 'crm','sales','logistics','user',... — same '<module>'
  -- string used in module_code elsewhere.
  namespace   text NOT NULL,
  -- Stable machine-friendly key; the unique-per-tenant identifier.
  slug        text NOT NULL,
  -- Display string (may be localised later; for Phase 2 plain text).
  label       text NOT NULL,
  -- Optional hex colour like '#5b8def' for chip rendering.
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, namespace, slug)
);

COMMENT ON TABLE core.tags IS
  'Tag catalogue, namespaced per tenant. Tag values attach to any entity via core.tag_assignments. Per core.md §3.3.';

CREATE INDEX tags_tenant_namespace_idx
  ON core.tags (tenant_id, namespace);

ALTER TABLE core.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_tenant_select ON core.tags
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_core_tags_updated_at
  BEFORE UPDATE ON core.tags
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON core.tags TO authenticated;
GRANT ALL    ON core.tags TO service_role;

CREATE TABLE core.tag_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  tag_id        uuid NOT NULL REFERENCES core.tags(id) ON DELETE CASCADE,
  subject_type  text NOT NULL,
  subject_id    uuid NOT NULL,
  assigned_by   uuid,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag_id, subject_type, subject_id)
);

COMMENT ON TABLE core.tag_assignments IS
  'Polymorphic attachment of core.tags to any module entity. Reverse lookup (all tags on subject) uses the (subject_type, subject_id) index.';

CREATE INDEX tag_assignments_subject_idx
  ON core.tag_assignments (tenant_id, subject_type, subject_id);

ALTER TABLE core.tag_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tag_assignments_tenant_select ON core.tag_assignments
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON core.tag_assignments TO authenticated;
GRANT ALL    ON core.tag_assignments TO service_role;
