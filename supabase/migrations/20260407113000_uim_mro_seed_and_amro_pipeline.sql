-- DB-VERIFICATION: uim-mro-seeding-and-amro-pipeline-overlap-reviewed
-- DB-ARCH-APPROVAL: pending-architecture-board-review
-- EXTENSION-ASSESSMENT:
--   Reuses UIM core tables (`uim_catalog_items`, `uim_inventory_items`, `uim_inventory_reservations`,
--   `uim_inventory_ledger`, `uim_inventory_projection_snapshots`) and adds additive tables for
--   MRO profile enrichment and AMRO integration queue/audit reliability.
-- EXTENSION-RATIONALE:
--   Existing UIM schema lacks dedicated MRO attributes (ATA hierarchy, shelf-life, condition/certification state)
--   and durable cross-module sync job telemetry required for independent UIM + integrated AMRO operation.

BEGIN;

CREATE TABLE IF NOT EXISTS public.uim_mro_item_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  catalog_item_id uuid NOT NULL REFERENCES public.uim_catalog_items(id) ON DELETE CASCADE,
  maintenance_category text NOT NULL CHECK (maintenance_category IN ('rotable', 'consumable', 'tooling', 'equipment', 'emergency-spare')),
  ata_chapter_code varchar(4) NOT NULL,
  ata_sub_chapter_code varchar(4) NOT NULL,
  ata_section_code varchar(4) NOT NULL,
  manufacturer_name text NOT NULL,
  manufacturer_code text NOT NULL,
  shelf_life_days integer CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
  condition_code text NOT NULL DEFAULT 'SV'
    CHECK (condition_code IN ('SV', 'AR', 'INSP', 'OH', 'SCRAP', 'QUAR')),
  storage_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  certification_status text NOT NULL DEFAULT 'valid'
    CHECK (certification_status IN ('valid', 'expiring', 'expired', 'pending')),
  certification_reference text,
  hazardous_material boolean NOT NULL DEFAULT false,
  calibrated_tool boolean NOT NULL DEFAULT false,
  calibration_due_date date,
  regulatory_compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
  aog_priority boolean NOT NULL DEFAULT false,
  traceability jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_uim_mro_profile_catalog UNIQUE (tenant_id, catalog_item_id)
);

CREATE INDEX IF NOT EXISTS idx_uim_mro_profile_ata
  ON public.uim_mro_item_profiles (tenant_id, ata_chapter_code, ata_sub_chapter_code, ata_section_code);
CREATE INDEX IF NOT EXISTS idx_uim_mro_profile_aog
  ON public.uim_mro_item_profiles (tenant_id, aog_priority, maintenance_category);
CREATE INDEX IF NOT EXISTS idx_uim_mro_profile_calibration
  ON public.uim_mro_item_profiles (tenant_id, calibration_due_date)
  WHERE calibration_due_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.uim_amro_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (job_type IN ('availability_query', 'batch_sync', 'reservation', 'consume', 'return', 'reconciliation')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'retrying', 'failed')),
  idempotency_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_retry_at timestamptz,
  last_error text,
  correlation_id text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT uq_uim_amro_sync_jobs_idempotency UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_uim_amro_sync_jobs_status
  ON public.uim_amro_sync_jobs (tenant_id, status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_uim_amro_sync_jobs_retry
  ON public.uim_amro_sync_jobs (tenant_id, next_retry_at)
  WHERE status IN ('queued', 'retrying');

CREATE TABLE IF NOT EXISTS public.uim_amro_sync_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.uim_amro_sync_jobs(id) ON DELETE SET NULL,
  action text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('uim_to_amro', 'amro_to_uim')),
  inventory_item_id uuid REFERENCES public.uim_inventory_items(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.uim_inventory_reservations(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'processed', 'replayed', 'failed')),
  error_message text,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_uim_amro_sync_audit_created
  ON public.uim_amro_sync_audit (tenant_id, created_at DESC);

ALTER TABLE public.uim_mro_item_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uim_amro_sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uim_amro_sync_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_mro_item_profiles;
CREATE POLICY uim_platform_admin_access
  ON public.uim_mro_item_profiles
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_mro_item_profiles;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_mro_item_profiles
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_amro_sync_jobs;
CREATE POLICY uim_platform_admin_access
  ON public.uim_amro_sync_jobs
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_amro_sync_jobs;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_amro_sync_jobs
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DROP POLICY IF EXISTS uim_platform_admin_access ON public.uim_amro_sync_audit;
CREATE POLICY uim_platform_admin_access
  ON public.uim_amro_sync_audit
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS uim_tenant_scope_access ON public.uim_amro_sync_audit;
CREATE POLICY uim_tenant_scope_access
  ON public.uim_amro_sync_audit
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

