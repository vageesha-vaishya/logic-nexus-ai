-- Phase 6 Step 28 — do_not_contact column + outbox emitter on crm extensions.
--
-- Producer side of the CRM → comms suppression bridge per
-- docs/plans/2026-05-28-modules/comms.md §5 line 316:
--
--   crm.do_not_contact.set | Update comms.deliveries.status='suppressed'
--                            for matching addresses
--
-- Schema additions are identical on both crm.contact_extensions and
-- crm.account_extensions (a person and an organization can each be
-- marked do-not-contact):
--   do_not_contact            boolean NOT NULL DEFAULT false
--   do_not_contact_at         timestamptz NULL
--   do_not_contact_by_user_id uuid NULL
--
-- Audit columns are nullable because they're only meaningful when the
-- flag is true; backfill never touches them. The application sets them
-- in the same UPDATE that flips the flag (see consumer for the saga
-- counter-trail in core.audit_log later).
--
-- Trigger semantics: AFTER UPDATE OF do_not_contact, fires ONLY on the
-- FALSE→TRUE transition. Clearing the flag (TRUE→FALSE) does not emit
-- — the spec calls out only the SET direction; cleanup of past-set
-- suppressions is a separate UI flow (crm.do_not_contact.cleared
-- would be its own event, out of scope this slice). INSERT-with-true
-- also emits (covers backfill scripts that create an already-flagged
-- row directly).
--
-- Payload shape: { party_id, party_kind, set_by_user_id, set_at,
-- tenant_id }. party_kind discriminates 'contact' vs 'account' so the
-- consumer can resolve addresses appropriately (both link to
-- core.email_links / phone_links via subject_type='core.party' since
-- accounts.id == parties.id and contacts.id == parties.id per the
-- Phase 2 backfill, but the discriminator helps the suppression UI
-- attribute the source).

-- ══════════════════════════════════════════════════════════════════════
-- 1. Columns
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE crm.contact_extensions
  ADD COLUMN IF NOT EXISTS do_not_contact            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_at         timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_by_user_id uuid;

ALTER TABLE crm.account_extensions
  ADD COLUMN IF NOT EXISTS do_not_contact            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_at         timestamptz,
  ADD COLUMN IF NOT EXISTS do_not_contact_by_user_id uuid;

COMMENT ON COLUMN crm.contact_extensions.do_not_contact IS
  'Phase 6 Step 28 — when TRUE, all comms.suppressions rows for this contact''s addresses are upserted by the comms-api do-not-contact consumer. Emits crm.do_not_contact.set on the FALSE→TRUE transition.';
COMMENT ON COLUMN crm.account_extensions.do_not_contact IS
  'Phase 6 Step 28 — when TRUE, all comms.suppressions rows for this account''s addresses are upserted by the comms-api do-not-contact consumer. Emits crm.do_not_contact.set on the FALSE→TRUE transition.';

-- Partial index: scan only the flagged minority. Useful for the
-- compliance-officer "who is on the do-not-contact list?" view.
CREATE INDEX IF NOT EXISTS contact_extensions_do_not_contact_idx
  ON crm.contact_extensions (tenant_id, do_not_contact_at DESC)
  WHERE do_not_contact = true;
CREATE INDEX IF NOT EXISTS account_extensions_do_not_contact_idx
  ON crm.account_extensions (tenant_id, do_not_contact_at DESC)
  WHERE do_not_contact = true;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Emitter function (one fn, two triggers — discriminator passed via
--    a per-trigger arg).
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION crm.emit_do_not_contact_set()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = crm, core, pg_catalog
AS $$
DECLARE
  v_party_kind text := TG_ARGV[0];  -- 'contact' or 'account'
BEGIN
  -- Fire only on FALSE→TRUE transition (or INSERT with true).
  IF NEW.do_not_contact IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.do_not_contact = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO core.outbox (
    id, tenant_id, module, entity_type, event_type, entity_id,
    occurred_at, version, payload, metadata
  ) VALUES (
    gen_random_uuid(), NEW.tenant_id, 'crm', v_party_kind,
    'crm.do_not_contact.set', NEW.party_id,
    now(), 1,
    jsonb_build_object(
      'party_id',         NEW.party_id,
      'party_kind',       v_party_kind,
      'set_by_user_id',   NEW.do_not_contact_by_user_id,
      'set_at',           COALESCE(NEW.do_not_contact_at, now())
    ),
    jsonb_build_object(
      'source',  'crm.' || v_party_kind || '_extensions',
      'trigger', 'emit_do_not_contact_set',
      'previous_value',
        CASE WHEN TG_OP = 'UPDATE'
             THEN COALESCE(OLD.do_not_contact::text, 'null')
             ELSE NULL END
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Saga producers must never block the source-of-truth write.
  -- Missing outbox partition (post-Aug 2026 if not extended) would
  -- otherwise prevent a user from marking do_not_contact at all.
  RAISE WARNING 'emit_do_not_contact_set (party=%, tenant=%) failed: %',
    NEW.party_id, NEW.tenant_id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION crm.emit_do_not_contact_set() IS
  'Phase 6 Step 28 — emits crm.do_not_contact.set to core.outbox on the FALSE→TRUE transition of crm.{contact,account}_extensions.do_not_contact. Trigger arg [contact|account] discriminates the party_kind in the payload.';

DROP TRIGGER IF EXISTS trg_contact_extensions_emit_do_not_contact
  ON crm.contact_extensions;
CREATE TRIGGER trg_contact_extensions_emit_do_not_contact
  AFTER INSERT OR UPDATE OF do_not_contact ON crm.contact_extensions
  FOR EACH ROW
  WHEN (NEW.do_not_contact = true)
  EXECUTE FUNCTION crm.emit_do_not_contact_set('contact');

DROP TRIGGER IF EXISTS trg_account_extensions_emit_do_not_contact
  ON crm.account_extensions;
CREATE TRIGGER trg_account_extensions_emit_do_not_contact
  AFTER INSERT OR UPDATE OF do_not_contact ON crm.account_extensions
  FOR EACH ROW
  WHEN (NEW.do_not_contact = true)
  EXECUTE FUNCTION crm.emit_do_not_contact_set('account');
