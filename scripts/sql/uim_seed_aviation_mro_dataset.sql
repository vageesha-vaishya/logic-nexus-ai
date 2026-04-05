BEGIN;

DO $$
DECLARE
  v_tenant_id uuid;
  v_franchise_id uuid;
  v_actor uuid;
BEGIN
  SELECT id INTO v_tenant_id FROM public.tenants ORDER BY created_at ASC LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant available for UIM seed';
  END IF;

  SELECT id INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  SELECT id INTO v_actor FROM auth.users ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.uim_inventory_categories (
    tenant_id, franchise_id, category_code, category_name, is_hazardous, regulatory_classification, metadata
  )
  VALUES
    (v_tenant_id, v_franchise_id, 'ATA-ROT', 'Rotable Components', false, 'ATA-ROT', '{"domain":"aviation"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'ATA-CNS', 'Consumables', true, 'ATA-CNS', '{"domain":"aviation"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'ATA-TLS', 'Tools and Ground Equipment', false, 'ATA-TLS', '{"domain":"aviation"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'ATA-LLP', 'Life Limited Parts', false, 'ATA-LLP', '{"domain":"aviation"}'::jsonb)
  ON CONFLICT (tenant_id, category_code) DO UPDATE SET
    category_name = EXCLUDED.category_name,
    is_hazardous = EXCLUDED.is_hazardous,
    regulatory_classification = EXCLUDED.regulatory_classification,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.uim_inventory_locations (
    tenant_id, franchise_id, location_code, location_name, location_type, region, aisle, bay, bin, is_quarantine, metadata
  )
  VALUES
    (v_tenant_id, v_franchise_id, 'HGR-MAIN', 'Hangar Main Stores', 'warehouse', 'HGR', 'A', '01', '001', false, '{"zone":"main"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'HGR-LINE', 'Line Maintenance Stores', 'warehouse', 'HGR', 'B', '02', '010', false, '{"zone":"line"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'HGR-QUAR', 'Quarantine Cage', 'warehouse', 'HGR', 'Q', '99', '900', true, '{"zone":"quarantine"}'::jsonb)
  ON CONFLICT (tenant_id, location_code) DO UPDATE SET
    location_name = EXCLUDED.location_name,
    location_type = EXCLUDED.location_type,
    region = EXCLUDED.region,
    aisle = EXCLUDED.aisle,
    bay = EXCLUDED.bay,
    bin = EXCLUDED.bin,
    is_quarantine = EXCLUDED.is_quarantine,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.uim_inventory_suppliers (
    tenant_id, franchise_id, supplier_code, supplier_name, supplier_type, contact_email, lead_time_days, compliance_rating, metadata
  )
  VALUES
    (v_tenant_id, v_franchise_id, 'SUP-CFM', 'CFM Materials Services', 'approved_vendor', 'support@cfm.example', 21, 'approved', '{"oem":"CFM"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'SUP-HON', 'Honeywell Spares', 'approved_vendor', 'support@honeywell.example', 14, 'approved', '{"oem":"Honeywell"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'SUP-COL', 'Collins Aerospace Support', 'approved_vendor', 'support@collins.example', 18, 'approved', '{"oem":"Collins"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'SUP-SAF', 'Safran Spare Solutions', 'approved_vendor', 'support@safran.example', 16, 'approved', '{"oem":"Safran"}'::jsonb)
  ON CONFLICT (tenant_id, supplier_code) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    supplier_type = EXCLUDED.supplier_type,
    contact_email = EXCLUDED.contact_email,
    lead_time_days = EXCLUDED.lead_time_days,
    compliance_rating = EXCLUDED.compliance_rating,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.uim_inventory_valuation_methods (
    tenant_id, franchise_id, valuation_code, valuation_name, valuation_strategy, currency_code, metadata
  )
  VALUES
    (v_tenant_id, v_franchise_id, 'FIFO', 'FIFO', 'fifo', 'USD', '{"domain":"generic"}'::jsonb),
    (v_tenant_id, v_franchise_id, 'WAVG', 'Weighted Average', 'weighted_average', 'USD', '{"domain":"generic"}'::jsonb)
  ON CONFLICT (tenant_id, valuation_code) DO UPDATE SET
    valuation_name = EXCLUDED.valuation_name,
    valuation_strategy = EXCLUDED.valuation_strategy,
    currency_code = EXCLUDED.currency_code,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  WITH generated_catalog AS (
    SELECT
      gs AS idx,
      format('UIM-AV-%s', lpad(gs::text, 6, '0')) AS sku,
      format('PN-%s', lpad((510000 + gs)::text, 8, '0')) AS part_number,
      format('Aircraft Component %s', gs) AS title,
      CASE gs % 4
        WHEN 0 THEN 'ATA-ROT'
        WHEN 1 THEN 'ATA-CNS'
        WHEN 2 THEN 'ATA-TLS'
        ELSE 'ATA-LLP'
      END AS category,
      (gs % 3 = 0) AS is_serialized,
      (ARRAY['21','24','27','28','29','32','49','52','71'])[1 + (gs % 9)] AS ata_chapter_code,
      lpad(((gs % 10) + 1)::text, 2, '0') AS ata_sub_chapter_code,
      lpad(((gs % 7) + 1)::text, 2, '0') AS ata_section_code,
      (ARRAY['CFM', 'Honeywell', 'Collins', 'Safran'])[1 + (gs % 4)] AS manufacturer_name,
      CASE WHEN gs % 4 = 1 THEN 365 + (gs % 180) ELSE NULL END AS shelf_life_days,
      CASE WHEN gs % 6 = 0 THEN true ELSE false END AS life_limited,
      CASE WHEN gs % 9 = 0 THEN true ELSE false END AS hazardous
    FROM generate_series(1, 900) gs
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
      'ata_chapter_code', c.ata_chapter_code,
      'ata_sub_chapter_code', c.ata_sub_chapter_code,
      'ata_section_code', c.ata_section_code,
      'manufacturer_name', c.manufacturer_name,
      'life_limited', c.life_limited,
      'shelf_life_days', c.shelf_life_days,
      'hazardous_material', c.hazardous,
      'domain', 'aviation-mro'
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

  WITH generated_inventory AS (
    SELECT
      row_number() OVER (ORDER BY c.id) AS rn,
      c.id AS catalog_item_id,
      c.tenant_id,
      c.franchise_id,
      c.category,
      c.attributes
    FROM public.uim_catalog_items c
    WHERE c.tenant_id = v_tenant_id
      AND c.sku LIKE 'UIM-AV-%'
  )
  INSERT INTO public.uim_inventory_items (
    tenant_id, franchise_id, catalog_item_id, serial_number, batch_lot_number, quantity, status, location_type, metadata, created_by, updated_by
  )
  SELECT
    i.tenant_id,
    i.franchise_id,
    i.catalog_item_id,
    format('SN-%s', lpad((850000 + i.rn)::text, 8, '0')),
    format('LOT-%s', lpad((920000 + i.rn)::text, 8, '0')),
    CASE WHEN i.category = 'ATA-CNS' THEN 5 + (i.rn % 60) ELSE 1 END,
    CASE WHEN i.rn % 30 = 0 THEN 'in_transit' ELSE 'available' END,
    'warehouse',
    jsonb_build_object(
      'aircraft_registration', format('VT-%s', lpad((100 + (i.rn % 799))::text, 3, '0')),
      'condition_code', CASE WHEN i.rn % 20 = 0 THEN 'INSP' ELSE 'SV' END,
      'supplier_code', (ARRAY['SUP-CFM','SUP-HON','SUP-COL','SUP-SAF'])[1 + (i.rn % 4)],
      'next_due_fh', 500 + (i.rn % 5000),
      'next_due_fc', 100 + (i.rn % 2000),
      'next_due_date', (current_date + ((i.rn % 360)::int))::text
    ),
    v_actor,
    v_actor
  FROM generated_inventory i
  ON CONFLICT (tenant_id, serial_number) DO UPDATE SET
    batch_lot_number = EXCLUDED.batch_lot_number,
    quantity = EXCLUDED.quantity,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = now(),
    updated_by = EXCLUDED.updated_by;

  INSERT INTO public.uim_inventory_ledger (
    tenant_id, franchise_id, inventory_item_id, transaction_type, quantity_changed, referenced_module, referenced_record_id, reservation_id, metadata, performed_by
  )
  SELECT
    ii.tenant_id,
    ii.franchise_id,
    ii.id,
    CASE WHEN row_number() OVER (ORDER BY ii.id) % 3 = 0 THEN 'CONSUME' ELSE 'RECEIVE' END,
    CASE WHEN row_number() OVER (ORDER BY ii.id) % 3 = 0 THEN 1 ELSE GREATEST(1, round(ii.quantity / 2.0)) END,
    'uim-seed',
    gen_random_uuid(),
    NULL,
    jsonb_build_object(
      'work_order', format('WO-%s', lpad((700000 + row_number() OVER (ORDER BY ii.id))::text, 8, '0')),
      'maintenance_visit', format('MV-%s', lpad((800000 + row_number() OVER (ORDER BY ii.id))::text, 8, '0'))
    ),
    v_actor
  FROM public.uim_inventory_items ii
  JOIN public.uim_catalog_items ci ON ci.id = ii.catalog_item_id
  WHERE ii.tenant_id = v_tenant_id
    AND ci.sku LIKE 'UIM-AV-%'
  LIMIT 1200;

  INSERT INTO public.uim_inventory_reservations (
    tenant_id, franchise_id, catalog_item_id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, referenced_module, referenced_record_id, expected_use_date, metadata, created_by, updated_by
  )
  SELECT
    ii.tenant_id,
    ii.franchise_id,
    ii.catalog_item_id,
    ii.id,
    1,
    CASE WHEN row_number() OVER (ORDER BY ii.id) % 2 = 0 THEN 'active' ELSE 'fulfilled' END,
    format('RSV-%s', lpad((900000 + row_number() OVER (ORDER BY ii.id))::text, 8, '0')),
    'maintenance-planning',
    gen_random_uuid(),
    now() + ((row_number() OVER (ORDER BY ii.id) % 21) || ' days')::interval,
    jsonb_build_object('priority', CASE WHEN row_number() OVER (ORDER BY ii.id) % 9 = 0 THEN 'AOG' ELSE 'NORMAL' END),
    v_actor,
    v_actor
  FROM public.uim_inventory_items ii
  JOIN public.uim_catalog_items ci ON ci.id = ii.catalog_item_id
  WHERE ii.tenant_id = v_tenant_id
    AND ci.sku LIKE 'UIM-AV-%'
  LIMIT 300
  ON CONFLICT (tenant_id, reservation_token) DO NOTHING;

  INSERT INTO public.uim_inventory_projection_snapshots (
    tenant_id, franchise_id, inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, last_ledger_at, replay_version
  )
  SELECT
    ii.tenant_id,
    ii.franchise_id,
    ii.id,
    GREATEST(0, ii.quantity - 1),
    1,
    CASE WHEN row_number() OVER (ORDER BY ii.id) % 5 = 0 THEN 1 ELSE 0 END,
    now(),
    2
  FROM public.uim_inventory_items ii
  JOIN public.uim_catalog_items ci ON ci.id = ii.catalog_item_id
  WHERE ii.tenant_id = v_tenant_id
    AND ci.sku LIKE 'UIM-AV-%'
  ON CONFLICT (tenant_id, inventory_item_id) DO UPDATE SET
    projected_available_quantity = EXCLUDED.projected_available_quantity,
    projected_reserved_quantity = EXCLUDED.projected_reserved_quantity,
    projected_consumed_quantity = EXCLUDED.projected_consumed_quantity,
    last_ledger_at = EXCLUDED.last_ledger_at,
    replay_version = EXCLUDED.replay_version,
    updated_at = now();

  INSERT INTO public.uim_mro_item_profiles (
    tenant_id, franchise_id, catalog_item_id, maintenance_category, ata_chapter_code, ata_sub_chapter_code, ata_section_code,
    manufacturer_name, manufacturer_code, shelf_life_days, condition_code, storage_requirements, certification_status, certification_reference,
    hazardous_material, calibrated_tool, calibration_due_date, regulatory_compliance, aog_priority, traceability, metadata, created_by, updated_by
  )
  SELECT
    ci.tenant_id,
    ci.franchise_id,
    ci.id,
    CASE
      WHEN ci.category = 'ATA-ROT' THEN 'rotable'
      WHEN ci.category = 'ATA-CNS' THEN 'consumable'
      WHEN ci.category = 'ATA-TLS' THEN 'tooling'
      ELSE 'emergency-spare'
    END,
    COALESCE(ci.attributes->>'ata_chapter_code', '21'),
    COALESCE(ci.attributes->>'ata_sub_chapter_code', '01'),
    COALESCE(ci.attributes->>'ata_section_code', '01'),
    COALESCE(ci.attributes->>'manufacturer_name', 'OEM'),
    format('MFG-%s', lpad((100 + row_number() OVER (ORDER BY ci.id))::text, 4, '0')),
    NULLIF(ci.attributes->>'shelf_life_days', '')::int,
    CASE WHEN row_number() OVER (ORDER BY ci.id) % 14 = 0 THEN 'INSP' ELSE 'SV' END,
    jsonb_build_object('temperature', CASE WHEN ci.category = 'ATA-CNS' THEN '2-8C' ELSE 'ambient' END, 'humidity_max_percent', 60),
    CASE WHEN row_number() OVER (ORDER BY ci.id) % 18 = 0 THEN 'expiring' ELSE 'valid' END,
    format('CERT-%s', lpad((930000 + row_number() OVER (ORDER BY ci.id))::text, 8, '0')),
    (ci.attributes->>'hazardous_material')::boolean,
    ci.category = 'ATA-TLS',
    CASE WHEN ci.category = 'ATA-TLS' THEN current_date + ((row_number() OVER (ORDER BY ci.id) % 180)::int) ELSE NULL END,
    jsonb_build_object('faa_14_cfr_43', true, 'easa_part_145', true),
    row_number() OVER (ORDER BY ci.id) % 12 = 0,
    jsonb_build_object('llp', (ci.attributes->>'life_limited')::boolean),
    jsonb_build_object('dataset', 'uim-aviation-mro-900'),
    v_actor,
    v_actor
  FROM public.uim_catalog_items ci
  WHERE ci.tenant_id = v_tenant_id
    AND ci.sku LIKE 'UIM-AV-%'
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

  INSERT INTO public.uim_form_records (
    tenant_id, franchise_id, node_key, payload, metadata, created_by, updated_by
  )
  SELECT
    v_tenant_id,
    v_franchise_id,
    node_key,
    payload,
    jsonb_build_object('source', 'uim-aviation-mro-seed'),
    v_actor,
    v_actor
  FROM (
    SELECT
      'analytics'::text AS node_key,
      jsonb_build_object(
        'report_name', 'Aviation MRO Forecast Dashboard',
        'metric_group', 'inventory_health',
        'include_archived', false
      ) AS payload
    UNION ALL
    SELECT
      'overview',
      jsonb_build_object(
        'module_name', 'UIM Aviation MRO',
        'owner_email', 'uim-admin@logicnexus.ai',
        'rollout_phase', 'phase_4',
        'target_go_live_date', current_date::text
      )
  ) seed_rows
  ON CONFLICT DO NOTHING;
END
$$;

COMMIT;