DO $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_actor uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_actor FROM auth.users ORDER BY created_at ASC LIMIT 1;

  WITH generated_catalog AS (
    SELECT
      gs AS idx,
      format('UIM-MRO-%s', lpad(gs::text, 6, '0')) AS sku,
      format('MRO-PN-%s', lpad((700000 + gs)::text, 8, '0')) AS part_number,
      format('MRO Component %s', gs) AS title,
      CASE gs % 4
        WHEN 0 THEN 'rotable'
        WHEN 1 THEN 'consumable'
        WHEN 2 THEN 'tooling'
        ELSE 'equipment'
      END AS category,
      CASE WHEN gs % 3 = 0 THEN true ELSE false END AS is_serialized,
      (ARRAY['CFM', 'Honeywell', 'Collins', 'Safran', 'Parker', 'Liebherr'])[1 + (gs % 6)] AS manufacturer,
      (ARRAY['21', '24', '27', '28', '29', '32', '49', '52', '71'])[1 + (gs % 9)] AS ata_chapter_code,
      lpad(((gs % 10) + 1)::text, 2, '0') AS ata_sub_chapter_code,
      lpad(((gs % 7) + 1)::text, 2, '0') AS ata_section_code
    FROM generate_series(1, 800) gs
  )
  INSERT INTO public.uim_catalog_items (
    tenant_id, franchise_id, sku, part_number, title, category, unit_of_measure, is_serialized, attributes, created_by, updated_by
  )
  SELECT
    v_tenant_id,
    v_franchise_id,
    c.sku,
    c.part_number,
    c.title,
    c.category,
    'EA',
    c.is_serialized,
    jsonb_build_object(
      'manufacturer_name', c.manufacturer,
      'maintenance_category', c.category,
      'ata_chapter_code', c.ata_chapter_code,
      'ata_sub_chapter_code', c.ata_sub_chapter_code,
      'ata_section_code', c.ata_section_code,
      'seed_batch', 'UIM-MRO-800-v1'
    ),
    v_actor,
    v_actor
  FROM generated_catalog c
  ON CONFLICT (tenant_id, sku) DO UPDATE SET
    part_number = EXCLUDED.part_number,
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    is_serialized = EXCLUDED.is_serialized,
    attributes = EXCLUDED.attributes,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

  WITH base_inventory AS (
    SELECT
      i.id AS catalog_item_id,
      i.tenant_id,
      i.franchise_id,
      row_number() OVER (ORDER BY i.id) AS rn,
      i.category,
      i.part_number
    FROM public.uim_catalog_items i
    WHERE i.tenant_id = v_tenant_id
      AND i.sku LIKE 'UIM-MRO-%'
  )
  INSERT INTO public.uim_inventory_items (
    tenant_id, franchise_id, catalog_item_id, serial_number, batch_lot_number, quantity, status, location_type, metadata, created_by, updated_by
  )
  SELECT
    b.tenant_id,
    b.franchise_id,
    b.catalog_item_id,
    format('SER-%s', lpad((900000 + b.rn)::text, 8, '0')),
    format('LOT-%s', lpad((600000 + b.rn)::text, 8, '0')),
    CASE WHEN b.category = 'consumable' THEN (10 + (b.rn % 80))::numeric ELSE 1::numeric END,
    CASE WHEN b.rn % 25 = 0 THEN 'in_transit' ELSE 'available' END,
    'warehouse',
    jsonb_build_object(
      'storage_zone', CASE WHEN b.rn % 3 = 0 THEN 'hazmat' ELSE 'general' END,
      'temperature_band', CASE WHEN b.rn % 4 = 0 THEN '2-8C' ELSE 'ambient' END,
      'seed_batch', 'UIM-MRO-800-v1'
    ),
    v_actor,
    v_actor
  FROM base_inventory b
  ON CONFLICT (tenant_id, serial_number) DO UPDATE SET
    batch_lot_number = EXCLUDED.batch_lot_number,
    quantity = EXCLUDED.quantity,
    status = EXCLUDED.status,
    location_type = EXCLUDED.location_type,
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

  WITH profile_source AS (
    SELECT
      c.id AS catalog_item_id,
      c.tenant_id,
      c.franchise_id,
      c.category,
      c.part_number,
      row_number() OVER (ORDER BY c.id) AS rn
    FROM public.uim_catalog_items c
    WHERE c.tenant_id = v_tenant_id
      AND c.sku LIKE 'UIM-MRO-%'
  )
  INSERT INTO public.uim_mro_item_profiles (
    tenant_id, franchise_id, catalog_item_id, maintenance_category, ata_chapter_code, ata_sub_chapter_code, ata_section_code,
    manufacturer_name, manufacturer_code, shelf_life_days, condition_code, storage_requirements, certification_status, certification_reference,
    hazardous_material, calibrated_tool, calibration_due_date, regulatory_compliance, aog_priority, traceability, metadata, created_by, updated_by
  )
  SELECT
    p.tenant_id,
    p.franchise_id,
    p.catalog_item_id,
    CASE WHEN p.rn % 12 = 0 THEN 'emergency-spare' ELSE p.category END,
    (ARRAY['21', '24', '27', '28', '29', '32', '49', '52', '71'])[1 + (p.rn % 9)],
    lpad(((p.rn % 10) + 1)::text, 2, '0'),
    lpad(((p.rn % 7) + 1)::text, 2, '0'),
    (ARRAY['CFM', 'Honeywell', 'Collins', 'Safran', 'Parker', 'Liebherr'])[1 + (p.rn % 6)],
    format('MFG-%s', lpad((100 + (p.rn % 899))::text, 4, '0')),
    CASE WHEN p.category = 'consumable' THEN 365 + (p.rn % 200) ELSE NULL END,
    CASE WHEN p.rn % 20 = 0 THEN 'INSP' ELSE 'SV' END,
    jsonb_build_object(
      'temperature', CASE WHEN p.category = 'consumable' THEN '2-8C' ELSE 'ambient' END,
      'humidity_max_percent', 60,
      'hazmat_zone_required', (p.rn % 9 = 0)
    ),
    CASE WHEN p.rn % 18 = 0 THEN 'expiring' ELSE 'valid' END,
    format('CERT-UIM-%s', lpad((400000 + p.rn)::text, 8, '0')),
    (p.rn % 9 = 0),
    (p.category IN ('tooling', 'equipment')),
    CASE WHEN p.category IN ('tooling', 'equipment') THEN current_date + (((p.rn % 180)::int) + 30) ELSE NULL END,
    jsonb_build_object('faa_14_cfr_43', true, 'easa_part_145', true),
    (p.rn % 12 = 0),
    jsonb_build_object(
      'lot_number', format('LOT-%s', lpad((600000 + p.rn)::text, 8, '0')),
      'serial_reference', format('SER-%s', lpad((900000 + p.rn)::text, 8, '0'))
    ),
    jsonb_build_object('seed_batch', 'UIM-MRO-800-v1'),
    v_actor,
    v_actor
  FROM profile_source p
  ON CONFLICT (tenant_id, catalog_item_id) DO UPDATE SET
    maintenance_category = EXCLUDED.maintenance_category,
    ata_chapter_code = EXCLUDED.ata_chapter_code,
    ata_sub_chapter_code = EXCLUDED.ata_sub_chapter_code,
    ata_section_code = EXCLUDED.ata_section_code,
    manufacturer_name = EXCLUDED.manufacturer_name,
    manufacturer_code = EXCLUDED.manufacturer_code,
    shelf_life_days = EXCLUDED.shelf_life_days,
    condition_code = EXCLUDED.condition_code,
    storage_requirements = EXCLUDED.storage_requirements,
    certification_status = EXCLUDED.certification_status,
    certification_reference = EXCLUDED.certification_reference,
    hazardous_material = EXCLUDED.hazardous_material,
    calibrated_tool = EXCLUDED.calibrated_tool,
    calibration_due_date = EXCLUDED.calibration_due_date,
    regulatory_compliance = EXCLUDED.regulatory_compliance,
    aog_priority = EXCLUDED.aog_priority,
    traceability = EXCLUDED.traceability,
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

  INSERT INTO public.uim_inventory_projection_snapshots (
    tenant_id, franchise_id, inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity,
    last_ledger_at, replay_version
  )
  SELECT
    ii.tenant_id,
    ii.franchise_id,
    ii.id,
    GREATEST(0, ii.quantity),
    0,
    0,
    now(),
    1
  FROM public.uim_inventory_items ii
  JOIN public.uim_catalog_items ci ON ci.id = ii.catalog_item_id
  WHERE ii.tenant_id = v_tenant_id
    AND ci.sku LIKE 'UIM-MRO-%'
  ON CONFLICT (tenant_id, inventory_item_id) DO UPDATE SET
    projected_available_quantity = EXCLUDED.projected_available_quantity,
    updated_at = now();
END
$$;

COMMIT;
