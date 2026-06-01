-- Phase 6 Step 53 — finance.invoice.overdue dunning email emitter.
--
-- Closes the second of three comms.md §10 "cross-module event chain"
-- acceptance items. We had:
--   ✅ quotation.quote.sent → email   (Step 5)
--   ─ finance.invoice.overdue → dunning  ← THIS
--   ─ logistics.shipment.exception → multi-channel notify
--
-- Mirrors the Step 5 / Step 6 quote.sent emitter shape exactly:
-- AFTER INSERT OR UPDATE OF status WHEN NEW.status='overdue', insert
-- one core.notifications row tagged for the customer party. The
-- existing comms-api notification-dispatcher fans intent →
-- comms.deliveries; the delivery-worker resolves the recipient
-- email + hands to Resend.
--
-- Customer resolution:
-- finance.invoices.customer_id holds an accounts.id which == core.
-- parties.id for org parties (Phase 2 backfill invariant). Setting
-- recipient_party_id=customer_id lets the recipient-resolver
-- (services/comms-api/src/services/recipient-resolver.ts — recently
-- rewritten in Step 37 to use core.email_links/email_addresses) do
-- the right thing.
--
-- Idempotency: trigger WHEN (NEW.status='overdue') + the
-- OLD.status='overdue' early return means subsequent UPDATEs on an
-- already-overdue invoice don't double-emit. The status transition
-- IS the event; UPDATEs that don't change status (or move OUT of
-- overdue and back in) get one emit per transition.
--
-- Non-blocking: EXCEPTION WHEN OTHERS RAISE WARNING — saga
-- producers never block the source-of-truth write. If core.outbox
-- partition is missing, or notifications insert fails for any
-- reason, the invoice still goes overdue; the dunning just doesn't
-- fire. Matches the Step 5 and Step 28 producer contract.

CREATE OR REPLACE FUNCTION finance.emit_invoice_overdue_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = finance, public, core, pg_catalog
AS $$
DECLARE
  v_subject text;
  v_html    text;
  v_saga_id uuid := gen_random_uuid();
BEGIN
  -- Only on the actual transition into 'overdue'.
  IF NEW.status IS DISTINCT FROM 'overdue' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'overdue' THEN
    RETURN NEW;
  END IF;

  -- No customer → no party to dun. Skip rather than emit a row the
  -- recipient-resolver can't resolve.
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_subject := 'Invoice ' || COALESCE(NEW.invoice_number, NEW.id::text) || ' is overdue';

  v_html :=
    '<p>Invoice <strong>' || COALESCE(NEW.invoice_number, '') || '</strong> is overdue.</p>'
    || '<p>Balance due: ' || COALESCE(NEW.currency, '')
       || ' ' || COALESCE(NEW.balance_due::text, NEW.total::text, '—') || '</p>'
    || '<p>Due date: ' || COALESCE(NEW.due_date::text, '—') || '</p>'
    || '<p>Please remit at your earliest convenience.</p>';

  INSERT INTO core.notifications (
    tenant_id, recipient_party_id,
    subject_type, subject_id,
    intent_kind, severity, payload, correlation_id
  ) VALUES (
    NEW.tenant_id, NEW.customer_id,
    'finance.invoice', NEW.id,
    'finance.invoice.overdue', 'warning',
    jsonb_build_object(
      'invoice_id',     NEW.id,
      'invoice_number', NEW.invoice_number,
      'customer_id',    NEW.customer_id,
      'total',          NEW.total,
      'balance_due',    NEW.balance_due,
      'currency',       NEW.currency,
      'due_date',       NEW.due_date,
      'issue_date',     NEW.issue_date,
      'subject',        v_subject,
      'html',           v_html
    ),
    v_saga_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'emit_invoice_overdue_intent (invoice=%, tenant=%) failed: %',
    NEW.id, NEW.tenant_id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION finance.emit_invoice_overdue_intent() IS
  'Phase 6 Step 53 — emits core.notifications row when finance.invoices.status transitions to ''overdue''. Second cross-module saga producer for comms.md §10. Customer dunning email; recipient_party_id=customer_id (accounts.id == parties.id for org parties).';

DROP TRIGGER IF EXISTS trg_finance_invoice_overdue
  ON finance.invoices;

CREATE TRIGGER trg_finance_invoice_overdue
  AFTER INSERT OR UPDATE OF status
  ON finance.invoices
  FOR EACH ROW
  WHEN (NEW.status = 'overdue')
  EXECUTE FUNCTION finance.emit_invoice_overdue_intent();
