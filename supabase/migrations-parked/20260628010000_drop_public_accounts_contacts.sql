-- ⚠ PARKED — DO NOT APPLY YET
-- Lives in supabase/migrations-parked/ so the supabase CLI never picks it
-- up automatically. See supabase/migrations-parked/README.md for the
-- unpark lifecycle.
--
-- Phase 2 Step 9 — drop public.accounts and public.contacts after Steps 1–7
-- have shipped (2026-05-29) and the Step 8 no-direct-read window expires.
-- The 27 FK constraints listed below rewire to core.parties(id) first;
-- once those land cleanly the legacy tables drop without cascading.
--
-- Note on column names: rewiring keeps column names like account_id /
-- contact_id intact. Downstream queries that JOIN `accounts a ON
-- a.id = t.account_id` still resolve (the FK target column is still id,
-- just on core.parties now). Renaming column names to party_id is a
-- separate cleanup deliberately not bundled here.
--
-- ── Unpark checklist ────────────────────────────────────────────────────
--
-- 1. ✓  Step 8 30-day no-direct-read window has elapsed. Earliest apply
--       date is roughly 2026-06-28 (30 days after Step 7 lint ban
--       commit 0b751d83). No `from('accounts')`/`from('contacts')`
--       outside tests in production logs for the full window.
--
-- 2. ✓  Phase 4 has shipped crm.account_extensions / crm.contact_extensions
--       with the CRM-only column data migrated. The columns currently
--       sourced via the v_accounts / v_contacts LEFT JOIN of public.*
--       (industry, website, billing_*, custom_fields, ...) must have a
--       new home before public.accounts/contacts go away — otherwise
--       the views return NULL for half their columns and every
--       downstream consumer regresses.
--
-- 3. ✓  v_accounts / v_contacts rebuilt (and ideally moved to crm.v_*).
--       The rebuild swaps the LEFT JOIN public.accounts/contacts for
--       JOIN crm.account_extensions/contact_extensions. Validate
--       shape parity against the pre-rebuild v_* output before
--       continuing.
--
-- 4. ✓  Dual-write triggers (commit e0f077ba) become single-write:
--       once the source-of-truth flips fully to core.parties, the
--       triggers should be removed and the core.parties writes
--       become direct (no longer mirrored from public.*).
--
-- 5. ✓  account_relationships data, if any has accumulated, mirrored
--       into core.party_relationships. The legacy table is dropped via
--       CASCADE on its FK rewire — make sure nothing reads from it.
--
-- 6. ✓  parties_drift_check() returns {0,0,0} immediately before
--       running this migration. Drift after this point means the
--       Step 6 triggers are still firing and racing the DROP — pause
--       and investigate.
--
-- Once 1–6 are checked, `git mv` this file into supabase/migrations/,
-- bumping the timestamp prefix only if needed to maintain ordering
-- relative to anything that landed since. Apply on local first; verify
-- drift_check still passes (it will because the helper drops with the
-- tables); apply to prod via MCP.

-- ══════════════════════════════════════════════════════════════════════
-- Phase 1: rewire 27 FK constraints from public.accounts/contacts → core.parties
-- ══════════════════════════════════════════════════════════════════════
--
-- Pattern per constraint: ALTER TABLE x DROP CONSTRAINT y;
--                         ALTER TABLE x ADD CONSTRAINT y FOREIGN KEY (col)
--                           REFERENCES core.parties(id) <action>;
--
-- ON DELETE / ON UPDATE behaviour is preserved verbatim from the source
-- constraint definition snapshot taken 2026-05-29.

