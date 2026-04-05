BEGIN;

CREATE TABLE IF NOT EXISTS public.uim_inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  category_code TEXT NOT NULL,
  category_name TEXT NOT NULL,
  is_hazardous BOOLEAN NOT NULL DEFAULT false,
  regulatory_classification TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, category_code)
);

CREATE TABLE IF NOT EXISTS public.uim_inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  location_code TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'warehouse',
  region TEXT,
  aisle TEXT,
  bay TEXT,
  bin TEXT,
  is_quarantine BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, location_code)
);

CREATE TABLE IF NOT EXISTS public.uim_inventory_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  supplier_code TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_type TEXT NOT NULL DEFAULT 'approved_vendor',
  contact_email TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 0,
  compliance_rating TEXT NOT NULL DEFAULT 'approved',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, supplier_code)
);

CREATE TABLE IF NOT EXISTS public.uim_inventory_valuation_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  valuation_code TEXT NOT NULL,
  valuation_name TEXT NOT NULL,
  valuation_strategy TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, valuation_code)
);

CREATE TABLE IF NOT EXISTS public.amro_uim_inventory_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE SET NULL,
  sync_direction TEXT NOT NULL CHECK (sync_direction IN ('amro_to_uim', 'uim_to_amro', 'bidirectional')),
  sync_operation TEXT NOT NULL,
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_succeeded INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  error_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_uim_inventory_sync_events_tenant_created_at
  ON public.amro_uim_inventory_sync_events (tenant_id, created_at DESC);

DO $$
DECLARE
  v_tenant_id UUID;
  v_franchise_id UUID;
  v_actor UUID;
  v_category_rotable UUID;
  v_category_expendable UUID;
  v_location_main UUID;
  v_location_line UUID;
  v_location_quarantine UUID;
  v_supplier_primary UUID;
  v_supplier_critical UUID;
  v_valuation_fifo UUID;
  v_valuation_weighted UUID;
  v_catalog_pump UUID;
  v_catalog_filter UUID;
  v_inventory_pump UUID;
  v_inventory_filter UUID;
  v_wp_reference_id UUID := gen_random_uuid();
  v_grn_reference_id UUID := gen_random_uuid();
