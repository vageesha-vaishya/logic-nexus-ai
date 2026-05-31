-- Phase 6 Step 42 — crm.do_not_contact.cleared emitter + view extension.
--
-- Completes the bidirectional contract from Steps 27-30. Currently
-- flipping do_not_contact false→true emits crm.do_not_contact.set
-- and adds comms.suppressions rows; flipping true→false emits
-- nothing and the suppressions stay. Real product gap: a customer
-- who says "actually contact me again" can't be un-suppressed
-- without manual SQL.
--
-- Pieces:
--   1. crm.emit_do_not_contact_cleared() trigger fn + 2 triggers
--      mirroring Step 28's set-side. Fires on the TRUE→FALSE
--      transition only. Payload includes cleared_by_user_id +
--      cleared_at (read from the same do_not_contact_by_user_id /
--      do_not_contact_at columns — the app overwrites them on
--      clear; outbox is the source of truth for full history).
--   2. v_cross_module_pending_events rebuild to include the new
--      event type alongside the existing 7.
--
-- Step 43 wires the comms-api consumer + remove-suppressions RPC.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Emitter fn + 2 triggers
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION crm.emit_do_not_contact_cleared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = crm, core, pg_catalog
AS $$
DECLARE
  v_party_kind text := TG_ARGV[0];  -- 'contact' or 'account'
BEGIN
  -- Fires only on TRUE→FALSE. The trigger's WHEN clause filters
  -- NEW.do_not_contact=false but UPDATE OF do_not_contact also
  -- fires when nothing actually changed (UPDATE … SET do_not_contact=
  -- false on a row that's already false). Guard against that
  -- here so a noop UPDATE doesn't emit.
  IF OLD.do_not_contact IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;
  IF NEW.do_not_contact IS DISTINCT FROM false THEN
    RETURN NEW;
  END IF;

  INSERT INTO core.outbox (
    id, tenant_id, module, entity_type, event_type, entity_id,
    occurred_at, version, payload, metadata
  ) VALUES (
    gen_random_uuid(), NEW.tenant_id, 'crm', v_party_kind,
    'crm.do_not_contact.cleared', NEW.party_id,
    now(), 1,
    jsonb_build_object(
      'party_id',           NEW.party_id,
      'party_kind',         v_party_kind,
      'cleared_by_user_id', NEW.do_not_contact_by_user_id,
      'cleared_at',         COALESCE(NEW.do_not_contact_at, now())
    ),
    jsonb_build_object(
      'source',  'crm.' || v_party_kind || '_extensions',
      'trigger', 'emit_do_not_contact_cleared'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Same non-blocking contract as the .set emitter (Step 28): never
  -- block the source-of-truth write. Missing outbox partition or
  -- any other write failure logs a warning and lets the UPDATE land.
  RAISE WARNING 'emit_do_not_contact_cleared (party=%, tenant=%) failed: %',
    NEW.party_id, NEW.tenant_id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION crm.emit_do_not_contact_cleared() IS
  'Phase 6 Step 42 — emits crm.do_not_contact.cleared to core.outbox on the TRUE→FALSE transition of crm.{contact,account}_extensions.do_not_contact. Trigger arg [contact|account] discriminates payload.party_kind.';

DROP TRIGGER IF EXISTS trg_contact_extensions_emit_do_not_contact_cleared
  ON crm.contact_extensions;
CREATE TRIGGER trg_contact_extensions_emit_do_not_contact_cleared
  AFTER UPDATE OF do_not_contact ON crm.contact_extensions
  FOR EACH ROW
  WHEN (NEW.do_not_contact = false AND OLD.do_not_contact = true)
  EXECUTE FUNCTION crm.emit_do_not_contact_cleared('contact');

DROP TRIGGER IF EXISTS trg_account_extensions_emit_do_not_contact_cleared
  ON crm.account_extensions;
CREATE TRIGGER trg_account_extensions_emit_do_not_contact_cleared
  AFTER UPDATE OF do_not_contact ON crm.account_extensions
  FOR EACH ROW
  WHEN (NEW.do_not_contact = false AND OLD.do_not_contact = true)
  EXECUTE FUNCTION crm.emit_do_not_contact_cleared('account');

-- ══════════════════════════════════════════════════════════════════════
-- 2. View extension — include the new event type
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW core.v_cross_module_pending_events AS
SELECT o.id, o.tenant_id, o.module, o.event_type, o.entity_id,
       o.occurred_at, o.version, o.payload, o.metadata
FROM core.outbox o
LEFT JOIN core.outbox_retries r ON r.outbox_id = o.id
WHERE o.published_at IS NULL
  AND o.event_type IN (
    'sales.opportunity.won',
    'logistics.shipment.delivered',
    'sales.lead.created',
    'quotation.quote.send_requested',
    'logistics.booking.created',
    'finance.payment.created',
    'crm.do_not_contact.set',
    'crm.do_not_contact.cleared'
  )
  AND (r.id IS NULL OR (r.status = 'pending' AND r.next_attempt_at <= now()))
ORDER BY o.occurred_at;

COMMENT ON VIEW core.v_cross_module_pending_events IS
  'Unpublished cross-module events ready for consumer pickup. Phase 6 Step 42 added crm.do_not_contact.cleared alongside .set and the finance + gating chains.';

GRANT SELECT ON core.v_cross_module_pending_events TO service_role;
