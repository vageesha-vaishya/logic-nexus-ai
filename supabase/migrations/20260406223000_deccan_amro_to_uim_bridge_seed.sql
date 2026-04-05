BEGIN;

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
    RETURN;
  END IF;

  SELECT id
  INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_actor FROM auth.users ORDER BY created_at ASC LIMIT 1;

  WITH source_parts AS (
    SELECT
      p.id,
      p.tenant_id,
      COALESCE(p.franchise_id, v_franchise_id) AS franchise_id,
      p.part_number,
      p.serial_number,
      p.description,
      p.item_type,
      p.ata_chapter,
      p.quantity_on_hand,
      p.quantity_reserved,
      p.status,
      p.warehouse_location,
      p.lot_number,
      p.batch_number,
      p.certification_type,
      p.certification_reference,
      p.certification_expiry_date,
      p.shelf_life_days,
      p.expiry_date,
      p.storage_requirements,
      p.barcode_value,
      p.rfid_tag,
      p.regulatory_compliance,
      p.criticality,
      p.traceability_data,
      p.metadata,
      p.updated_at
    FROM public.parts_inventory p
    WHERE p.tenant_id = v_tenant_id
    ORDER BY p.updated_at DESC, p.part_number ASC
    LIMIT 1000
  )
  INSERT INTO public.uim_catalog_items (
    tenant_id,
    franchise_id,
    sku,
    part_number,
    title,
    category,
    unit_of_measure,
    is_serialized,
    attributes,
    created_by,
    updated_by
  )
  SELECT
    sp.tenant_id,
    sp.franchise_id,
    format('AMRO-%s', substr(replace(sp.id::text, '-', ''), 1, 20)) AS sku,
    sp.part_number,
    COALESCE(NULLIF(sp.description, ''), format('AMRO %s %s', COALESCE(sp.item_type, 'part'), sp.part_number)) AS title,
    upper(COALESCE(sp.item_type, 'part')),
    'pcs',
    (sp.serial_number IS NOT NULL),
    jsonb_build_object(
      'source_part_id', sp.id::text,
      'ata_chapter', sp.ata_chapter,
      'certification_type', sp.certification_type,
      'certification_reference', sp.certification_reference,
      'certification_expiry_date', sp.certification_expiry_date,
      'shelf_life_days', sp.shelf_life_days,
      'expiry_date', sp.expiry_date,
      'storage_requirements', COALESCE(sp.storage_requirements, '{}'::jsonb),
      'regulatory_compliance', COALESCE(sp.regulatory_compliance, '{}'::jsonb),
      'criticality', sp.criticality,
      'traceability_data', COALESCE(sp.traceability_data, '{}'::jsonb),
      'barcode_value', sp.barcode_value,
      'rfid_tag', sp.rfid_tag,
      'bridge_source', 'amro-parts-inventory'
    ),
    v_actor,
    v_actor
  FROM source_parts sp
  ON CONFLICT (tenant_id, sku) DO UPDATE SET
    franchise_id = EXCLUDED.franchise_id,
    part_number = EXCLUDED.part_number,
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    unit_of_measure = EXCLUDED.unit_of_measure,
    is_serialized = EXCLUDED.is_serialized,
    attributes = EXCLUDED.attributes,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  WITH source_parts AS (
    SELECT
      p.id,
      p.tenant_id,
      COALESCE(p.franchise_id, v_franchise_id) AS franchise_id,
      p.part_number,
      p.serial_number,
      p.item_type,
      p.quantity_on_hand,
      p.status,
      p.warehouse_location,
      p.lot_number,
      p.batch_number,
      p.expiry_date,
      p.metadata,
      p.updated_at
    FROM public.parts_inventory p
    WHERE p.tenant_id = v_tenant_id
    ORDER BY p.updated_at DESC, p.part_number ASC
    LIMIT 1000
  ),
  catalog_bridge AS (
    SELECT
      c.id AS catalog_item_id,
      c.tenant_id,
      c.franchise_id,
      c.part_number,
      c.attributes
    FROM public.uim_catalog_items c
    WHERE c.tenant_id = v_tenant_id
      AND c.deleted_at IS NULL
  )
  INSERT INTO public.uim_inventory_items (
    tenant_id,
    franchise_id,
    catalog_item_id,
    serial_number,
    batch_lot_number,
    quantity,
    status,
    location_type,
    location_id,
    metadata,
    created_by,
    updated_by
  )
  SELECT
    sp.tenant_id,
    sp.franchise_id,
    cb.catalog_item_id,
    COALESCE(sp.serial_number, format('AMRO-NONSR-%s', substr(replace(sp.id::text, '-', ''), 1, 20))) AS serial_number,
    COALESCE(NULLIF(sp.batch_number, ''), NULLIF(sp.lot_number, '')),
    GREATEST(0, sp.quantity_on_hand)::numeric(12,4),
    CASE
      WHEN lower(COALESCE(sp.status, '')) IN ('quarantined', 'quarantine') THEN 'quarantine'
      WHEN lower(COALESCE(sp.status, '')) = 'reserved' THEN 'reserved'
      WHEN lower(COALESCE(sp.status, '')) = 'unserviceable' THEN 'scrapped'
      WHEN lower(COALESCE(sp.status, '')) = 'in_transit' THEN 'in_transit'
      WHEN lower(COALESCE(sp.status, '')) = 'consumed' THEN 'consumed'
      ELSE 'available'
    END,
    'warehouse',
    NULL,
    jsonb_build_object(
      'source_part_id', sp.id::text,
      'part_number', sp.part_number,
      'warehouse_location', sp.warehouse_location,
      'item_type', sp.item_type,
      'expiry_date', sp.expiry_date,
      'seed_batch', COALESCE(sp.metadata->>'seed_batch', NULL),
      'bridge_source', 'amro-parts-inventory'
    ),
    v_actor,
    v_actor
  FROM source_parts sp
  JOIN catalog_bridge cb
    ON cb.tenant_id = sp.tenant_id
   AND cb.part_number = sp.part_number
   AND COALESCE(cb.attributes->>'source_part_id', '') = sp.id::text
  ON CONFLICT (tenant_id, serial_number) DO UPDATE SET
    franchise_id = EXCLUDED.franchise_id,
    catalog_item_id = EXCLUDED.catalog_item_id,
    batch_lot_number = EXCLUDED.batch_lot_number,
    quantity = EXCLUDED.quantity,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.uim_inventory_ledger (
    tenant_id,
    franchise_id,
    inventory_item_id,
    transaction_type,
    quantity_changed,
    referenced_module,
    referenced_record_id,
    metadata,
    performed_by
  )
  SELECT
    ii.tenant_id,
    ii.franchise_id,
    ii.id,
    'RECEIVE',
    ii.quantity,
    'AMRO_BRIDGE',
    (ii.metadata->>'source_part_id')::uuid,
    jsonb_build_object('source', 'amro-to-uim-bridge', 'seed', true),
    v_actor
  FROM public.uim_inventory_items ii
  WHERE ii.tenant_id = v_tenant_id
    AND COALESCE(ii.metadata->>'bridge_source', '') = 'amro-parts-inventory'
    AND NOT EXISTS (
      SELECT 1
      FROM public.uim_inventory_ledger l
      WHERE l.tenant_id = ii.tenant_id
        AND l.inventory_item_id = ii.id
        AND l.referenced_module = 'AMRO_BRIDGE'
        AND l.referenced_record_id = (ii.metadata->>'source_part_id')::uuid
    );

  IF to_regclass('public.uim_inventory_projection_snapshots') IS NOT NULL THEN
    INSERT INTO public.uim_inventory_projection_snapshots (
      tenant_id,
      franchise_id,
      inventory_item_id,
      projected_available_quantity,
      projected_reserved_quantity,
      projected_consumed_quantity,
      replay_version,
      last_ledger_at
    )
    SELECT
      ii.tenant_id,
      ii.franchise_id,
      ii.id,
      ii.quantity,
      0,
      0,
      1,
      now()
    FROM public.uim_inventory_items ii
    WHERE ii.tenant_id = v_tenant_id
      AND COALESCE(ii.metadata->>'bridge_source', '') = 'amro-parts-inventory'
    ON CONFLICT (tenant_id, inventory_item_id) DO UPDATE SET
      projected_available_quantity = EXCLUDED.projected_available_quantity,
      projected_reserved_quantity = EXCLUDED.projected_reserved_quantity,
      projected_consumed_quantity = EXCLUDED.projected_consumed_quantity,
      replay_version = GREATEST(public.uim_inventory_projection_snapshots.replay_version, EXCLUDED.replay_version),
      last_ledger_at = now(),
      updated_at = now();
  END IF;
END;
$$;

COMMIT;
