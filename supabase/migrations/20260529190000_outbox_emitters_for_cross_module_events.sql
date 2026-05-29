-- Phase 5 cross-module event emitters — outbox triggers for the two
-- chains the master plan called out at §7.4 Phase 5 lines 1280-1281:
--
--   1. sales.opportunity.won       → finance.commission.computed
--   2. logistics.shipment.delivered → finance.invoice.drafted
--
-- This slice wires the EMITTER side via core.outbox (Phase 1 Slice A
-- pattern). A future consumer (in finance-api, a worker, or wherever
-- the handler lands) reads core.outbox WHERE published_at IS NULL,
-- performs the side effect, and stamps published_at. The DB triggers
-- here guarantee at-least-once delivery from source-of-truth writes
-- without coupling the publishing service to the consumer.
--
-- Trigger conditions:
--   - public.opportunities: NEW.stage = 'closed_won' AND
--     (OLD.stage IS DISTINCT FROM 'closed_won')
--   - public.shipments:     NEW.status = 'delivered' AND
--     (OLD.status IS DISTINCT FROM 'delivered')
--
-- Both INSERT-or-UPDATE — INSERT can land in the terminal state
-- directly (e.g., a backfilled opportunity already-won).
--
-- payload includes enough denormalised data for the downstream consumer
-- to act without re-fetching: opportunity amount + account + owner;
-- shipment total_charges + account + carrier + ports.

CREATE OR REPLACE FUNCTION core.emit_opportunity_won()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM 'closed_won' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage IS NOT DISTINCT FROM 'closed_won' THEN RETURN NEW; END IF;
  INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id, occurred_at, version, payload, metadata)
  VALUES (
    gen_random_uuid(), NEW.tenant_id, 'sales', 'opportunity', 'sales.opportunity.won', NEW.id,
    now(), 1,
    jsonb_build_object(
      'opportunity_id', NEW.id, 'name', NEW.name, 'amount', NEW.amount,
      'expected_revenue', NEW.expected_revenue, 'close_date', NEW.close_date,
      'account_id', NEW.account_id, 'contact_id', NEW.contact_id, 'lead_id', NEW.lead_id,
      'owner_id', NEW.owner_id, 'currency', 'INR'),
    jsonb_build_object('source','public.opportunities','trigger','emit_opportunity_won',
      'previous_stage', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage::text ELSE NULL END));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'emit_opportunity_won (id=%, tenant=%) failed: %', NEW.id, NEW.tenant_id, SQLERRM;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_opportunities_emit_won
  AFTER INSERT OR UPDATE OF stage ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION core.emit_opportunity_won();

