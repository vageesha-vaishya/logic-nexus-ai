-- Phase 5 Logistics conformance — carrier-as-party + vendor-as-party
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 5 line 1269
--
-- Every carrier and vendor becomes a core.parties row (party_type =
-- 'organization'). The original tables keep their primary keys; a new
-- party_id back-reference column links each row to the canonical
-- core.parties identity.
--
-- Row counts at backfill time:
--   - public.carriers   32 total / 13 with tenant_id → 13 parties created
--   - public.vendors   189 total / 189 with tenant_id → 189 parties created
--
-- The 19 carriers without tenant_id are global reference data (FedEx,
-- UPS, Maersk, etc.) and don't get parties rows — core.parties requires
-- tenant_id NOT NULL. If a global-parties registry decision lands later,
-- backfill those then. Their party_id stays NULL.
--
-- Pattern is the same as Phase 2 backfill from public.accounts/contacts:
-- deterministic ID? No — gen_random_uuid() is fine here because the
-- carrier/vendor table already has the stable id and party_id is new.
-- New writes pick up parties via the dual-write triggers.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Add party_id back-ref columns (public + logistics mirror)
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.carriers ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES core.parties(id) ON DELETE SET NULL;
ALTER TABLE public.vendors  ADD COLUMN IF NOT EXISTS party_id uuid REFERENCES core.parties(id) ON DELETE SET NULL;

-- logistics.* mirrors get the same column shape so the dual-write from
-- Logistics Step 1 keeps working without surprise.
ALTER TABLE logistics.carriers ADD COLUMN IF NOT EXISTS party_id uuid;
ALTER TABLE logistics.vendors  ADD COLUMN IF NOT EXISTS party_id uuid;