-- public.accounts → public.accounts (self-FK)
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS fk_parent_account;
ALTER TABLE public.accounts ADD CONSTRAINT fk_parent_account
  FOREIGN KEY (parent_account_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.activities
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_account_id_fkey;
ALTER TABLE public.activities ADD CONSTRAINT activities_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE CASCADE;
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_contact_id_fkey;
ALTER TABLE public.activities ADD CONSTRAINT activities_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES core.parties(id) ON DELETE CASCADE;

-- public.carrier_rates
ALTER TABLE public.carrier_rates DROP CONSTRAINT IF EXISTS carrier_rates_customer_id_fkey;
ALTER TABLE public.carrier_rates ADD CONSTRAINT carrier_rates_customer_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE SET NULL;
ALTER TABLE public.carrier_rates DROP CONSTRAINT IF EXISTS carrier_rates_customer_id_fkey1;
ALTER TABLE public.carrier_rates ADD CONSTRAINT carrier_rates_customer_id_fkey1
  FOREIGN KEY (customer_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.contacts
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_account_id_fkey;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE RESTRICT;
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_reports_to_fkey;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_reports_to_fkey
  FOREIGN KEY (reports_to) REFERENCES core.parties(id);

-- public.emails
ALTER TABLE public.emails DROP CONSTRAINT IF EXISTS emails_account_id_crm_fkey;
ALTER TABLE public.emails ADD CONSTRAINT emails_account_id_crm_fkey
  FOREIGN KEY (account_id_crm) REFERENCES core.parties(id) ON DELETE SET NULL;
ALTER TABLE public.emails DROP CONSTRAINT IF EXISTS emails_contact_id_fkey;
ALTER TABLE public.emails ADD CONSTRAINT emails_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.leads
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_converted_account_id_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_converted_account_id_fkey
  FOREIGN KEY (converted_account_id) REFERENCES core.parties(id);
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_converted_contact_id_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_converted_contact_id_fkey
  FOREIGN KEY (converted_contact_id) REFERENCES core.parties(id);

-- public.opportunities
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_account_id_fkey;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE SET NULL;
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_contact_id_fkey;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.quotes
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_account_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE SET NULL;
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_contact_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.shipments
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_account_id_fkey;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE SET NULL;
ALTER TABLE public.shipments DROP CONSTRAINT IF EXISTS shipments_contact_id_fkey;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.account_relationships — legacy m:n table; redundant after
-- core.party_relationships ships. Rewire its FKs for the drop, but
-- consider dropping the whole table in a follow-up.
ALTER TABLE public.account_relationships DROP CONSTRAINT IF EXISTS account_relationships_from_account_id_fkey;
ALTER TABLE public.account_relationships ADD CONSTRAINT account_relationships_from_account_id_fkey
  FOREIGN KEY (from_account_id) REFERENCES core.parties(id);
ALTER TABLE public.account_relationships DROP CONSTRAINT IF EXISTS account_relationships_to_account_id_fkey;
ALTER TABLE public.account_relationships ADD CONSTRAINT account_relationships_to_account_id_fkey
  FOREIGN KEY (to_account_id) REFERENCES core.parties(id);

-- public.invoices
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.quote_contacts_screening
ALTER TABLE public.quote_contacts_screening DROP CONSTRAINT IF EXISTS quote_contacts_screening_contact_id_fkey;
ALTER TABLE public.quote_contacts_screening ADD CONSTRAINT quote_contacts_screening_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES core.parties(id) ON DELETE SET NULL;

-- public.messages
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_from_contact_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_from_contact_id_fkey
  FOREIGN KEY (from_contact_id) REFERENCES core.parties(id);
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_related_account_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_related_account_id_fkey
  FOREIGN KEY (related_account_id) REFERENCES core.parties(id);

-- public.account_references
ALTER TABLE public.account_references DROP CONSTRAINT IF EXISTS account_references_account_id_fkey;
ALTER TABLE public.account_references ADD CONSTRAINT account_references_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE CASCADE;

-- public.account_notes
ALTER TABLE public.account_notes DROP CONSTRAINT IF EXISTS account_notes_account_id_fkey;
ALTER TABLE public.account_notes ADD CONSTRAINT account_notes_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE CASCADE;

-- markets.portfolios
ALTER TABLE markets.portfolios DROP CONSTRAINT IF EXISTS portfolios_account_id_fkey;
ALTER TABLE markets.portfolios ADD CONSTRAINT portfolios_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES core.parties(id) ON DELETE RESTRICT;
ALTER TABLE markets.portfolios DROP CONSTRAINT IF EXISTS portfolios_contact_id_fkey;
ALTER TABLE markets.portfolios ADD CONSTRAINT portfolios_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES core.parties(id) ON DELETE RESTRICT;

-- ══════════════════════════════════════════════════════════════════════
-- Phase 2: drop dual-write triggers (they reference public.accounts/contacts)
-- ══════════════════════════════════════════════════════════════════════
--
-- The triggers themselves go away with the source tables they're
-- attached to (BEFORE/AFTER triggers drop with the table). The trigger
-- FUNCTIONS stay declared but become orphans — drop them explicitly to
-- keep the schema clean.

DROP FUNCTION IF EXISTS core.dual_write_from_accounts() CASCADE;
DROP FUNCTION IF EXISTS core.dual_write_from_contacts() CASCADE;

-- ══════════════════════════════════════════════════════════════════════
-- Phase 3: drop the views (they JOIN public.accounts/contacts)
-- ══════════════════════════════════════════════════════════════════════
--
-- Phase 4 will have replaced these with crm.v_accounts / crm.v_contacts
-- sourced from crm.*_extensions; that's the prerequisite. If this
-- migration is unparked before Phase 4 ships, the views are gone with
-- no replacement and the frontend breaks.

DROP VIEW IF EXISTS public.v_accounts;
DROP VIEW IF EXISTS public.v_contacts;

-- ══════════════════════════════════════════════════════════════════════
-- Phase 4: drop drift helper (its body references public.accounts/contacts)
-- ══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS core.parties_drift_check();
DROP FUNCTION IF EXISTS core.parties_backfill_summary();

-- ══════════════════════════════════════════════════════════════════════
-- Phase 5: drop the tables
-- ══════════════════════════════════════════════════════════════════════
--
-- No CASCADE — every FK pointing at these tables was rewired in Phase 1
-- above. CASCADE here would silently drop tables we want to keep.

DROP TABLE public.accounts;
DROP TABLE public.contacts;
