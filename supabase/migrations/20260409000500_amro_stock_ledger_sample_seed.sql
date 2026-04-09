BEGIN;

CREATE TEMP TABLE IF NOT EXISTS tmp_amro_stock_seed_parts (
  tenant_id uuid NOT NULL,
  franchise_id uuid NULL,
  part_inventory_id uuid NOT NULL,
  part_number text NOT NULL,
  quantity_on_hand numeric(18,6) NOT NULL,
  warehouse_location text NULL
) ON COMMIT DROP;

TRUNCATE tmp_amro_stock_seed_parts;

INSERT INTO tmp_amro_stock_seed_parts (
  tenant_id,
  franchise_id,
  part_inventory_id,
  part_number,
  quantity_on_hand,
  warehouse_location
)
SELECT
  p.tenant_id,
  p.franchise_id,
  p.id,
  p.part_number,
  COALESCE(p.quantity_on_hand, 0),
  p.warehouse_location
FROM public.parts_inventory p
WHERE COALESCE(p.status, 'available') <> 'retired'
ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST
LIMIT 40;

-- 1) Inbound receipt samples (idempotent by source_reference)
INSERT INTO public.amro_stock_ledger_transactions (
  tenant_id,
  franchise_id,
  part_inventory_id,
  movement_type,
  valuation_method,
  quantity_delta,
  balance_after,
  unit_cost,
  currency,
  effective_at,
  source_module,
  source_reference,
  notes,
  metadata,
  created_at,
  updated_at
)
SELECT
  s.tenant_id,
  s.franchise_id,
  s.part_inventory_id,
  'receipt',
  CASE
    WHEN row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) % 3 = 0 THEN 'fifo'
    WHEN row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) % 3 = 1 THEN 'lifo'
    ELSE 'weighted_average'
  END,
  GREATEST(5, LEAST(25, FLOOR(s.quantity_on_hand / 2) + 3)),
  s.quantity_on_hand + GREATEST(5, LEAST(25, FLOOR(s.quantity_on_hand / 2) + 3)),
  25 + (row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) * 1.75),
  'USD',
  now() - ((row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) % 20) || ' days')::interval,
  'amro_stock_seed',
  'SEED-RECEIPT-' || s.part_inventory_id::text,
  'Sample receipt generated from existing inventory snapshot',
  jsonb_build_object(
    'seed_source', 'amro-stock-ledger-sample',
    'warehouse_location', s.warehouse_location
  ),
  now(),
  now()
FROM tmp_amro_stock_seed_parts s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.amro_stock_ledger_transactions t
  WHERE t.tenant_id = s.tenant_id
    AND t.source_reference = 'SEED-RECEIPT-' || s.part_inventory_id::text
);

-- 2) Outbound issue samples (idempotent by source_reference)
INSERT INTO public.amro_stock_ledger_transactions (
  tenant_id,
  franchise_id,
  part_inventory_id,
  movement_type,
  valuation_method,
  quantity_delta,
  balance_after,
  unit_cost,
  currency,
  effective_at,
  source_module,
  source_reference,
  notes,
  metadata,
  created_at,
  updated_at
)
SELECT
  s.tenant_id,
  s.franchise_id,
  s.part_inventory_id,
  'issue',
  CASE
    WHEN row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) % 3 = 0 THEN 'fifo'
    WHEN row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) % 3 = 1 THEN 'lifo'
    ELSE 'weighted_average'
  END,
  -GREATEST(1, LEAST(8, FLOOR(s.quantity_on_hand / 4))),
  GREATEST(0, s.quantity_on_hand - GREATEST(1, LEAST(8, FLOOR(s.quantity_on_hand / 4)))),
  27 + (row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) * 1.2),
  'USD',
  now() - ((row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) % 10) || ' days')::interval,
  'amro_stock_seed',
  'SEED-ISSUE-' || s.part_inventory_id::text,
  'Sample issue generated from existing inventory snapshot',
  jsonb_build_object(
    'seed_source', 'amro-stock-ledger-sample',
    'warehouse_location', s.warehouse_location
  ),
  now(),
  now()
