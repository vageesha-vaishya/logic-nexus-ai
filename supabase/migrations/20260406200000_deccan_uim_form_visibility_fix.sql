-- Deccan UIM form visibility fix
-- Ensures UIM form-backed modules have seeded records for all Deccan franchises.

DO $$
DECLARE
  v_tenant_id UUID;
  v_actor UUID;
BEGIN
  IF to_regclass('public.uim_form_records') IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE lower(slug) = 'deccan' OR lower(name) = 'deccan'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_actor FROM auth.users ORDER BY created_at ASC LIMIT 1;

  INSERT INTO public.uim_form_records (
    tenant_id,
    franchise_id,
    node_key,
    payload,
    metadata,
    created_by,
    updated_by
  )
  SELECT
    v_tenant_id,
    f.id AS franchise_id,
    seed.node_key,
    seed.payload,
    jsonb_build_object(
      'seed_source', 'deccan-visibility-fix',
      'tenant_slug', 'deccan',
      'franchise_code', f.code
    ),
    v_actor,
    v_actor
  FROM public.franchises f
  CROSS JOIN (
    VALUES
      (
        'overview',
        jsonb_build_object(
          'tenant', 'Deccan',
          'summary', 'Deccan AMRO overview seed for franchise-scoped UI',
          'modules', jsonb_build_array('item-master','stock-ledger','reservations','issue-consume','restock','locations','analytics')
        )
      ),
      (
        'item-master',
        jsonb_build_object(
          'sku', 'DECCAN-AMRO-PUMP-001',
          'part_number', 'DCC-PN-1001',
          'description', 'Deccan Hydraulic Pump',
          'uom', 'pcs'
        )
      ),
      (
        'stock-ledger',
        jsonb_build_object(
          'reference', 'DECCAN-GRN-0001',
          'transaction_type', 'RECEIVE',
          'quantity_changed', 2
        )
      ),
      (
        'reservations',
        jsonb_build_object(
          'reservation_token', 'deccan-amro-reservation-001',
          'reserved_quantity', 5
        )
      ),
      (
        'issue-consume',
        jsonb_build_object(
          'reference', 'DECCAN-WP-0001',
          'transaction_type', 'CONSUME',
          'quantity_changed', -5
        )
      ),
      (
        'restock',
        jsonb_build_object(
          'reference', 'DECCAN-GRN-0001',
          'transaction_type', 'RECEIVE',
          'quantity_changed', 2
        )
      ),
      (
        'locations',
        jsonb_build_object(
          'primary_location', 'DECCAN-MRO-MAIN',
          'line_location', 'DECCAN-LINE',
          'quarantine_location', 'DECCAN-QUAR'
        )
      ),
      (
        'analytics',
        jsonb_build_object(
          'dashboard_seed', true,
          'kpi_hint', 'deccan-amro-inventory'
        )
      )
  ) AS seed(node_key, payload)
  WHERE f.tenant_id = v_tenant_id
    AND f.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.uim_form_records existing
      WHERE existing.tenant_id = v_tenant_id
        AND existing.franchise_id = f.id
        AND existing.node_key = seed.node_key
        AND existing.deleted_at IS NULL
    );
END;
$$;
