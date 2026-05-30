-- Phase 6 Step 6 — quotation.quote.sent emits a customer-facing intent too.
--
-- Before: one core.notifications row, recipient_user_id = quotes.created_by
--         (internal owner FYI).
-- After:  two rows when the customer is resolvable, one when not.
--           a) internal FYI to the owner (kept verbatim)
--           b) customer-facing send via recipient_party_id (if a party
--              row matches the quote's contact_id) + recipient_address
--              (resolved from contacts.email or billing_address.email).
--
-- Both emissions share the same correlation_id so the saga can be
-- traced as one logical event (one quote.sent → 1..2 notifications →
-- 1..2 comms.deliveries).
--
-- Resolution order for the customer address:
--   1. public.contacts.email   (when quotes.contact_id is set)
--   2. quotes.billing_address->>'email'  (standalone fallback)
-- Party id (when known): currently only set when contact_id resolves
-- to a core.parties row via the (legacy_contact_id) external_ref.
-- That bridge doesn't exist today — the column stays NULL and the
-- recipient_address carries the load. Future bridge work just turns it on.

CREATE OR REPLACE FUNCTION public.emit_quotation_quote_sent_intent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, core
AS $$
DECLARE
  quote_row       public.quotes%ROWTYPE;
  contact_row     public.contacts%ROWTYPE;
  internal_user   uuid;
  customer_email  text;
  customer_party  uuid;
  rendered_subj   text;
  rendered_html   text;
  saga_id         uuid := gen_random_uuid();
  base_payload    jsonb;
BEGIN
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

  internal_user := quote_row.created_by;

  -- Customer resolution.
  IF quote_row.contact_id IS NOT NULL THEN
    SELECT * INTO contact_row FROM public.contacts WHERE id = quote_row.contact_id;
    IF contact_row.id IS NOT NULL THEN
      customer_email := NULLIF(TRIM(contact_row.email), '');
      -- party bridge: look up by legacy external ref. Returns NULL on miss.
      SELECT p.id INTO customer_party
      FROM core.parties p
      WHERE p.tenant_id = quote_row.tenant_id
        AND (p.external_refs->>'legacy_contact_id') = contact_row.id::text
      LIMIT 1;
    END IF;
  END IF;
  IF customer_email IS NULL THEN
    customer_email := NULLIF(TRIM(quote_row.billing_address->>'email'), '');
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

  base_payload := jsonb_build_object(
    'quote_id',        quote_row.id,
    'quote_number',    quote_row.quote_number,
    'version_id',      NEW.id,
    'version_major',   NEW.major,
    'version_minor',   NEW.minor,
    'total_amount',    quote_row.total_amount,
    'currency',        quote_row.currency,
    'subject',         rendered_subj,
    'html',            rendered_html
  );

  -- a) Internal FYI (unchanged behaviour from Step 5).
  IF internal_user IS NOT NULL THEN
    INSERT INTO core.notifications (
      tenant_id, recipient_user_id, subject_type, subject_id,
      intent_kind, severity, payload, correlation_id
    ) VALUES (
      quote_row.tenant_id, internal_user, 'quotation.quote_version', NEW.id,
      'quotation.quote.sent.internal', 'info',
      base_payload || jsonb_build_object('audience', 'internal'),
      saga_id
    );
  END IF;

  -- b) Customer-facing.
  IF customer_email IS NOT NULL THEN
    INSERT INTO core.notifications (
      tenant_id, recipient_party_id, recipient_address,
      subject_type, subject_id, intent_kind, severity, payload, correlation_id
    ) VALUES (
      quote_row.tenant_id, customer_party, customer_email,
      'quotation.quote_version', NEW.id,
      'quotation.quote.sent.customer', 'info',
      base_payload || jsonb_build_object(
        'audience',  'customer',
        'party_id',  customer_party,
        'email',     customer_email
      ),
      saga_id
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.emit_quotation_quote_sent_intent() IS
  'Phase 6 Step 6 — emits one internal-FYI + one customer-facing core.notifications row on quotation_versions.status → sent. Shared correlation_id ties both to one saga.';
