-- Phase 5 Logistics Step 2 — satellite tables mirror
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 5
--
-- 13 satellite tables that were deferred from Logistics Step 1 because
-- they had 0 rows. Mirror with the same LIKE pattern; all empty at
-- backfill time so the dual-write triggers are what matter going forward.
--
-- RLS strategy per table:
--   - Direct tenant_id: shipment_attachments/containers/delays,
--     carrier_alliances, carrier_rate_attachments, carrier_rate_charges,
--     carrier_service_types, routes, vehicles, warehouses (10 tables).
--   - JOIN to logistics.shipments via shipment_id: customs_documents,
--     tracking_events, booking_executions (3 tables — no tenant_id
--     on source).

-- ══════════════════════════════════════════════════════════════════════
-- 1. Tables with direct tenant_id (10)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.shipment_attachments (LIKE public.shipment_attachments INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.shipment_attachments ADD PRIMARY KEY (id);
CREATE INDEX logistics_shipment_attachments_shipment_idx ON logistics.shipment_attachments (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX logistics_shipment_attachments_tenant_idx ON logistics.shipment_attachments (tenant_id);
ALTER TABLE logistics.shipment_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_shipment_attachments_tenant_select ON logistics.shipment_attachments FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_shipment_attachments_updated_at BEFORE UPDATE ON logistics.shipment_attachments FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.shipment_attachments TO authenticated;
GRANT ALL ON logistics.shipment_attachments TO service_role;

CREATE TABLE logistics.shipment_containers (LIKE public.shipment_containers INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.shipment_containers ADD PRIMARY KEY (id);
CREATE INDEX logistics_shipment_containers_shipment_idx ON logistics.shipment_containers (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX logistics_shipment_containers_tenant_idx ON logistics.shipment_containers (tenant_id);
ALTER TABLE logistics.shipment_containers ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_shipment_containers_tenant_select ON logistics.shipment_containers FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_shipment_containers_updated_at BEFORE UPDATE ON logistics.shipment_containers FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.shipment_containers TO authenticated;
GRANT ALL ON logistics.shipment_containers TO service_role;

CREATE TABLE logistics.shipment_delays (LIKE public.shipment_delays INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.shipment_delays ADD PRIMARY KEY (id);
CREATE INDEX logistics_shipment_delays_shipment_idx ON logistics.shipment_delays (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX logistics_shipment_delays_tenant_idx ON logistics.shipment_delays (tenant_id);
ALTER TABLE logistics.shipment_delays ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_shipment_delays_tenant_select ON logistics.shipment_delays FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_shipment_delays_updated_at BEFORE UPDATE ON logistics.shipment_delays FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.shipment_delays TO authenticated;
GRANT ALL ON logistics.shipment_delays TO service_role;

CREATE TABLE logistics.carrier_alliances (LIKE public.carrier_alliances INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.carrier_alliances ADD PRIMARY KEY (id);
CREATE INDEX logistics_carrier_alliances_tenant_idx ON logistics.carrier_alliances (tenant_id);
ALTER TABLE logistics.carrier_alliances ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_carrier_alliances_tenant_select ON logistics.carrier_alliances FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_carrier_alliances_updated_at BEFORE UPDATE ON logistics.carrier_alliances FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.carrier_alliances TO authenticated;
GRANT ALL ON logistics.carrier_alliances TO service_role;

CREATE TABLE logistics.carrier_rate_attachments (LIKE public.carrier_rate_attachments INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.carrier_rate_attachments ADD PRIMARY KEY (id);
CREATE INDEX logistics_carrier_rate_attachments_tenant_idx ON logistics.carrier_rate_attachments (tenant_id);
ALTER TABLE logistics.carrier_rate_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_carrier_rate_attachments_tenant_select ON logistics.carrier_rate_attachments FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_carrier_rate_attachments_updated_at BEFORE UPDATE ON logistics.carrier_rate_attachments FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.carrier_rate_attachments TO authenticated;
GRANT ALL ON logistics.carrier_rate_attachments TO service_role;

CREATE TABLE logistics.carrier_rate_charges (LIKE public.carrier_rate_charges INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.carrier_rate_charges ADD PRIMARY KEY (id);
CREATE INDEX logistics_carrier_rate_charges_tenant_idx ON logistics.carrier_rate_charges (tenant_id);
ALTER TABLE logistics.carrier_rate_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_carrier_rate_charges_tenant_select ON logistics.carrier_rate_charges FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_carrier_rate_charges_updated_at BEFORE UPDATE ON logistics.carrier_rate_charges FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.carrier_rate_charges TO authenticated;
GRANT ALL ON logistics.carrier_rate_charges TO service_role;

CREATE TABLE logistics.carrier_service_types (LIKE public.carrier_service_types INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.carrier_service_types ADD PRIMARY KEY (id);
CREATE INDEX logistics_carrier_service_types_tenant_idx ON logistics.carrier_service_types (tenant_id);
CREATE INDEX logistics_carrier_service_types_carrier_idx ON logistics.carrier_service_types (carrier_id) WHERE carrier_id IS NOT NULL;
ALTER TABLE logistics.carrier_service_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_carrier_service_types_tenant_select ON logistics.carrier_service_types FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_carrier_service_types_updated_at BEFORE UPDATE ON logistics.carrier_service_types FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.carrier_service_types TO authenticated;
GRANT ALL ON logistics.carrier_service_types TO service_role;

CREATE TABLE logistics.routes (LIKE public.routes INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.routes ADD PRIMARY KEY (id);
CREATE INDEX logistics_routes_tenant_idx ON logistics.routes (tenant_id);
ALTER TABLE logistics.routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_routes_tenant_select ON logistics.routes FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_routes_updated_at BEFORE UPDATE ON logistics.routes FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.routes TO authenticated;
GRANT ALL ON logistics.routes TO service_role;

CREATE TABLE logistics.vehicles (LIKE public.vehicles INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.vehicles ADD PRIMARY KEY (id);
CREATE INDEX logistics_vehicles_tenant_idx ON logistics.vehicles (tenant_id);
ALTER TABLE logistics.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_vehicles_tenant_select ON logistics.vehicles FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_vehicles_updated_at BEFORE UPDATE ON logistics.vehicles FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.vehicles TO authenticated;
GRANT ALL ON logistics.vehicles TO service_role;

CREATE TABLE logistics.warehouses (LIKE public.warehouses INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.warehouses ADD PRIMARY KEY (id);
CREATE INDEX logistics_warehouses_tenant_idx ON logistics.warehouses (tenant_id);
ALTER TABLE logistics.warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_warehouses_tenant_select ON logistics.warehouses FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_logistics_warehouses_updated_at BEFORE UPDATE ON logistics.warehouses FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.warehouses TO authenticated;
GRANT ALL ON logistics.warehouses TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Tables with no tenant_id — RLS via JOIN to logistics.shipments
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.customs_documents (LIKE public.customs_documents INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.customs_documents ADD PRIMARY KEY (id);
CREATE INDEX logistics_customs_documents_shipment_idx ON logistics.customs_documents (shipment_id) WHERE shipment_id IS NOT NULL;
ALTER TABLE logistics.customs_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_customs_documents_tenant_select ON logistics.customs_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM logistics.shipments s WHERE s.id = logistics.customs_documents.shipment_id AND s.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))));
CREATE TRIGGER trg_logistics_customs_documents_updated_at BEFORE UPDATE ON logistics.customs_documents FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.customs_documents TO authenticated;
GRANT ALL ON logistics.customs_documents TO service_role;

CREATE TABLE logistics.tracking_events (LIKE public.tracking_events INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.tracking_events ADD PRIMARY KEY (id);
CREATE INDEX logistics_tracking_events_shipment_idx ON logistics.tracking_events (shipment_id) WHERE shipment_id IS NOT NULL;
ALTER TABLE logistics.tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_tracking_events_tenant_select ON logistics.tracking_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM logistics.shipments s WHERE s.id = logistics.tracking_events.shipment_id AND s.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))));
CREATE TRIGGER trg_logistics_tracking_events_updated_at BEFORE UPDATE ON logistics.tracking_events FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON logistics.tracking_events TO authenticated;
GRANT ALL ON logistics.tracking_events TO service_role;

CREATE TABLE logistics.booking_executions (LIKE public.booking_executions INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.booking_executions ADD PRIMARY KEY (id);
CREATE INDEX logistics_booking_executions_shipment_idx ON logistics.booking_executions (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX logistics_booking_executions_booking_idx ON logistics.booking_executions (booking_id) WHERE booking_id IS NOT NULL;
ALTER TABLE logistics.booking_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_booking_executions_tenant_select ON logistics.booking_executions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM logistics.shipments s WHERE s.id = logistics.booking_executions.shipment_id AND s.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))));
GRANT SELECT ON logistics.booking_executions TO authenticated;
GRANT ALL ON logistics.booking_executions TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Backfill (all empty in source — these are no-ops at apply time)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO logistics.shipment_attachments      SELECT * FROM public.shipment_attachments      ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.shipment_containers       SELECT * FROM public.shipment_containers       ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.shipment_delays           SELECT * FROM public.shipment_delays           ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.carrier_alliances         SELECT * FROM public.carrier_alliances         ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.carrier_rate_attachments  SELECT * FROM public.carrier_rate_attachments  ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.carrier_rate_charges      SELECT * FROM public.carrier_rate_charges      ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.carrier_service_types     SELECT * FROM public.carrier_service_types     ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.routes                    SELECT * FROM public.routes                    ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.vehicles                  SELECT * FROM public.vehicles                  ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.warehouses                SELECT * FROM public.warehouses                ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.customs_documents         SELECT * FROM public.customs_documents         ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.tracking_events           SELECT * FROM public.tracking_events           ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.booking_executions        SELECT * FROM public.booking_executions        ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Dual-write triggers (DELETE+INSERT pattern, fail-open)
-- ══════════════════════════════════════════════════════════════════════
--
-- Generated from a template — each function is the same shape with only
-- the table name varying. Keeping them as separate functions (rather
-- than dynamic SQL) for explicit search_path safety.

DO $$
DECLARE
  tbl text;
  source_tbl text;
  tables text[] := ARRAY[
    'shipment_attachments','shipment_containers','shipment_delays',
    'carrier_alliances','carrier_rate_attachments','carrier_rate_charges',
    'carrier_service_types','routes','vehicles','warehouses',
    'customs_documents','tracking_events','booking_executions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    source_tbl := 'public.' || tbl;
    EXECUTE format($f$
      CREATE OR REPLACE FUNCTION logistics.dual_write_from_%I()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $TRG$
      BEGIN
        IF TG_OP = 'DELETE' THEN DELETE FROM logistics.%I WHERE id = OLD.id;
        ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.%I SELECT NEW.* ON CONFLICT (id) DO NOTHING;
        ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.%I WHERE id = NEW.id; INSERT INTO logistics.%I SELECT NEW.*;
        END IF;
        RETURN COALESCE(NEW, OLD);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'dual_write_from_%I (op=%%, id=%%) failed: %%', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
        RETURN COALESCE(NEW, OLD);
      END; $TRG$;
    $f$, tbl, tbl, tbl, tbl, tbl, tbl);

    EXECUTE format($f$
      CREATE TRIGGER trg_%I_dual_write_to_logistics
        AFTER INSERT OR UPDATE OR DELETE ON %s
        FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_%I();
    $f$, tbl, source_tbl, tbl);
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Drift monitor — extend with the 13 new metrics
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION logistics.satellite_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = logistics, public, pg_catalog AS $$
  SELECT 'shipment_attachments_minus_logistics', (SELECT count(*) FROM public.shipment_attachments) - (SELECT count(*) FROM logistics.shipment_attachments)
  UNION ALL SELECT 'shipment_containers_minus_logistics', (SELECT count(*) FROM public.shipment_containers) - (SELECT count(*) FROM logistics.shipment_containers)
  UNION ALL SELECT 'shipment_delays_minus_logistics', (SELECT count(*) FROM public.shipment_delays) - (SELECT count(*) FROM logistics.shipment_delays)
  UNION ALL SELECT 'carrier_alliances_minus_logistics', (SELECT count(*) FROM public.carrier_alliances) - (SELECT count(*) FROM logistics.carrier_alliances)
  UNION ALL SELECT 'carrier_rate_attachments_minus_logistics', (SELECT count(*) FROM public.carrier_rate_attachments) - (SELECT count(*) FROM logistics.carrier_rate_attachments)
  UNION ALL SELECT 'carrier_rate_charges_minus_logistics', (SELECT count(*) FROM public.carrier_rate_charges) - (SELECT count(*) FROM logistics.carrier_rate_charges)
  UNION ALL SELECT 'carrier_service_types_minus_logistics', (SELECT count(*) FROM public.carrier_service_types) - (SELECT count(*) FROM logistics.carrier_service_types)
  UNION ALL SELECT 'routes_minus_logistics', (SELECT count(*) FROM public.routes) - (SELECT count(*) FROM logistics.routes)
  UNION ALL SELECT 'vehicles_minus_logistics', (SELECT count(*) FROM public.vehicles) - (SELECT count(*) FROM logistics.vehicles)
  UNION ALL SELECT 'warehouses_minus_logistics', (SELECT count(*) FROM public.warehouses) - (SELECT count(*) FROM logistics.warehouses)
  UNION ALL SELECT 'customs_documents_minus_logistics', (SELECT count(*) FROM public.customs_documents) - (SELECT count(*) FROM logistics.customs_documents)
  UNION ALL SELECT 'tracking_events_minus_logistics', (SELECT count(*) FROM public.tracking_events) - (SELECT count(*) FROM logistics.tracking_events)
  UNION ALL SELECT 'booking_executions_minus_logistics', (SELECT count(*) FROM public.booking_executions) - (SELECT count(*) FROM logistics.booking_executions);
$$;
COMMENT ON FUNCTION logistics.satellite_drift_check IS 'Phase 5 Logistics Step 2 satellite drift monitor. All 13 deltas should remain 0.';
GRANT EXECUTE ON FUNCTION logistics.satellite_drift_check TO service_role;
