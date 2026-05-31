-- Phase 6 Step 19 — sales.lead.created outbox emitter.
--
-- Producer side of the compliance gating saga. Per compliance.md §5 the
-- chain is:
--
--   sales.lead.created (this trigger)
--     → compliance-api gating-consumer picks it up from core.outbox
--     → screens against compliance.restricted_party_lists (via
--       public.screen_restricted_party RPC)
--     → writes compliance.screenings row with terminal status
--     → if 'failed', downstream quote.sent gate (Step 23) blocks the
--       quote transition for any quote whose customer matches.
--
-- Mirrors the shape of core.emit_opportunity_won + core.emit_shipment_
-- delivered from 20260529190000_outbox_emitters_for_cross_module_events.
-- AFTER INSERT only — we don't re-screen on every UPDATE; if a lead is
-- edited and the company name changes, a manual re-screen via the UI is
-- the right path (the gating consumer's per-outbox-event idempotency
-- would suppress duplicate inserts anyway).
--
-- Payload carries enough denormalised data for the consumer to screen
-- without re-fetching the lead row:
--   - search_name: prefers company (organization screen) over person name
--   - country_code: NULL on creation (leads have no address column today);
--     the consumer passes NULL to screen_restricted_party which then
--     scans all countries
--   - party_id: leads aren't parties yet (account+contact are created on
--     conversion); the screening row's subject_party_id stays NULL until
--     conversion, and the gate at quote.sent walks lead.converted_account_id
--     to find lead-keyed screenings for the customer.

CREATE OR REPLACE FUNCTION core.emit_lead_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, public, pg_catalog
AS $$
DECLARE
  search_name text;
BEGIN
  search_name := COALESCE(
    NULLIF(trim(NEW.company), ''),
    NULLIF(trim(COALESCE(NEW.first_name,'') || ' ' || COALESCE(NEW.last_name,'')), '')
  );
  IF search_name IS NULL THEN
    -- Nothing to screen against; skip emission rather than write a
    -- bad outbox row the consumer would error on.
    RETURN NEW;
  END IF;

  INSERT INTO core.outbox (
    id, tenant_id, module, entity_type, event_type, entity_id,
    occurred_at, version, payload, metadata
  ) VALUES (
    gen_random_uuid(), NEW.tenant_id, 'sales', 'lead', 'sales.lead.created', NEW.id,
    now(), 1,
    jsonb_build_object(
      'lead_id',              NEW.id,
      'company',              NEW.company,
      'first_name',           NEW.first_name,
      'last_name',            NEW.last_name,
      'email',                NEW.email,
      'phone',                NEW.phone,
      'source',               NEW.source::text,
      'status',               NEW.status::text,
      'owner_id',             NEW.owner_id,
      'converted_account_id', NEW.converted_account_id,
      'converted_contact_id', NEW.converted_contact_id,
      'search_name',          search_name,
      'country_code',         NULL::text
    ),
    jsonb_build_object('source','public.leads','trigger','emit_lead_created')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Saga producers never block the source-of-truth write. The screening
  -- can be retried via a manual re-emit if outbox insert fails (e.g.
  -- partition missing). Log a warning so the failure is observable.
  RAISE WARNING 'emit_lead_created (id=%, tenant=%) failed: %', NEW.id, NEW.tenant_id, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION core.emit_lead_created() IS
  'Phase 6 Step 19 — emits sales.lead.created on core.outbox for the compliance gating saga (compliance.md §5).';

DROP TRIGGER IF EXISTS trg_leads_emit_created ON public.leads;
CREATE TRIGGER trg_leads_emit_created
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION core.emit_lead_created();
