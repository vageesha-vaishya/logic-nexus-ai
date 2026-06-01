-- Phase 6 Step 54b — logistics.shipment.exception multi-channel emitter.
--
-- Third and final cross-module event chain required by comms.md §10:
--   ✅ quotation.quote.sent → email                (Step 5)
--   ✅ finance.invoice.overdue → dunning email     (Step 53)
--   ─  logistics.shipment.exception → multi-channel notify  ← THIS
--
-- Trigger on public.shipments AFTER INSERT OR UPDATE OF status WHEN
-- NEW.status='exception'. Inserts one core.notifications row tagged
-- for the customer party with severity='critical'. The existing
-- comms-api dispatcher fans out into comms.deliveries per channel-
-- preference; "multi-channel" happens naturally — if the party has
-- email + sms registered, both deliveries are created.
--
-- recipient_party_id = account_id (accounts.id == parties.id for org
-- parties per Phase 2 backfill). The recipient-resolver (Step 37)
-- pulls the primary email; future channel-preference work fan-outs
-- to SMS / push without changes here.
--
-- Severity='critical' (not 'warning' like the invoice dunning):
-- exceptions are blocking ops events — the customer needs to know
-- something is genuinely wrong, not a routine reminder. The
-- dispatcher + delivery-worker treat severity as an input to retry
-- aggressiveness + suppression bypass (TBD; today they ignore it,
-- but the field is in the payload for future use).
--
-- Same idempotency + non-blocking contract as Step 5 / Step 53:
-- only fires on the actual transition into 'exception' (not on
-- repeat UPDATEs that don't change status); exception-handler
-- RAISE WARNING so the saga producer never blocks the source-of-
-- truth write.

CREATE OR REPLACE FUNCTION logistics.emit_shipment_exception_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = logistics, public, core, pg_catalog
AS $$
DECLARE
  v_subject text;
  v_html    text;
  v_saga_id uuid := gen_random_uuid();
BEGIN
  IF NEW.status IS DISTINCT FROM 'exception' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'exception' THEN
    RETURN NEW;
  END IF;

  -- No customer → no party recipient → skip rather than emit a
  -- row the dispatcher can't resolve.
  IF NEW.account_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_subject := 'Shipment ' || COALESCE(NEW.shipment_number, NEW.id::text) || ' — exception flagged';

  v_html :=
    '<p>Shipment <strong>' || COALESCE(NEW.shipment_number, '') || '</strong> has been flagged with an exception.</p>'
    || CASE WHEN NEW.current_status_description IS NOT NULL
            THEN '<p>Detail: ' || NEW.current_status_description || '</p>'
            ELSE '' END
    || CASE WHEN NEW.estimated_delivery_date IS NOT NULL
            THEN '<p>Original ETA: ' || NEW.estimated_delivery_date::text || '</p>'
            ELSE '' END
    || '<p>Our team is reviewing and will follow up shortly.</p>';

  INSERT INTO core.notifications (
    tenant_id, recipient_party_id,
    subject_type, subject_id,
    intent_kind, severity, payload, correlation_id
  ) VALUES (
    NEW.tenant_id, NEW.account_id,
    'logistics.shipment', NEW.id,
    'logistics.shipment.exception', 'critical',
    jsonb_build_object(
      'shipment_id',                 NEW.id,
      'shipment_number',             NEW.shipment_number,
      'account_id',                  NEW.account_id,
      'contact_id',                  NEW.contact_id,
      'shipment_type',               NEW.shipment_type,
      'origin_country',              NEW.origin_country,
      'destination_country',         NEW.destination_country,
      'port_of_loading',             NEW.port_of_loading,
      'port_of_discharge',           NEW.port_of_discharge,
      'estimated_delivery_date',     NEW.estimated_delivery_date,
      'current_status_description',  NEW.current_status_description,
      'current_location',            NEW.current_location,
      'reference_number',            NEW.reference_number,
      'subject',                     v_subject,
      'html',                        v_html
    ),
    v_saga_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'emit_shipment_exception_intent (shipment=%, tenant=%) failed: %',
    NEW.id, NEW.tenant_id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION logistics.emit_shipment_exception_intent() IS
  'Phase 6 Step 54b — emits core.notifications row when public.shipments.status transitions to ''exception''. Third cross-module saga producer for comms.md §10. severity=critical; multi-channel fan-out via the dispatcher''s per-channel-preference logic.';

DROP TRIGGER IF EXISTS trg_shipments_emit_exception
  ON public.shipments;

CREATE TRIGGER trg_shipments_emit_exception
  AFTER INSERT OR UPDATE OF status
  ON public.shipments
  FOR EACH ROW
  WHEN (NEW.status = 'exception')
  EXECUTE FUNCTION logistics.emit_shipment_exception_intent();