CREATE OR REPLACE FUNCTION core.emit_shipment_delivered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'delivered' THEN RETURN NEW; END IF;
  INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id, occurred_at, version, payload, metadata)
  VALUES (
    gen_random_uuid(), NEW.tenant_id, 'logistics', 'shipment', 'logistics.shipment.delivered', NEW.id,
    now(), 1,
    jsonb_build_object(
      'shipment_id', NEW.id, 'shipment_number', NEW.shipment_number,
      'account_id', NEW.account_id, 'contact_id', NEW.contact_id,
      'carrier_id', NEW.carrier_id, 'vendor_id', NEW.vendor_id,
      'quote_id', NEW.quote_id, 'booking_id', NEW.booking_id,
      'total_charges', NEW.total_charges, 'currency', COALESCE(NEW.currency, 'INR'),
      'pickup_date', NEW.pickup_date,
      'estimated_delivery_date', NEW.estimated_delivery_date,
      'actual_delivery_date', COALESCE(NEW.actual_delivery_date, now()),
      'port_of_loading', NEW.port_of_loading, 'port_of_discharge', NEW.port_of_discharge,
      'origin_country', NEW.origin_country, 'destination_country', NEW.destination_country),
    jsonb_build_object('source','public.shipments','trigger','emit_shipment_delivered',
      'previous_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status::text ELSE NULL END));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'emit_shipment_delivered (id=%, tenant=%) failed: %', NEW.id, NEW.tenant_id, SQLERRM;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_shipments_emit_delivered
  AFTER INSERT OR UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION core.emit_shipment_delivered();

-- Backfill uses now() for occurred_at because core.outbox is monthly-
-- partitioned (Apr-Aug 2026 only at apply time) and historical
-- close_at timestamps may fall outside any partition. Original close
-- timestamps are preserved inside payload.original_closed_at for
-- consumers that need the audit truth.
INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id, occurred_at, version, payload, metadata)
SELECT gen_random_uuid(), o.tenant_id, 'sales', 'opportunity', 'sales.opportunity.won', o.id,
  now(), 1,
  jsonb_build_object('opportunity_id', o.id, 'name', o.name, 'amount', o.amount, 'expected_revenue', o.expected_revenue,
    'close_date', o.close_date, 'account_id', o.account_id, 'contact_id', o.contact_id, 'lead_id', o.lead_id,
    'owner_id', o.owner_id, 'currency', 'INR',
    'original_closed_at', COALESCE(o.closed_at, o.updated_at)),
  jsonb_build_object('source','public.opportunities','trigger','backfill_already_won')
FROM public.opportunities o WHERE o.stage = 'closed_won';

INSERT INTO core.outbox (id, tenant_id, module, entity_type, event_type, entity_id, occurred_at, version, payload, metadata)
SELECT gen_random_uuid(), s.tenant_id, 'logistics', 'shipment', 'logistics.shipment.delivered', s.id,
  now(), 1,
  jsonb_build_object('shipment_id', s.id, 'shipment_number', s.shipment_number,
    'account_id', s.account_id, 'contact_id', s.contact_id,
    'carrier_id', s.carrier_id, 'vendor_id', s.vendor_id,
    'quote_id', s.quote_id, 'booking_id', s.booking_id,
    'total_charges', s.total_charges, 'currency', COALESCE(s.currency, 'INR'),
    'pickup_date', s.pickup_date,
    'estimated_delivery_date', s.estimated_delivery_date,
    'actual_delivery_date', COALESCE(s.actual_delivery_date, now()),
    'port_of_loading', s.port_of_loading, 'port_of_discharge', s.port_of_discharge,
    'origin_country', s.origin_country, 'destination_country', s.destination_country,
    'original_delivered_at', COALESCE(s.actual_delivery_date, s.updated_at)),
  jsonb_build_object('source','public.shipments','trigger','backfill_already_delivered')
FROM public.shipments s WHERE s.status = 'delivered';

CREATE OR REPLACE VIEW core.v_cross_module_pending_events AS
SELECT id, tenant_id, module, event_type, entity_id, occurred_at, version, payload, metadata
FROM core.outbox WHERE published_at IS NULL AND event_type IN ('sales.opportunity.won', 'logistics.shipment.delivered')
ORDER BY occurred_at;
COMMENT ON VIEW core.v_cross_module_pending_events IS 'Unpublished sales.opportunity.won + logistics.shipment.delivered events ready for finance-api consumption.';
GRANT SELECT ON core.v_cross_module_pending_events TO service_role;

CREATE OR REPLACE FUNCTION core.cross_module_event_counts()
RETURNS TABLE (event_type text, total bigint, unpublished bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, pg_catalog AS $$
  SELECT event_type, count(*), count(*) FILTER (WHERE published_at IS NULL)
  FROM core.outbox WHERE event_type IN ('sales.opportunity.won', 'logistics.shipment.delivered')
  GROUP BY event_type ORDER BY event_type;
$$;
COMMENT ON FUNCTION core.cross_module_event_counts IS 'Total + unpublished counts for the two Phase 5 cross-module chains.';
GRANT EXECUTE ON FUNCTION core.cross_module_event_counts TO service_role;
