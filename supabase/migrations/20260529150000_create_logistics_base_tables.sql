-- Phase 5 Logistics Step 1 — canonical logistics.* base tables
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 5
--
-- The logistics.* schema already exists with one live table:
-- logistics.quote_items_extension (314 rows) — the logistics-domain
-- side of the quote_items_core/extension split. Leave that one alone.
--
-- This slice mirrors the ten core anchor tables from public.* into
-- logistics.* — the ones that carry row volume today plus the two
-- "container_sizes / container_types duplicate" tables the master
-- plan called out at §7.4 Phase 5 (line 1271). On inspection those
-- aren't actually duplicates — container_types is the categorical
-- code (DRY/REEFER/FLAT/…) and container_sizes is the dimensions
-- table with an FK to container_type_id. Mirror both faithfully.
--
-- Tables mirrored (row counts at backfill time):
--   - logistics.shipments                       (34 rows, 64 cols) — primary
--   - logistics.shipment_items                  (10 rows, 17 cols) — RLS via JOIN to shipments (no tenant_id)
--   - logistics.shipment_cargo_configurations   (1 row, 27 cols)
--   - logistics.bookings                        (4 rows, 25 cols) — primary
--   - logistics.booking_agents                  (1 row, 10 cols)
--   - logistics.carriers                        (32 rows, 23 cols) — master data
--   - logistics.carrier_rates                   (6 rows, 49 cols)
--   - logistics.vendors                         (189 rows, 22 cols) — largest table in this slice
--   - logistics.container_sizes                 (5 rows, 18 cols) — global reference; public-readable RLS
--   - logistics.container_types                 (13 rows, 8 cols)
--
-- Carrier-as-party (every carrier gets a core.parties row) is its own
-- follow-up slice. So is logistics.shipment_attachments / containers /
-- delays / tracking_events / customs_documents / routes / warehouses /
-- vehicles + carrier_alliances / rate_attachments / rate_charges /
-- service_types / booking_executions — all 0 rows currently, lower
-- priority. vendor_portal_activity stays dead-table-pending-drop.

-- ══════════════════════════════════════════════════════════════════════
-- 1. logistics.shipments
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.shipments (LIKE public.shipments INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.shipments ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.shipments IS
  'Phase 5 Logistics Step 1 — mirror of public.shipments.';

CREATE INDEX logistics_shipments_tenant_status_idx ON logistics.shipments (tenant_id, status, created_at DESC);
CREATE INDEX logistics_shipments_franchise_idx     ON logistics.shipments (franchise_id) WHERE franchise_id IS NOT NULL;

ALTER TABLE logistics.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_shipments_tenant_select ON logistics.shipments
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_shipments_updated_at
  BEFORE UPDATE ON logistics.shipments
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.shipments TO authenticated;
GRANT ALL    ON logistics.shipments TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. logistics.shipment_items
-- ══════════════════════════════════════════════════════════════════════
-- No tenant_id on the source; RLS must JOIN through logistics.shipments.

CREATE TABLE logistics.shipment_items (LIKE public.shipment_items INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.shipment_items ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.shipment_items IS
  'Phase 5 Logistics Step 1 — mirror of public.shipment_items. RLS via JOIN to logistics.shipments since source lacks tenant_id.';

CREATE INDEX logistics_shipment_items_shipment_idx ON logistics.shipment_items (shipment_id);

ALTER TABLE logistics.shipment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_shipment_items_tenant_select ON logistics.shipment_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM logistics.shipments s
    WHERE s.id = logistics.shipment_items.shipment_id
      AND s.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));

