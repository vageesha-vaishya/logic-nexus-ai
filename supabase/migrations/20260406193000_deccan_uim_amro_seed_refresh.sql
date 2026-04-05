-- Deccan-targeted AMRO/UIM seed refresh migration
-- Purpose:
--   Make Deccan seed execution available through `supabase db push` without requiring local psql.

DO $$
DECLARE
  v_tenant_id UUID;
  v_franchise_id UUID;
  v_actor UUID;
  v_category_rotable UUID;
  v_category_expendable UUID;
  v_location_main UUID;
  v_location_line UUID;
  v_supplier_primary UUID;
  v_supplier_critical UUID;
  v_valuation_fifo UUID;
  v_valuation_weighted UUID;
  v_catalog_pump UUID;
  v_catalog_filter UUID;
  v_inventory_pump UUID;
  v_inventory_filter UUID;
  v_wp_reference_id UUID := '11111111-1111-4111-8111-111111111111'::uuid;
  v_grn_reference_id UUID := '22222222-2222-4222-8222-222222222222'::uuid;
BEGIN
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, subscription_tier, is_active)
    VALUES ('Deccan', 'deccan', 'enterprise', true)
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name,
          subscription_tier = EXCLUDED.subscription_tier,
          is_active = true,
          updated_at = now()
    RETURNING id INTO v_tenant_id;
  END IF;

  SELECT id INTO v_franchise_id
  FROM public.franchises
  WHERE tenant_id = v_tenant_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_franchise_id IS NULL THEN
    INSERT INTO public.franchises (tenant_id, name, code, address, is_active)
    VALUES (
      v_tenant_id,
      'Deccan AMRO Operations',
      'DECCAN-' || upper(left(replace(v_tenant_id::text, '-', ''), 6)),
      jsonb_build_object('city', 'Hyderabad', 'country', 'India'),
      true
    )
    RETURNING id INTO v_franchise_id;
  END IF;

  SELECT id INTO v_actor FROM auth.users ORDER BY created_at ASC LIMIT 1;

  IF v_actor IS NOT NULL AND to_regclass('public.profiles') IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, first_name, last_name, is_active)
    SELECT
      u.id,
      COALESCE(NULLIF(u.email, ''), format('deccan-user-%s@example.local', left(u.id::text, 8))),
      'Deccan',
      'AMRO',
      true
    FROM auth.users u
    WHERE u.id = v_actor
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      is_active = true,
      updated_at = now();
  END IF;

  IF v_actor IS NOT NULL AND to_regclass('public.user_roles') IS NOT NULL THEN
    UPDATE public.user_roles
    SET
      tenant_id = v_tenant_id,
      franchise_id = NULL,
      assigned_by = v_actor
    WHERE user_id = v_actor AND role = 'tenant_admin';
    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id, assigned_by)
      VALUES (v_actor, 'tenant_admin', v_tenant_id, NULL, v_actor)
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.user_roles
    SET
      tenant_id = v_tenant_id,
      franchise_id = v_franchise_id,
      assigned_by = v_actor
    WHERE user_id = v_actor AND role = 'franchise_admin';
    IF NOT FOUND THEN
      INSERT INTO public.user_roles (user_id, role, tenant_id, franchise_id, assigned_by)
      VALUES (v_actor, 'franchise_admin', v_tenant_id, v_franchise_id, v_actor)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF v_actor IS NOT NULL AND to_regclass('public.user_preferences') IS NOT NULL THEN
    UPDATE public.user_preferences
    SET
      tenant_id = v_tenant_id,
      franchise_id = v_franchise_id,
      admin_override_enabled = true,
      updated_at = now()
    WHERE user_id = v_actor;

    IF NOT FOUND THEN
      INSERT INTO public.user_preferences (user_id, tenant_id, franchise_id, admin_override_enabled)
      VALUES (v_actor, v_tenant_id, v_franchise_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  INSERT INTO public.uim_inventory_categories (tenant_id, franchise_id, category_code, category_name, is_hazardous, regulatory_classification, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'AMRO-ROT', 'AMRO Rotable Components', false, 'ATA-ROT', jsonb_build_object('source', 'deccan-seed')),
    (v_tenant_id, v_franchise_id, 'AMRO-EXP', 'AMRO Expendables', false, 'ATA-EXP', jsonb_build_object('source', 'deccan-seed'))
  ON CONFLICT (tenant_id, category_code) DO UPDATE SET
    category_name = EXCLUDED.category_name,
    regulatory_classification = EXCLUDED.regulatory_classification,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  SELECT id INTO v_category_rotable FROM public.uim_inventory_categories WHERE tenant_id = v_tenant_id AND category_code = 'AMRO-ROT' LIMIT 1;
  SELECT id INTO v_category_expendable FROM public.uim_inventory_categories WHERE tenant_id = v_tenant_id AND category_code = 'AMRO-EXP' LIMIT 1;

  INSERT INTO public.uim_inventory_locations (tenant_id, franchise_id, location_code, location_name, location_type, region, aisle, bay, bin, is_quarantine, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'DECCAN-MRO-MAIN', 'Deccan Main MRO Warehouse', 'warehouse', 'HYD', 'A', '01', '001', false, jsonb_build_object('source', 'deccan-seed')),
    (v_tenant_id, v_franchise_id, 'DECCAN-LINE', 'Deccan Line Maintenance Store', 'warehouse', 'HYD', 'B', '02', '012', false, jsonb_build_object('source', 'deccan-seed')),
    (v_tenant_id, v_franchise_id, 'DECCAN-QUAR', 'Deccan Quarantine Store', 'warehouse', 'HYD', 'Q', '99', '999', true, jsonb_build_object('source', 'deccan-seed'))
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

  SELECT id INTO v_location_main FROM public.uim_inventory_locations WHERE tenant_id = v_tenant_id AND location_code = 'DECCAN-MRO-MAIN' LIMIT 1;
  SELECT id INTO v_location_line FROM public.uim_inventory_locations WHERE tenant_id = v_tenant_id AND location_code = 'DECCAN-LINE' LIMIT 1;

  INSERT INTO public.uim_inventory_suppliers (tenant_id, franchise_id, supplier_code, supplier_name, supplier_type, contact_email, lead_time_days, compliance_rating, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'DECCAN-SUP-001', 'Deccan AeroPrime', 'approved_vendor', 'supply@deccan-aeroprime.example', 12, 'approved', jsonb_build_object('source', 'deccan-seed', 'cert', 'EASA-PART-145')),
    (v_tenant_id, v_franchise_id, 'DECCAN-SUP-002', 'Deccan FlightLine Critical', 'approved_vendor', 'critical@deccan-flightline.example', 7, 'approved', jsonb_build_object('source', 'deccan-seed', 'cert', 'DGCA-MRO'))
  ON CONFLICT (tenant_id, supplier_code) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    contact_email = EXCLUDED.contact_email,
    lead_time_days = EXCLUDED.lead_time_days,
    compliance_rating = EXCLUDED.compliance_rating,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  SELECT id INTO v_supplier_primary FROM public.uim_inventory_suppliers WHERE tenant_id = v_tenant_id AND supplier_code = 'DECCAN-SUP-001' LIMIT 1;
  SELECT id INTO v_supplier_critical FROM public.uim_inventory_suppliers WHERE tenant_id = v_tenant_id AND supplier_code = 'DECCAN-SUP-002' LIMIT 1;

  INSERT INTO public.uim_inventory_valuation_methods (tenant_id, franchise_id, valuation_code, valuation_name, valuation_strategy, currency_code, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'DECCAN-FIFO', 'Deccan FIFO', 'fifo', 'USD', jsonb_build_object('source', 'deccan-seed')),
    (v_tenant_id, v_franchise_id, 'DECCAN-WAVG', 'Deccan Weighted Average', 'weighted_average', 'USD', jsonb_build_object('source', 'deccan-seed'))
  ON CONFLICT (tenant_id, valuation_code) DO UPDATE SET
    valuation_name = EXCLUDED.valuation_name,
    valuation_strategy = EXCLUDED.valuation_strategy,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  SELECT id INTO v_valuation_fifo FROM public.uim_inventory_valuation_methods WHERE tenant_id = v_tenant_id AND valuation_code = 'DECCAN-FIFO' LIMIT 1;
  SELECT id INTO v_valuation_weighted FROM public.uim_inventory_valuation_methods WHERE tenant_id = v_tenant_id AND valuation_code = 'DECCAN-WAVG' LIMIT 1;

  INSERT INTO public.uim_catalog_items (tenant_id, franchise_id, sku, part_number, title, category, unit_of_measure, is_serialized, attributes, created_by, updated_by)
  VALUES
    (
      v_tenant_id, v_franchise_id, 'DECCAN-AMRO-PUMP-001', 'DCC-PN-1001', 'Deccan Hydraulic Pump', 'AMRO-ROT', 'pcs', false,
      jsonb_build_object('seed_source', 'deccan-seed', 'supplier_id', v_supplier_primary, 'valuation_method_id', v_valuation_fifo, 'category_id', v_category_rotable),
      v_actor, v_actor
    ),
    (
      v_tenant_id, v_franchise_id, 'DECCAN-AMRO-FLTR-010', 'DCC-PN-2010', 'Deccan Fuel Filter', 'AMRO-EXP', 'pcs', false,
      jsonb_build_object('seed_source', 'deccan-seed', 'supplier_id', v_supplier_critical, 'valuation_method_id', v_valuation_weighted, 'category_id', v_category_expendable),
      v_actor, v_actor
    )
  ON CONFLICT (tenant_id, sku) DO UPDATE SET
    part_number = EXCLUDED.part_number,
    title = EXCLUDED.title,
    attributes = EXCLUDED.attributes,
    updated_at = now();

  SELECT id INTO v_catalog_pump FROM public.uim_catalog_items WHERE tenant_id = v_tenant_id AND sku = 'DECCAN-AMRO-PUMP-001' LIMIT 1;
  SELECT id INTO v_catalog_filter FROM public.uim_catalog_items WHERE tenant_id = v_tenant_id AND sku = 'DECCAN-AMRO-FLTR-010' LIMIT 1;

  INSERT INTO public.uim_inventory_items (tenant_id, franchise_id, catalog_item_id, serial_number, batch_lot_number, quantity, status, location_type, location_id, metadata, created_by, updated_by)
  VALUES
    (v_tenant_id, v_franchise_id, v_catalog_pump, 'DECCAN-SN-PUMP-0001', 'DECCAN-LOT-PUMP-01', 8, 'available', 'warehouse', v_location_main, jsonb_build_object('seed_source', 'deccan-seed'), v_actor, v_actor),
    (v_tenant_id, v_franchise_id, v_catalog_filter, 'DECCAN-SN-FLTR-0010', 'DECCAN-LOT-FLTR-12', 55, 'available', 'warehouse', v_location_line, jsonb_build_object('seed_source', 'deccan-seed'), v_actor, v_actor)
  ON CONFLICT (tenant_id, serial_number) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    status = EXCLUDED.status,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  SELECT id INTO v_inventory_pump FROM public.uim_inventory_items WHERE tenant_id = v_tenant_id AND serial_number = 'DECCAN-SN-PUMP-0001' LIMIT 1;
  SELECT id INTO v_inventory_filter FROM public.uim_inventory_items WHERE tenant_id = v_tenant_id AND serial_number = 'DECCAN-SN-FLTR-0010' LIMIT 1;

  INSERT INTO public.uim_inventory_reservations (
    tenant_id, franchise_id, catalog_item_id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, referenced_module, referenced_record_id, metadata, created_by, updated_by
  )
  VALUES
    (
      v_tenant_id, v_franchise_id, v_catalog_filter, v_inventory_filter, 5, 'active', 'deccan-amro-reservation-001', 'AMRO',
      v_wp_reference_id,
      jsonb_build_object('external_reference', 'DECCAN-WP-0001', 'seed_source', 'deccan-seed'),
      v_actor, v_actor
    )
  ON CONFLICT (tenant_id, reservation_token) DO UPDATE SET
    reserved_quantity = EXCLUDED.reserved_quantity,
    reservation_status = EXCLUDED.reservation_status,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  INSERT INTO public.uim_inventory_ledger (
    tenant_id, franchise_id, inventory_item_id, transaction_type, quantity_changed, from_location_id, to_location_id, referenced_module, referenced_record_id, metadata, performed_by
  )
  SELECT
    v_tenant_id, v_franchise_id, v_inventory_pump, 'RECEIVE', 2, NULL, v_location_main, 'AMRO', v_grn_reference_id,
    jsonb_build_object('external_reference', 'DECCAN-GRN-0001', 'seed_source', 'deccan-seed'),
    v_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM public.uim_inventory_ledger
    WHERE tenant_id = v_tenant_id
      AND referenced_module = 'AMRO'
      AND referenced_record_id = v_grn_reference_id
  );

  INSERT INTO public.uim_inventory_ledger (
    tenant_id, franchise_id, inventory_item_id, transaction_type, quantity_changed, from_location_id, to_location_id, referenced_module, referenced_record_id, metadata, performed_by
  )
  SELECT
    v_tenant_id, v_franchise_id, v_inventory_filter, 'CONSUME', -7, v_location_main, v_location_line, 'AMRO', v_wp_reference_id,
    jsonb_build_object('external_reference', 'DECCAN-WP-0001', 'seed_source', 'deccan-seed'),
    v_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM public.uim_inventory_ledger
    WHERE tenant_id = v_tenant_id
      AND referenced_module = 'AMRO'
      AND referenced_record_id = v_wp_reference_id
      AND inventory_item_id = v_inventory_filter
  );

  INSERT INTO public.amro_uim_inventory_sync_events (
    tenant_id, franchise_id, sync_direction, sync_operation, records_processed, records_succeeded, records_failed, status, error_summary, metadata, triggered_by
  )
  VALUES (
    v_tenant_id, v_franchise_id, 'bidirectional', 'deccan_seed_refresh', 10, 10, 0, 'success', '[]'::jsonb,
    jsonb_build_object('seed_source', 'deccan-seed', 'tenant_slug', 'deccan'),
    v_actor
  );

  IF to_regclass('public.uim_inventory_projection_snapshots') IS NOT NULL THEN
    INSERT INTO public.uim_inventory_projection_snapshots (
      tenant_id, franchise_id, inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, replay_version
    )
    VALUES
      (v_tenant_id, v_franchise_id, v_inventory_filter, 55, 5, 7, 2),
      (v_tenant_id, v_franchise_id, v_inventory_pump, 8, 0, 0, 2)
    ON CONFLICT (tenant_id, inventory_item_id) DO UPDATE SET
      projected_available_quantity = EXCLUDED.projected_available_quantity,
      projected_reserved_quantity = EXCLUDED.projected_reserved_quantity,
      projected_consumed_quantity = EXCLUDED.projected_consumed_quantity,
      replay_version = EXCLUDED.replay_version,
      updated_at = now();
  END IF;

  IF to_regclass('public.uim_form_records') IS NOT NULL THEN
    INSERT INTO public.uim_form_records (
      tenant_id, franchise_id, node_key, payload, metadata, created_by, updated_by
    )
    SELECT
      v_tenant_id,
      v_franchise_id,
      x.node_key,
      x.payload,
      jsonb_build_object('seed_source', 'deccan-seed', 'tenant_slug', 'deccan'),
      v_actor,
      v_actor
    FROM (
      VALUES
        (
          'overview',
          jsonb_build_object(
            'tenant', 'Deccan',
            'summary', 'AMRO inventory overview seeded for Deccan',
            'active_modules', jsonb_build_array('item-master','stock-ledger','reservations','issue-consume','restock','locations','analytics')
          )
        ),
        (
          'item-master',
          jsonb_build_object('sku', 'DECCAN-AMRO-PUMP-001', 'part_number', 'DCC-PN-1001', 'description', 'Deccan Hydraulic Pump', 'uom', 'pcs')
        ),
        (
          'stock-ledger',
          jsonb_build_object('reference', 'DECCAN-GRN-0001', 'transaction_type', 'RECEIVE', 'quantity_changed', 2)
        ),
        (
          'reservations',
          jsonb_build_object('reservation_token', 'deccan-amro-reservation-001', 'reserved_quantity', 5)
        ),
        (
          'issue-consume',
          jsonb_build_object('reference', 'DECCAN-WP-0001', 'transaction_type', 'CONSUME', 'quantity_changed', -5)
        ),
        (
          'restock',
          jsonb_build_object('reference', 'DECCAN-GRN-0001', 'transaction_type', 'RECEIVE', 'quantity_changed', 2)
        ),
        (
          'locations',
          jsonb_build_object('primary_location', 'DECCAN-MRO-MAIN', 'line_location', 'DECCAN-LINE', 'quarantine_location', 'DECCAN-QUAR')
        ),
        (
          'analytics',
          jsonb_build_object('dashboard_seed', true, 'kpi_hint', 'deccan-amro-inventory', 'latency_target_ms', 2200)
        )
    ) AS x(node_key, payload)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.uim_form_records existing
      WHERE existing.tenant_id = v_tenant_id
        AND existing.franchise_id IS NOT DISTINCT FROM v_franchise_id
        AND existing.node_key = x.node_key
        AND COALESCE(existing.metadata->>'seed_source', '') = 'deccan-seed'
        AND existing.deleted_at IS NULL
    );
  END IF;
END;
$$;