BEGIN
  SELECT id
  INTO v_tenant_id
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

  INSERT INTO public.uim_inventory_categories (tenant_id, franchise_id, category_code, category_name, is_hazardous, regulatory_classification, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'AMRO-ROT', 'AMRO Rotable Components', false, 'ATA-ROT', jsonb_build_object('source', 'amro-seed')),
    (v_tenant_id, v_franchise_id, 'AMRO-EXP', 'AMRO Expendables', false, 'ATA-EXP', jsonb_build_object('source', 'amro-seed'))
  ON CONFLICT (tenant_id, category_code) DO UPDATE SET
    category_name = EXCLUDED.category_name,
    regulatory_classification = EXCLUDED.regulatory_classification,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  SELECT id INTO v_category_rotable FROM public.uim_inventory_categories WHERE tenant_id = v_tenant_id AND category_code = 'AMRO-ROT' LIMIT 1;
  SELECT id INTO v_category_expendable FROM public.uim_inventory_categories WHERE tenant_id = v_tenant_id AND category_code = 'AMRO-EXP' LIMIT 1;

  INSERT INTO public.uim_inventory_locations (tenant_id, franchise_id, location_code, location_name, location_type, region, aisle, bay, bin, is_quarantine, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'AMRO-MAIN', 'AMRO Main Warehouse', 'warehouse', 'DXB', 'A', '01', '001', false, jsonb_build_object('source', 'amro-seed')),
    (v_tenant_id, v_franchise_id, 'AMRO-LINE', 'AMRO Line Side Store', 'warehouse', 'DXB', 'B', '02', '012', false, jsonb_build_object('source', 'amro-seed')),
    (v_tenant_id, v_franchise_id, 'AMRO-QUAR', 'AMRO Quarantine Zone', 'warehouse', 'DXB', 'Q', '99', '999', true, jsonb_build_object('source', 'amro-seed'))
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

  SELECT id INTO v_location_main FROM public.uim_inventory_locations WHERE tenant_id = v_tenant_id AND location_code = 'AMRO-MAIN' LIMIT 1;
  SELECT id INTO v_location_line FROM public.uim_inventory_locations WHERE tenant_id = v_tenant_id AND location_code = 'AMRO-LINE' LIMIT 1;
  SELECT id INTO v_location_quarantine FROM public.uim_inventory_locations WHERE tenant_id = v_tenant_id AND location_code = 'AMRO-QUAR' LIMIT 1;

  INSERT INTO public.uim_inventory_suppliers (tenant_id, franchise_id, supplier_code, supplier_name, supplier_type, contact_email, lead_time_days, compliance_rating, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'SUP-AMRO-001', 'AeroPrime Components', 'approved_vendor', 'ops@aeroprime.example', 14, 'approved', jsonb_build_object('source', 'amro-seed')),
    (v_tenant_id, v_franchise_id, 'SUP-AMRO-002', 'FlightLine Critical Spares', 'approved_vendor', 'support@flightline.example', 7, 'approved', jsonb_build_object('source', 'amro-seed'))
  ON CONFLICT (tenant_id, supplier_code) DO UPDATE SET
    supplier_name = EXCLUDED.supplier_name,
    supplier_type = EXCLUDED.supplier_type,
    contact_email = EXCLUDED.contact_email,
    lead_time_days = EXCLUDED.lead_time_days,
    compliance_rating = EXCLUDED.compliance_rating,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  SELECT id INTO v_supplier_primary FROM public.uim_inventory_suppliers WHERE tenant_id = v_tenant_id AND supplier_code = 'SUP-AMRO-001' LIMIT 1;
  SELECT id INTO v_supplier_critical FROM public.uim_inventory_suppliers WHERE tenant_id = v_tenant_id AND supplier_code = 'SUP-AMRO-002' LIMIT 1;

  INSERT INTO public.uim_inventory_valuation_methods (tenant_id, franchise_id, valuation_code, valuation_name, valuation_strategy, currency_code, metadata)
  VALUES
    (v_tenant_id, v_franchise_id, 'VAL-FIFO', 'FIFO Standard', 'fifo', 'USD', jsonb_build_object('source', 'amro-seed')),
    (v_tenant_id, v_franchise_id, 'VAL-WAV', 'Weighted Average', 'weighted_average', 'USD', jsonb_build_object('source', 'amro-seed'))
  ON CONFLICT (tenant_id, valuation_code) DO UPDATE SET
    valuation_name = EXCLUDED.valuation_name,
    valuation_strategy = EXCLUDED.valuation_strategy,
    currency_code = EXCLUDED.currency_code,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  SELECT id INTO v_valuation_fifo FROM public.uim_inventory_valuation_methods WHERE tenant_id = v_tenant_id AND valuation_code = 'VAL-FIFO' LIMIT 1;
  SELECT id INTO v_valuation_weighted FROM public.uim_inventory_valuation_methods WHERE tenant_id = v_tenant_id AND valuation_code = 'VAL-WAV' LIMIT 1;

  INSERT INTO public.uim_catalog_items (
    tenant_id, franchise_id, sku, part_number, title, category, unit_of_measure, is_serialized, attributes, created_by, updated_by
  )
  VALUES
    (
      v_tenant_id,
      v_franchise_id,
      'AMRO-PUMP-001',
      'PN-1001',
      'Hydraulic Pump Assembly',
      'AMRO-ROT',
      'pcs',
      false,
      jsonb_build_object(
        'seed_source', 'amro-uim-phase5',
        'supplier_id', v_supplier_primary,
        'valuation_method_id', v_valuation_fifo,
        'category_id', v_category_rotable
      ),
      v_actor,
      v_actor
    ),
    (
      v_tenant_id,
      v_franchise_id,
      'AMRO-FILTER-010',
      'PN-2010',
      'Engine Fuel Filter',
      'AMRO-EXP',
      'pcs',
      false,
      jsonb_build_object(
        'seed_source', 'amro-uim-phase5',
        'supplier_id', v_supplier_critical,
        'valuation_method_id', v_valuation_weighted,
        'category_id', v_category_expendable
      ),
      v_actor,
      v_actor
    )
  ON CONFLICT (tenant_id, sku) DO UPDATE SET
    part_number = EXCLUDED.part_number,
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    unit_of_measure = EXCLUDED.unit_of_measure,
    attributes = EXCLUDED.attributes,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  SELECT id INTO v_catalog_pump FROM public.uim_catalog_items WHERE tenant_id = v_tenant_id AND sku = 'AMRO-PUMP-001' LIMIT 1;
  SELECT id INTO v_catalog_filter FROM public.uim_catalog_items WHERE tenant_id = v_tenant_id AND sku = 'AMRO-FILTER-010' LIMIT 1;

  INSERT INTO public.uim_inventory_items (
    tenant_id, franchise_id, catalog_item_id, serial_number, batch_lot_number, quantity, status, location_type, metadata, created_by, updated_by
  )
  VALUES
    (
      v_tenant_id,
      v_franchise_id,
      v_catalog_pump,
      'AMRO-SN-PUMP-0001',
      'LOT-PUMP-01',
      6,
      'available',
      'warehouse',
      jsonb_build_object('location_id', v_location_main, 'seed_source', 'amro-uim-phase5'),
      v_actor,
      v_actor
    ),
    (
      v_tenant_id,
      v_franchise_id,
      v_catalog_filter,
      'AMRO-SN-FLTR-0010',
      'LOT-FLTR-12',
      40,
      'available',
      'warehouse',
      jsonb_build_object('location_id', v_location_line, 'seed_source', 'amro-uim-phase5'),
      v_actor,
      v_actor
    )
  ON CONFLICT (tenant_id, serial_number) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    status = EXCLUDED.status,
    location_type = EXCLUDED.location_type,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  SELECT id INTO v_inventory_pump FROM public.uim_inventory_items WHERE tenant_id = v_tenant_id AND serial_number = 'AMRO-SN-PUMP-0001' LIMIT 1;
  SELECT id INTO v_inventory_filter FROM public.uim_inventory_items WHERE tenant_id = v_tenant_id AND serial_number = 'AMRO-SN-FLTR-0010' LIMIT 1;

  INSERT INTO public.uim_inventory_reservations (
    tenant_id, franchise_id, catalog_item_id, inventory_item_id, reserved_quantity, reservation_status, reservation_token, referenced_module, referenced_record_id, metadata, created_by, updated_by
  )
  VALUES
    (
      v_tenant_id,
      v_franchise_id,
      v_catalog_filter,
      v_inventory_filter,
      5,
      'active',
      'amro-seed-reservation-001',
      'AMRO',
      v_wp_reference_id,
      jsonb_build_object('work_package_id', 'WP-0001', 'external_reference', 'WP-0001', 'seed_source', 'amro-uim-phase5'),
      v_actor,
      v_actor
    )
  ON CONFLICT (tenant_id, reservation_token) DO UPDATE SET
    reserved_quantity = EXCLUDED.reserved_quantity,
    reservation_status = EXCLUDED.reservation_status,
    metadata = EXCLUDED.metadata,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  INSERT INTO public.uim_inventory_ledger (
    tenant_id, franchise_id, inventory_item_id, transaction_type, quantity_changed, from_location_id, to_location_id, referenced_module, referenced_record_id, metadata, performed_by
  )
  VALUES
    (
      v_tenant_id,
      v_franchise_id,
      v_inventory_pump,
      'RECEIVE',
      2,
      NULL,
      v_location_main,
      'AMRO',
      v_grn_reference_id,
      jsonb_build_object('seed_source', 'amro-uim-phase5', 'external_reference', 'GRN-0001'),
      v_actor
    ),
    (
      v_tenant_id,
      v_franchise_id,
      v_inventory_filter,
      'CONSUME',
      -5,
      v_location_main,
      v_location_line,
      'AMRO',
      v_wp_reference_id,
      jsonb_build_object('seed_source', 'amro-uim-phase5', 'external_reference', 'WP-0001'),
      v_actor
    )
  ON CONFLICT DO NOTHING;

  IF to_regclass('public.uim_commands') IS NOT NULL THEN
    INSERT INTO public.uim_commands (
      tenant_id, franchise_id, command_type, command_payload, command_status, idempotency_key, actor_user_id
    )
    VALUES
      (
        v_tenant_id,
        v_franchise_id,
        'stock_adjustment',
        jsonb_build_object('reason', 'AMRO seed initialization', 'delta', 2, 'catalog_item_id', v_catalog_pump),
        'succeeded',
        'amro-seed-command-stock-adjustment',
        v_actor
      ),
      (
        v_tenant_id,
        v_franchise_id,
        'reservation',
        jsonb_build_object('reservation_token', 'amro-seed-reservation-001', 'catalog_item_id', v_catalog_filter, 'reserved_quantity', 5),
        'succeeded',
        'amro-seed-command-reservation',
        v_actor
      )
    ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET
      command_status = EXCLUDED.command_status,
      command_payload = EXCLUDED.command_payload,
      updated_at = now();
  END IF;

  IF to_regclass('public.uim_projection_snapshots') IS NOT NULL THEN
    INSERT INTO public.uim_projection_snapshots (
      tenant_id, franchise_id, inventory_item_id, projected_available_quantity, projected_reserved_quantity, projected_consumed_quantity, replay_version, source_event_id
    )
    VALUES
      (
        v_tenant_id,
        v_franchise_id,
        v_inventory_filter,
        40,
        5,
        0,
        1,
        gen_random_uuid()
      ),
      (
        v_tenant_id,
        v_franchise_id,
        v_inventory_pump,
        6,
        0,
        0,
        1,
        gen_random_uuid()
      )
    ON CONFLICT (tenant_id, inventory_item_id) DO UPDATE SET
      projected_available_quantity = EXCLUDED.projected_available_quantity,
      projected_reserved_quantity = EXCLUDED.projected_reserved_quantity,
      projected_consumed_quantity = EXCLUDED.projected_consumed_quantity,
      replay_version = EXCLUDED.replay_version,
      updated_at = now();
  END IF;

  INSERT INTO public.amro_uim_inventory_sync_events (
    tenant_id, franchise_id, sync_direction, sync_operation, records_processed, records_succeeded, records_failed, status, error_summary, metadata, triggered_by
  )
  VALUES (
    v_tenant_id,
    v_franchise_id,
    'bidirectional',
    'deccan_seed_initialization',
    10,
    10,
    0,
    'success',
    '[]'::jsonb,
    jsonb_build_object('seed_source', 'amro-uim-phase5', 'tenant_slug', 'deccan'),
    v_actor
  );