FROM tmp_amro_stock_seed_parts s
WHERE s.quantity_on_hand > 2
  AND NOT EXISTS (
    SELECT 1
    FROM public.amro_stock_ledger_transactions t
    WHERE t.tenant_id = s.tenant_id
      AND t.source_reference = 'SEED-ISSUE-' || s.part_inventory_id::text
  );

-- 3) Adjustment samples on a subset (idempotent by source_reference)
INSERT INTO public.amro_stock_ledger_transactions (
  tenant_id,
  franchise_id,
  part_inventory_id,
  movement_type,
  valuation_method,
  quantity_delta,
  balance_after,
  unit_cost,
  currency,
  effective_at,
  source_module,
  source_reference,
  notes,
  metadata,
  created_at,
  updated_at
)
WITH ranked_parts AS (
  SELECT
    s.*,
    row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.part_number) AS rn
  FROM tmp_amro_stock_seed_parts s
)
SELECT
  s.tenant_id,
  s.franchise_id,
  s.part_inventory_id,
  'adjustment',
  'weighted_average',
  CASE
    WHEN s.rn % 2 = 0 THEN 2
    ELSE -1
  END,
  GREATEST(
    0,
    s.quantity_on_hand + CASE
      WHEN s.rn % 2 = 0 THEN 2
      ELSE -1
    END
  ),
  30 + (s.rn * 0.9),
  'USD',
  now() - ((s.rn % 7) || ' days')::interval,
  'amro_stock_seed',
  'SEED-ADJUST-' || s.part_inventory_id::text,
  'Sample adjustment generated for reconciliation test',
  jsonb_build_object(
    'seed_source', 'amro-stock-ledger-sample',
    'warehouse_location', s.warehouse_location
  ),
  now(),
  now()
FROM ranked_parts s
WHERE s.rn <= 12
  AND NOT EXISTS (
    SELECT 1
    FROM public.amro_stock_ledger_transactions t
    WHERE t.tenant_id = s.tenant_id
      AND t.source_reference = 'SEED-ADJUST-' || s.part_inventory_id::text
  );

-- 4) Seed valuation layers for receipt records if missing
INSERT INTO public.amro_stock_valuation_layers (
  tenant_id,
  franchise_id,
  part_inventory_id,
  valuation_method,
  inbound_transaction_id,
  available_quantity,
  unit_cost,
  consumed_quantity,
  received_at,
  metadata,
  created_at,
  updated_at
)
SELECT
  t.tenant_id,
  t.franchise_id,
  t.part_inventory_id,
  t.valuation_method,
  t.id,
  ABS(t.quantity_delta),
  t.unit_cost,
  0,
  t.effective_at,
  jsonb_build_object('seed_source', 'amro-stock-ledger-sample', 'from_transaction', t.id::text),
  now(),
  now()
FROM public.amro_stock_ledger_transactions t
WHERE t.source_module = 'amro_stock_seed'
  AND t.movement_type = 'receipt'
  AND NOT EXISTS (
    SELECT 1
    FROM public.amro_stock_valuation_layers v
    WHERE v.tenant_id = t.tenant_id
      AND v.inbound_transaction_id = t.id
  );

-- 5) Seed immutable audit rows for sample transactions
INSERT INTO public.amro_stock_audit_timeline (
  tenant_id,
  franchise_id,
  actor_user_id,
  event_type,
  event_category,
  reference_id,
  event_payload,
  immutable_hash,
  created_at
)
SELECT
  t.tenant_id,
  t.franchise_id,
  NULL,
  'ledger.sample.seeded',
  'stock-ledger',
  t.id::text,
  jsonb_build_object(
    'source_reference', t.source_reference,
    'movement_type', t.movement_type,
    'quantity_delta', t.quantity_delta,
    'unit_cost', t.unit_cost
  ),
  md5(
    t.tenant_id::text || '|' ||
    t.id::text || '|' ||
    COALESCE(t.source_reference, '') || '|' ||
    t.movement_type || '|' ||
    t.quantity_delta::text || '|' ||
    t.unit_cost::text
  ),
  now()
FROM public.amro_stock_ledger_transactions t
WHERE t.source_module = 'amro_stock_seed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.amro_stock_audit_timeline a
    WHERE a.tenant_id = t.tenant_id
      AND a.reference_id = t.id::text
      AND a.event_type = 'ledger.sample.seeded'
  );

COMMIT;
