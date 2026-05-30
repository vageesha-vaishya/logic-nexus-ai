-- Phase 6 Step 5 — quotation.quote.sent → core.notifications emitter
-- Per docs/plans/2026-05-28-modules/comms.md §5 (Comms subscribes to
-- quotation.quote.sent) + master plan §6.0 (intent/delivery split).
--
-- The first end-to-end cross-module saga proof: a user flips
-- quotation_versions.status to 'sent' (typically via
-- src/components/quotation/quotation-versions/ApprovalWorkflow.tsx).
-- This trigger inserts a core.notifications row; comms-api's
-- notification-dispatcher polls core.notifications, fans out to
-- comms.deliveries; delivery-worker resolves the recipient's email and
-- hands off to the configured provider.
--
-- v0 recipient: quotes.created_by (the internal user who owns the
-- quote). The plan's customer-facing send (recipient_party_id) needs:
--   1. recipient_party_id column added to core.notifications
--   2. party→email resolution in comms-api/services/recipient-resolver.ts
-- Both deferred — this slice proves the saga end-to-end with an
-- internal-user recipient so the loop is verifiable today.
--
-- Idempotency: NEW.status='sent' AND (OLD.status IS NULL OR
-- OLD.status<>'sent') — only on the transition, not on subsequent
-- updates of an already-sent version.

CREATE OR REPLACE FUNCTION public.emit_quotation_quote_sent_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  quote_row     public.quotes%ROWTYPE;
  recipient     uuid;
  rendered_html text;
  rendered_subj text;
BEGIN
  -- Only fire on the draft|review|approved → 'sent' transition.
  IF NEW.status IS DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO quote_row FROM public.quotes WHERE id = NEW.quote_id;
  IF quote_row.id IS NULL THEN
    RETURN NEW;
  END IF;

  recipient := quote_row.created_by;
  IF recipient IS NULL THEN
    -- No recipient resolvable — skip rather than insert a bad row.
    -- delivery-worker would just fail it; cleaner to not emit.
    RETURN NEW;
  END IF;

  rendered_subj := 'Quote ' || COALESCE(quote_row.quote_number, NEW.id::text)
                   || ' sent (v' || COALESCE(NEW.major::text, '1')
                   || '.' || COALESCE(NEW.minor::text, '0') || ')';

  rendered_html :=
    '<p>Quote <strong>' || COALESCE(quote_row.quote_number, NEW.id::text)
    || '</strong> has been marked as sent.</p>'
    || '<p>Amount: ' || COALESCE(quote_row.currency, '')
       || ' ' || COALESCE(quote_row.total_amount::text, '—') || '</p>'
    || '<p>Version: ' || COALESCE(NEW.major::text, '1')
       || '.' || COALESCE(NEW.minor::text, '0') || '</p>';

  INSERT INTO core.notifications (
    tenant_id,
    recipient_user_id,
    subject_type,
    subject_id,
    intent_kind,
    severity,
    payload,
    correlation_id
  ) VALUES (
    NEW.tenant_id,
    recipient,
    'quotation.quote_version',
    NEW.id,
    'quotation.quote.sent',
    'info',
    jsonb_build_object(
      'quote_id',        quote_row.id,
      'quote_number',    quote_row.quote_number,
      'version_id',      NEW.id,
      'version_major',   NEW.major,
      'version_minor',   NEW.minor,
      'total_amount',    quote_row.total_amount,
      'currency',        quote_row.currency,
      'subject',         rendered_subj,
      'html',            rendered_html
    ),
    gen_random_uuid()
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.emit_quotation_quote_sent_intent() IS
  'Phase 6 Step 5 — emits core.notifications row when quotation_versions.status transitions to ''sent''. First end-to-end cross-module saga producer (comms.md §5).';

DROP TRIGGER IF EXISTS trg_emit_quotation_quote_sent_intent ON public.quotation_versions;

CREATE TRIGGER trg_emit_quotation_quote_sent_intent
  AFTER INSERT OR UPDATE OF status
  ON public.quotation_versions
  FOR EACH ROW
  WHEN (NEW.status = 'sent')
  EXECUTE FUNCTION public.emit_quotation_quote_sent_intent();