END;
$$;

CREATE OR REPLACE VIEW public.amro_uim_seed_validation AS
SELECT
  tenant_id,
  COUNT(*) FILTER (WHERE entity = 'uim_inventory_categories') AS categories_count,
  COUNT(*) FILTER (WHERE entity = 'uim_inventory_locations') AS locations_count,
  COUNT(*) FILTER (WHERE entity = 'uim_inventory_suppliers') AS suppliers_count,
  COUNT(*) FILTER (WHERE entity = 'uim_inventory_valuation_methods') AS valuation_methods_count,
  COUNT(*) FILTER (WHERE entity = 'uim_catalog_items') AS catalog_items_count,
  COUNT(*) FILTER (WHERE entity = 'uim_inventory_items') AS inventory_items_count,
  COUNT(*) FILTER (WHERE entity = 'uim_inventory_reservations') AS reservations_count,
  COUNT(*) FILTER (WHERE entity = 'uim_inventory_ledger') AS ledger_count
FROM (
  SELECT tenant_id, 'uim_inventory_categories'::text AS entity FROM public.uim_inventory_categories
  UNION ALL SELECT tenant_id, 'uim_inventory_locations'::text AS entity FROM public.uim_inventory_locations
  UNION ALL SELECT tenant_id, 'uim_inventory_suppliers'::text AS entity FROM public.uim_inventory_suppliers
  UNION ALL SELECT tenant_id, 'uim_inventory_valuation_methods'::text AS entity FROM public.uim_inventory_valuation_methods
  UNION ALL SELECT tenant_id, 'uim_catalog_items'::text AS entity FROM public.uim_catalog_items
  UNION ALL SELECT tenant_id, 'uim_inventory_items'::text AS entity FROM public.uim_inventory_items
  UNION ALL SELECT tenant_id, 'uim_inventory_reservations'::text AS entity FROM public.uim_inventory_reservations
  UNION ALL SELECT tenant_id, 'uim_inventory_ledger'::text AS entity FROM public.uim_inventory_ledger
) seed_entities
GROUP BY tenant_id;

COMMIT;
