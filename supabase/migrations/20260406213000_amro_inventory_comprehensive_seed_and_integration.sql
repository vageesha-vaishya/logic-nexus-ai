BEGIN;

ALTER TABLE public.parts_inventory
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'part'
    CHECK (item_type IN ('part', 'consumable', 'tool', 'equipment')),
  ADD COLUMN IF NOT EXISTS ata_chapter text,
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS batch_number text,
  ADD COLUMN IF NOT EXISTS certification_type text,
  ADD COLUMN IF NOT EXISTS certification_reference text,
  ADD COLUMN IF NOT EXISTS certification_expiry_date date,
  ADD COLUMN IF NOT EXISTS shelf_life_days integer CHECK (shelf_life_days IS NULL OR shelf_life_days >= 0),
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS storage_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS barcode_value text,
  ADD COLUMN IF NOT EXISTS rfid_tag text,
  ADD COLUMN IF NOT EXISTS regulatory_compliance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS criticality text NOT NULL DEFAULT 'normal'
    CHECK (criticality IN ('critical', 'high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS min_serviceable_qty integer NOT NULL DEFAULT 0 CHECK (min_serviceable_qty >= 0),
  ADD COLUMN IF NOT EXISTS traceability_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_item_type
  ON public.parts_inventory (tenant_id, item_type);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_ata_chapter
  ON public.parts_inventory (tenant_id, ata_chapter);
CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_expiry_date
  ON public.parts_inventory (tenant_id, expiry_date)
  WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_parts_inventory_tenant_reorder_gap
  ON public.parts_inventory (tenant_id, reorder_level, quantity_on_hand);

CREATE TABLE IF NOT EXISTS public.amro_inventory_reorder_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  reorder_reason text NOT NULL CHECK (reorder_reason IN ('low_stock', 'critical_shortage', 'expiry_replacement', 'manual')),
  reorder_quantity integer NOT NULL CHECK (reorder_quantity > 0),
  target_eta date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'ordered', 'received', 'cancelled')),
  procurement_reference text,
  source_trigger text NOT NULL DEFAULT 'automation',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_amro_inventory_reorder_queue_tenant_status
  ON public.amro_inventory_reorder_queue (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.amro_inventory_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  inventory_id uuid REFERENCES public.parts_inventory(id) ON DELETE SET NULL,
  scan_mode text NOT NULL CHECK (scan_mode IN ('barcode', 'rfid', 'manual')),
  scan_code text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('receive', 'issue', 'transfer', 'audit', 'reserve', 'release')),
  scanner_device_id text,
  from_location text,
  to_location text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'validated', 'rejected')),
  validation_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_amro_inventory_scan_events_tenant_scanned
  ON public.amro_inventory_scan_events (tenant_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS public.amro_inventory_work_order_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('reserve', 'consume', 'release', 'return', 'reconcile')),
  quantity integer NOT NULL CHECK (quantity > 0),
  posting_status text NOT NULL DEFAULT 'posted'
    CHECK (posting_status IN ('posted', 'pending', 'failed')),
  posting_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_amro_inventory_work_order_links_tenant_work_order
  ON public.amro_inventory_work_order_links (tenant_id, work_order_id, created_at DESC);

CREATE OR REPLACE VIEW public.amro_inventory_health_overview AS
SELECT
  p.tenant_id,
  p.franchise_id,
  COUNT(*) AS total_items,
  COUNT(*) FILTER (WHERE p.quantity_on_hand <= p.reorder_level) AS low_stock_items,
  COUNT(*) FILTER (WHERE p.quantity_available <= p.min_serviceable_qty) AS serviceability_risk_items,
  COUNT(*) FILTER (
    WHERE p.expiry_date IS NOT NULL
      AND p.expiry_date <= (CURRENT_DATE + INTERVAL '90 days')
  ) AS expiring_next_90d,
  COUNT(*) FILTER (WHERE p.criticality = 'critical') AS critical_items