CREATE INDEX IF NOT EXISTS carriers_party_id_idx     ON public.carriers (party_id)    WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendors_party_id_idx      ON public.vendors  (party_id)    WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS logistics_carriers_party_idx ON logistics.carriers (party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS logistics_vendors_party_idx  ON logistics.vendors  (party_id) WHERE party_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- 2. Backfill: create core.parties rows for every carrier-with-tenant
-- ══════════════════════════════════════════════════════════════════════
--
-- Two-step: INSERT … RETURNING into a CTE so we can capture the new
-- party_id and back-link in the same transaction.

WITH inserted AS (
  INSERT INTO core.parties (id, tenant_id, party_type, display_name, legal_name, status, external_refs, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    c.tenant_id,
    'organization',
    COALESCE(c.carrier_name, c.name, c.scac_code, c.scac, 'Carrier ' || left(c.id::text, 8)),
    COALESCE(c.carrier_name, c.name),
    CASE WHEN c.is_active IS FALSE THEN 'archived' ELSE 'active' END,
    jsonb_build_object(
      'source', 'carriers',
      'carrier_id', c.id,
      'carrier_code', c.carrier_code,
      'scac', COALESCE(c.scac_code, c.scac),
      'iata', c.iata,
      'mc_dot', c.mc_dot
    ),
    COALESCE(c.created_at, now()),
    COALESCE(c.updated_at, now())
  FROM public.carriers c
  WHERE c.tenant_id IS NOT NULL
    AND c.party_id IS NULL
  RETURNING id, (external_refs->>'carrier_id')::uuid AS carrier_id
)
UPDATE public.carriers c
SET party_id = i.id
FROM inserted i
WHERE c.id = i.carrier_id;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Backfill: create core.parties rows for every vendor
-- ══════════════════════════════════════════════════════════════════════

WITH inserted AS (
  INSERT INTO core.parties (id, tenant_id, party_type, display_name, legal_name, status, external_refs, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    v.tenant_id,
    'organization',
    COALESCE(v.name, v.code, 'Vendor ' || left(v.id::text, 8)),
    v.name,
    CASE WHEN v.status = 'inactive' THEN 'archived' ELSE 'active' END,
    jsonb_build_object(
      'source', 'vendors',
      'vendor_id', v.id,
      'vendor_code', v.code,
      'vendor_type', v.type,
      'tax_id', v.tax_id,
      'onboarding_status', v.onboarding_status
    ),
    COALESCE(v.created_at, now()),
    COALESCE(v.updated_at, now())
  FROM public.vendors v
  WHERE v.tenant_id IS NOT NULL
    AND v.party_id IS NULL
  RETURNING id, (external_refs->>'vendor_id')::uuid AS vendor_id
)
UPDATE public.vendors v
SET party_id = i.id
FROM inserted i
WHERE v.id = i.vendor_id;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Sync the new party_id back into the logistics.* mirrors
-- ══════════════════════════════════════════════════════════════════════

UPDATE logistics.carriers lc SET party_id = c.party_id
FROM public.carriers c WHERE c.id = lc.id AND c.party_id IS NOT NULL;

UPDATE logistics.vendors lv SET party_id = v.party_id
FROM public.vendors v WHERE v.id = lv.id AND v.party_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- 5. Dual-write triggers: new carrier/vendor → new core.parties row
-- ══════════════════════════════════════════════════════════════════════
--
-- Only fires when tenant_id is set AND party_id is NULL (so manual
-- inserts that pre-populate party_id stay intact). Updates the source
-- row's party_id back-ref via NEW.party_id assignment — that's why
-- this is BEFORE INSERT, not AFTER.

CREATE OR REPLACE FUNCTION core.assign_party_to_carrier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_catalog AS $$
DECLARE
  new_party_id uuid;
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.party_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO core.parties (id, tenant_id, party_type, display_name, legal_name, status, external_refs, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.tenant_id,
    'organization',
    COALESCE(NEW.carrier_name, NEW.name, NEW.scac_code, NEW.scac, 'Carrier ' || left(NEW.id::text, 8)),
    COALESCE(NEW.carrier_name, NEW.name),
    CASE WHEN NEW.is_active IS FALSE THEN 'archived' ELSE 'active' END,
    jsonb_build_object('source','carriers','carrier_id',NEW.id,'carrier_code',NEW.carrier_code,'scac',COALESCE(NEW.scac_code,NEW.scac),'iata',NEW.iata,'mc_dot',NEW.mc_dot),
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  RETURNING id INTO new_party_id;
  NEW.party_id := new_party_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'assign_party_to_carrier (id=%) failed: %', NEW.id, SQLERRM;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_carriers_assign_party
  BEFORE INSERT ON public.carriers
  FOR EACH ROW EXECUTE FUNCTION core.assign_party_to_carrier();

CREATE OR REPLACE FUNCTION core.assign_party_to_vendor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = core, pg_catalog AS $$
DECLARE
  new_party_id uuid;
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.party_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO core.parties (id, tenant_id, party_type, display_name, legal_name, status, external_refs, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    NEW.tenant_id,
    'organization',
    COALESCE(NEW.name, NEW.code, 'Vendor ' || left(NEW.id::text, 8)),
    NEW.name,
    CASE WHEN NEW.status = 'inactive' THEN 'archived' ELSE 'active' END,
    jsonb_build_object('source','vendors','vendor_id',NEW.id,'vendor_code',NEW.code,'vendor_type',NEW.type,'tax_id',NEW.tax_id,'onboarding_status',NEW.onboarding_status),
    COALESCE(NEW.created_at, now()),
    COALESCE(NEW.updated_at, now())
  )
  RETURNING id INTO new_party_id;
  NEW.party_id := new_party_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'assign_party_to_vendor (id=%) failed: %', NEW.id, SQLERRM;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_vendors_assign_party
  BEFORE INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION core.assign_party_to_vendor();

-- ══════════════════════════════════════════════════════════════════════
-- 6. Drift monitor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.carrier_vendor_party_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, public, pg_catalog AS $$
  -- Every carrier WITH tenant_id should have party_id; delta = carriers-with-tenant minus carriers-with-party.
  SELECT 'carriers_with_tenant_minus_carriers_with_party',
         (SELECT count(*) FROM public.carriers WHERE tenant_id IS NOT NULL)
       - (SELECT count(*) FROM public.carriers WHERE party_id IS NOT NULL)
  UNION ALL
  SELECT 'vendors_with_tenant_minus_vendors_with_party',
         (SELECT count(*) FROM public.vendors WHERE tenant_id IS NOT NULL)
       - (SELECT count(*) FROM public.vendors WHERE party_id IS NOT NULL)
  UNION ALL
  -- Every carrier/vendor party_id should point to a real core.parties row.
  SELECT 'carriers_with_orphan_party_id',
         (SELECT count(*) FROM public.carriers c WHERE c.party_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM core.parties p WHERE p.id = c.party_id))
  UNION ALL
  SELECT 'vendors_with_orphan_party_id',
         (SELECT count(*) FROM public.vendors v WHERE v.party_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM core.parties p WHERE p.id = v.party_id));
$$;
COMMENT ON FUNCTION core.carrier_vendor_party_drift_check IS
  'Phase 5 carrier-as-party + vendor-as-party drift monitor. All four deltas should remain 0.';
GRANT EXECUTE ON FUNCTION core.carrier_vendor_party_drift_check TO service_role;