CREATE TRIGGER trg_logistics_shipment_items_updated_at
  BEFORE UPDATE ON logistics.shipment_items
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.shipment_items TO authenticated;
GRANT ALL    ON logistics.shipment_items TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. logistics.shipment_cargo_configurations
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.shipment_cargo_configurations (LIKE public.shipment_cargo_configurations INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.shipment_cargo_configurations ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.shipment_cargo_configurations IS
  'Phase 5 Logistics Step 1 — mirror of public.shipment_cargo_configurations.';

CREATE INDEX logistics_shipment_cargo_configs_tenant_idx ON logistics.shipment_cargo_configurations (tenant_id);

ALTER TABLE logistics.shipment_cargo_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_shipment_cargo_configs_tenant_select ON logistics.shipment_cargo_configurations
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_shipment_cargo_configs_updated_at
  BEFORE UPDATE ON logistics.shipment_cargo_configurations
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.shipment_cargo_configurations TO authenticated;
GRANT ALL    ON logistics.shipment_cargo_configurations TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 4. logistics.bookings
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.bookings (LIKE public.bookings INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.bookings ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.bookings IS
  'Phase 5 Logistics Step 1 — mirror of public.bookings.';

CREATE INDEX logistics_bookings_tenant_status_idx ON logistics.bookings (tenant_id, status, created_at DESC);
CREATE INDEX logistics_bookings_franchise_idx     ON logistics.bookings (franchise_id) WHERE franchise_id IS NOT NULL;

ALTER TABLE logistics.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_bookings_tenant_select ON logistics.bookings
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_bookings_updated_at
  BEFORE UPDATE ON logistics.bookings
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.bookings TO authenticated;
GRANT ALL    ON logistics.bookings TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 5. logistics.booking_agents
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.booking_agents (LIKE public.booking_agents INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.booking_agents ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.booking_agents IS
  'Phase 5 Logistics Step 1 — mirror of public.booking_agents.';

CREATE INDEX logistics_booking_agents_tenant_idx ON logistics.booking_agents (tenant_id);

ALTER TABLE logistics.booking_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_booking_agents_tenant_select ON logistics.booking_agents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_booking_agents_updated_at
  BEFORE UPDATE ON logistics.booking_agents
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.booking_agents TO authenticated;
GRANT ALL    ON logistics.booking_agents TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 6. logistics.carriers
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.carriers (LIKE public.carriers INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.carriers ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.carriers IS
  'Phase 5 Logistics Step 1 — mirror of public.carriers. Carrier-as-party (core.parties row per carrier) is a separate follow-up slice.';

CREATE INDEX logistics_carriers_tenant_idx ON logistics.carriers (tenant_id);

ALTER TABLE logistics.carriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_carriers_tenant_select ON logistics.carriers
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_carriers_updated_at
  BEFORE UPDATE ON logistics.carriers
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.carriers TO authenticated;
GRANT ALL    ON logistics.carriers TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 7. logistics.carrier_rates
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.carrier_rates (LIKE public.carrier_rates INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.carrier_rates ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.carrier_rates IS
  'Phase 5 Logistics Step 1 — mirror of public.carrier_rates.';

CREATE INDEX logistics_carrier_rates_tenant_idx ON logistics.carrier_rates (tenant_id);

ALTER TABLE logistics.carrier_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_carrier_rates_tenant_select ON logistics.carrier_rates
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_carrier_rates_updated_at
  BEFORE UPDATE ON logistics.carrier_rates
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.carrier_rates TO authenticated;
GRANT ALL    ON logistics.carrier_rates TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 8. logistics.vendors
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.vendors (LIKE public.vendors INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.vendors ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.vendors IS
  'Phase 5 Logistics Step 1 — mirror of public.vendors. Vendor-as-party (core.parties row per vendor) is a separate follow-up slice.';

CREATE INDEX logistics_vendors_tenant_idx    ON logistics.vendors (tenant_id);
CREATE INDEX logistics_vendors_franchise_idx ON logistics.vendors (franchise_id) WHERE franchise_id IS NOT NULL;

ALTER TABLE logistics.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_vendors_tenant_select ON logistics.vendors
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_vendors_updated_at
  BEFORE UPDATE ON logistics.vendors
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.vendors TO authenticated;
GRANT ALL    ON logistics.vendors TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 9. logistics.container_sizes
-- ══════════════════════════════════════════════════════════════════════
-- Global reference data, no tenant_id; public-readable RLS.

CREATE TABLE logistics.container_sizes (LIKE public.container_sizes INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.container_sizes ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.container_sizes IS
  'Phase 5 Logistics Step 1 — mirror of public.container_sizes. Global reference data; public-readable RLS.';

CREATE INDEX logistics_container_sizes_type_idx ON logistics.container_sizes (container_type_id) WHERE container_type_id IS NOT NULL;

ALTER TABLE logistics.container_sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_container_sizes_authenticated_select ON logistics.container_sizes
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_logistics_container_sizes_updated_at
  BEFORE UPDATE ON logistics.container_sizes
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.container_sizes TO authenticated;
GRANT ALL    ON logistics.container_sizes TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 10. logistics.container_types
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE logistics.container_types (LIKE public.container_types INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE logistics.container_types ADD PRIMARY KEY (id);

COMMENT ON TABLE logistics.container_types IS
  'Phase 5 Logistics Step 1 — mirror of public.container_types. Categorical code (DRY/REEFER/FLAT/…); parent of container_sizes via container_type_id.';

CREATE INDEX logistics_container_types_tenant_idx ON logistics.container_types (tenant_id);

ALTER TABLE logistics.container_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY logistics_container_types_tenant_select ON logistics.container_types
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_logistics_container_types_updated_at
  BEFORE UPDATE ON logistics.container_types
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON logistics.container_types TO authenticated;
GRANT ALL    ON logistics.container_types TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 11. Backfill
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO logistics.shipments                     SELECT * FROM public.shipments                     ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.shipment_items                SELECT * FROM public.shipment_items                ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.shipment_cargo_configurations SELECT * FROM public.shipment_cargo_configurations ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.bookings                      SELECT * FROM public.bookings                      ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.booking_agents                SELECT * FROM public.booking_agents                ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.carriers                      SELECT * FROM public.carriers                      ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.carrier_rates                 SELECT * FROM public.carrier_rates                 ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.vendors                       SELECT * FROM public.vendors                       ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.container_sizes               SELECT * FROM public.container_sizes               ON CONFLICT (id) DO NOTHING;
INSERT INTO logistics.container_types               SELECT * FROM public.container_types               ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 12. Dual-write triggers (DELETE+INSERT pattern from Phase 4/5)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION logistics.dual_write_from_shipments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.shipments WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.shipments SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.shipments WHERE id = NEW.id; INSERT INTO logistics.shipments SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_shipments (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_shipments_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.shipments FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_shipments();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_shipment_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.shipment_items WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.shipment_items SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.shipment_items WHERE id = NEW.id; INSERT INTO logistics.shipment_items SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_shipment_items (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_shipment_items_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.shipment_items FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_shipment_items();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_shipment_cargo_configurations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.shipment_cargo_configurations WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.shipment_cargo_configurations SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.shipment_cargo_configurations WHERE id = NEW.id; INSERT INTO logistics.shipment_cargo_configurations SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_shipment_cargo_configurations (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_shipment_cargo_configs_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.shipment_cargo_configurations FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_shipment_cargo_configurations();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_bookings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.bookings WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.bookings SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.bookings WHERE id = NEW.id; INSERT INTO logistics.bookings SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_bookings (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_bookings_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_bookings();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_booking_agents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.booking_agents WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.booking_agents SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.booking_agents WHERE id = NEW.id; INSERT INTO logistics.booking_agents SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_booking_agents (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_booking_agents_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.booking_agents FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_booking_agents();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_carriers()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.carriers WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.carriers SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.carriers WHERE id = NEW.id; INSERT INTO logistics.carriers SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_carriers (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_carriers_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.carriers FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_carriers();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_carrier_rates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.carrier_rates WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.carrier_rates SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.carrier_rates WHERE id = NEW.id; INSERT INTO logistics.carrier_rates SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_carrier_rates (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_carrier_rates_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.carrier_rates FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_carrier_rates();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_vendors()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.vendors WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.vendors SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.vendors WHERE id = NEW.id; INSERT INTO logistics.vendors SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_vendors (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_vendors_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.vendors FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_vendors();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_container_sizes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.container_sizes WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.container_sizes SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.container_sizes WHERE id = NEW.id; INSERT INTO logistics.container_sizes SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_container_sizes (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_container_sizes_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.container_sizes FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_container_sizes();

CREATE OR REPLACE FUNCTION logistics.dual_write_from_container_types()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = logistics, pg_catalog AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN DELETE FROM logistics.container_types WHERE id = OLD.id;
  ELSIF TG_OP = 'INSERT' THEN INSERT INTO logistics.container_types SELECT NEW.* ON CONFLICT (id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN DELETE FROM logistics.container_types WHERE id = NEW.id; INSERT INTO logistics.container_types SELECT NEW.*;
  END IF;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dual_write_from_container_types (op=%, id=%) failed: %', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_container_types_dual_write_to_logistics AFTER INSERT OR UPDATE OR DELETE ON public.container_types FOR EACH ROW EXECUTE FUNCTION logistics.dual_write_from_container_types();

-- ══════════════════════════════════════════════════════════════════════
-- 13. Drift monitor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION logistics.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = logistics, public, pg_catalog AS $$
  SELECT 'shipments_minus_logistics_shipments', (SELECT count(*) FROM public.shipments) - (SELECT count(*) FROM logistics.shipments)
  UNION ALL
  SELECT 'shipment_items_minus_logistics_shipment_items', (SELECT count(*) FROM public.shipment_items) - (SELECT count(*) FROM logistics.shipment_items)
  UNION ALL
  SELECT 'shipment_cargo_configurations_minus_logistics', (SELECT count(*) FROM public.shipment_cargo_configurations) - (SELECT count(*) FROM logistics.shipment_cargo_configurations)
  UNION ALL
  SELECT 'bookings_minus_logistics_bookings', (SELECT count(*) FROM public.bookings) - (SELECT count(*) FROM logistics.bookings)
  UNION ALL
  SELECT 'booking_agents_minus_logistics_booking_agents', (SELECT count(*) FROM public.booking_agents) - (SELECT count(*) FROM logistics.booking_agents)
  UNION ALL
  SELECT 'carriers_minus_logistics_carriers', (SELECT count(*) FROM public.carriers) - (SELECT count(*) FROM logistics.carriers)
  UNION ALL
  SELECT 'carrier_rates_minus_logistics_carrier_rates', (SELECT count(*) FROM public.carrier_rates) - (SELECT count(*) FROM logistics.carrier_rates)
  UNION ALL
  SELECT 'vendors_minus_logistics_vendors', (SELECT count(*) FROM public.vendors) - (SELECT count(*) FROM logistics.vendors)
  UNION ALL
  SELECT 'container_sizes_minus_logistics_container_sizes', (SELECT count(*) FROM public.container_sizes) - (SELECT count(*) FROM logistics.container_sizes)
  UNION ALL
  SELECT 'container_types_minus_logistics_container_types', (SELECT count(*) FROM public.container_types) - (SELECT count(*) FROM logistics.container_types);
$$;
COMMENT ON FUNCTION logistics.base_drift_check IS 'Phase 5 Logistics Step 1 drift monitor. All ten deltas should remain 0.';
GRANT EXECUTE ON FUNCTION logistics.base_drift_check TO service_role;