FROM public.parts_inventory p
GROUP BY p.tenant_id, p.franchise_id;

DO $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_actor uuid;
BEGIN
  SELECT id
  INTO v_tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_actor FROM auth.users ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.suppliers (
    tenant_id, franchise_id, supplier_code, name, contact_name, email, phone, lead_time_days, rating, is_active, metadata
  )
  SELECT
    v_tenant_id,
    v_franchise_id,
    format('AMRO-SUP-%s', lpad(gs::text, 3, '0')),
    format('AMRO Certified Supplier %s', gs),
    format('Supplier Contact %s', gs),
    format('supplier%s@amro.example', gs),
    format('+971-4-900-%s', lpad((100 + gs)::text, 4, '0')),
    7 + (gs % 15),
    (3.5 + ((gs % 15)::numeric / 10.0)),
    true,
    jsonb_build_object(
      'faa_approved', true,
      'easa_approved', true,
      'quality_score', 85 + (gs % 10),
      'vendor_tier', CASE WHEN gs <= 3 THEN 'strategic' ELSE 'standard' END
    )
  FROM generate_series(1, 10) AS gs
  ON CONFLICT (tenant_id, supplier_code) DO UPDATE SET
    name = EXCLUDED.name,
    contact_name = EXCLUDED.contact_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    lead_time_days = EXCLUDED.lead_time_days,
    rating = EXCLUDED.rating,
    is_active = EXCLUDED.is_active,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  WITH supplier_pool AS (
    SELECT id, row_number() OVER (ORDER BY supplier_code) AS rn
    FROM public.suppliers
    WHERE tenant_id = v_tenant_id
    ORDER BY supplier_code
    LIMIT 10
  ),
  generated_items AS (
    SELECT
      gs AS idx,
      format('AMRO-PN-%s', lpad(gs::text, 6, '0')) AS part_number,
      CASE WHEN gs % 4 = 0 THEN format('AMRO-SN-%s', lpad(gs::text, 8, '0')) ELSE NULL END AS serial_number,
      format(
        'Aircraft %s item #%s',
        CASE
          WHEN gs % 4 = 0 THEN 'part'
          WHEN gs % 4 = 1 THEN 'consumable'
          WHEN gs % 4 = 2 THEN 'tool'
          ELSE 'equipment'
        END,
        gs
      ) AS description,
      format('WH-%s-%s', chr(65 + (gs % 5)), lpad((1 + (gs % 40))::text, 3, '0')) AS warehouse_location,
      10 + (gs % 120) AS quantity_on_hand,
      (gs % 6) AS quantity_reserved,
      8 + (gs % 20) AS reorder_level,
      20 + (gs % 50) AS reorder_quantity,
      (40 + (gs % 700))::numeric(12, 2) AS unit_cost,
      CASE gs % 4
        WHEN 0 THEN 'part'
        WHEN 1 THEN 'consumable'
        WHEN 2 THEN 'tool'
        ELSE 'equipment'
      END AS item_type,
      (ARRAY['21', '24', '27', '28', '29', '32', '49', '52', '71'])[1 + (gs % 9)] AS ata_chapter,
      format('LOT-%s', lpad((10000 + gs)::text, 8, '0')) AS lot_number,
      format('BATCH-%s', lpad((20000 + gs)::text, 8, '0')) AS batch_number,
      CASE WHEN gs % 5 IN (0, 1, 2) THEN 'FAA-8130-3' ELSE 'EASA-Form-1' END AS certification_type,
      format('CERT-%s', lpad((30000 + gs)::text, 8, '0')) AS certification_reference,
      (CURRENT_DATE + ((gs % 480) + 180))::date AS certification_expiry_date,
      180 + (gs % 365) AS shelf_life_days,
      (CURRENT_DATE + ((gs % 365) + 60))::date AS expiry_date,
      format('BAR-%s', lpad((500000 + gs)::text, 10, '0')) AS barcode_value,
      format('RFID-%s', lpad((700000 + gs)::text, 10, '0')) AS rfid_tag,
      CASE
        WHEN gs % 10 = 0 THEN 'critical'
        WHEN gs % 10 IN (1, 2, 3) THEN 'high'
        WHEN gs % 10 IN (4, 5, 6, 7) THEN 'normal'
        ELSE 'low'
      END AS criticality,
      2 + (gs % 10) AS min_serviceable_qty,
      (1 + (gs % 10)) AS supplier_rank
    FROM generate_series(1, 750) AS gs
  )
  INSERT INTO public.parts_inventory (
    tenant_id,
    franchise_id,
    part_number,
    serial_number,
    description,
    supplier_id,
    warehouse_location,
    quantity_on_hand,
    quantity_reserved,
    reorder_level,
    reorder_quantity,
    unit_cost,
    currency,
    status,
    last_movement_at,
    item_type,
    ata_chapter,
    lot_number,
    batch_number,
    certification_type,
    certification_reference,
    certification_expiry_date,
    shelf_life_days,
    expiry_date,
    storage_requirements,
    barcode_value,
    rfid_tag,
    regulatory_compliance,
    criticality,
    min_serviceable_qty,
    traceability_data,
    metadata
  )
  SELECT
    v_tenant_id,
    v_franchise_id,
    g.part_number,
    g.serial_number,
    g.description,
    sp.id,
    g.warehouse_location,
    g.quantity_on_hand,
    LEAST(g.quantity_reserved, g.quantity_on_hand),
    g.reorder_level,
    g.reorder_quantity,
    g.unit_cost,
    'USD',
    CASE
      WHEN g.quantity_on_hand <= g.reorder_level THEN 'low_stock'
      WHEN g.quantity_on_hand = 0 THEN 'reserved'
      ELSE 'available'
    END,
    now() - ((g.idx % 30) || ' days')::interval,
    g.item_type,
    g.ata_chapter,
    g.lot_number,
    g.batch_number,
    g.certification_type,
    g.certification_reference,
    g.certification_expiry_date,
    g.shelf_life_days,
    g.expiry_date,
    jsonb_build_object(
      'temperature_range_c', CASE WHEN g.item_type = 'consumable' THEN '-5..25' ELSE '15..35' END,
      'humidity_percent_max', 65,
      'security_zone', CASE WHEN g.criticality IN ('critical', 'high') THEN 'controlled' ELSE 'general' END
    ),
    g.barcode_value,
    g.rfid_tag,
    jsonb_build_object(
      'faa', jsonb_build_object('approved', true, 'chapter', g.ata_chapter),
      'easa', jsonb_build_object('approved', true, 'traceability_required', true),
      'ata_chapter', g.ata_chapter
    ),
    g.criticality,
    g.min_serviceable_qty,
    jsonb_build_object(
      'lot_tracking', g.lot_number,
      'batch_tracking', g.batch_number,
      'serial_tracking', g.serial_number,
      'source', 'comprehensive-seed-20260406213000'
    ),
    jsonb_build_object(
      'seed_batch', 'AMRO-COMP-750',
      'category', g.item_type,
      'supplier_rank', g.supplier_rank
    )
  FROM generated_items g
  LEFT JOIN supplier_pool sp
    ON sp.rn = g.supplier_rank
  ON CONFLICT (tenant_id, part_number, COALESCE(serial_number, ''), warehouse_location)
  DO UPDATE SET
    description = EXCLUDED.description,
    supplier_id = EXCLUDED.supplier_id,
    quantity_on_hand = EXCLUDED.quantity_on_hand,
    quantity_reserved = EXCLUDED.quantity_reserved,
    reorder_level = EXCLUDED.reorder_level,
    reorder_quantity = EXCLUDED.reorder_quantity,
    unit_cost = EXCLUDED.unit_cost,
    status = EXCLUDED.status,
    last_movement_at = EXCLUDED.last_movement_at,
    item_type = EXCLUDED.item_type,
    ata_chapter = EXCLUDED.ata_chapter,
    lot_number = EXCLUDED.lot_number,
    batch_number = EXCLUDED.batch_number,
    certification_type = EXCLUDED.certification_type,
    certification_reference = EXCLUDED.certification_reference,
    certification_expiry_date = EXCLUDED.certification_expiry_date,
    shelf_life_days = EXCLUDED.shelf_life_days,
    expiry_date = EXCLUDED.expiry_date,
    storage_requirements = EXCLUDED.storage_requirements,
    barcode_value = EXCLUDED.barcode_value,
    rfid_tag = EXCLUDED.rfid_tag,
    regulatory_compliance = EXCLUDED.regulatory_compliance,
    criticality = EXCLUDED.criticality,
    min_serviceable_qty = EXCLUDED.min_serviceable_qty,
    traceability_data = EXCLUDED.traceability_data,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.stock_movements (
    tenant_id, franchise_id, inventory_id, movement_type, quantity, from_location, to_location, reference_type, moved_by, notes
  )
  SELECT
    v_tenant_id,
    v_franchise_id,
    p.id,
    'receipt',
    GREATEST(1, LEAST(25, p.quantity_on_hand)),
    NULL,
    p.warehouse_location,
    'seed_receipt',
    v_actor,
    'Initial AMRO comprehensive seed receipt'
  FROM public.parts_inventory p
  WHERE p.tenant_id = v_tenant_id
    AND COALESCE(p.metadata->>'seed_batch', '') = 'AMRO-COMP-750'
    AND NOT EXISTS (
      SELECT 1
      FROM public.stock_movements sm
      WHERE sm.tenant_id = v_tenant_id
        AND sm.inventory_id = p.id
        AND sm.reference_type = 'seed_receipt'
    );

  INSERT INTO public.reservations (
    tenant_id, franchise_id, inventory_id, reserved_quantity, status, reserved_by, expires_at
  )
  SELECT
    v_tenant_id,
    v_franchise_id,
    p.id,
    LEAST(3, GREATEST(1, p.quantity_available)),
    'active',
    v_actor,
    now() + interval '14 days'
  FROM public.parts_inventory p
  WHERE p.tenant_id = v_tenant_id
    AND p.criticality IN ('critical', 'high')
    AND p.quantity_available > 0
    AND COALESCE(p.metadata->>'seed_batch', '') = 'AMRO-COMP-750'
    AND NOT EXISTS (
      SELECT 1
      FROM public.reservations r
      WHERE r.tenant_id = v_tenant_id
        AND r.inventory_id = p.id
        AND r.status = 'active'
    )
  ORDER BY p.criticality, p.updated_at DESC
  LIMIT 120;

  INSERT INTO public.amro_inventory_reorder_queue (
    tenant_id, franchise_id, inventory_id, supplier_id, reorder_reason, reorder_quantity, target_eta, status, source_trigger, metadata, created_by, updated_by
  )
  SELECT
    p.tenant_id,
    p.franchise_id,
    p.id,
    p.supplier_id,
    CASE WHEN p.criticality = 'critical' THEN 'critical_shortage' ELSE 'low_stock' END,
    GREATEST(p.reorder_quantity, 5),
    current_date + interval '10 days',
    'pending',
    'automation',
    jsonb_build_object('rule', 'auto_reorder_on_threshold', 'seed_batch', 'AMRO-COMP-750'),
    v_actor,
    v_actor
  FROM public.parts_inventory p
  WHERE p.tenant_id = v_tenant_id
    AND p.quantity_on_hand <= p.reorder_level
    AND COALESCE(p.metadata->>'seed_batch', '') = 'AMRO-COMP-750'
    AND NOT EXISTS (
      SELECT 1 FROM public.amro_inventory_reorder_queue rq
      WHERE rq.tenant_id = v_tenant_id
        AND rq.inventory_id = p.id
        AND rq.status IN ('pending', 'submitted', 'ordered')
    );
END;
$$;

COMMIT;
