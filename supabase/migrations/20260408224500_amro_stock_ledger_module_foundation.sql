BEGIN;

CREATE TABLE IF NOT EXISTS public.amro_stock_ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  part_inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (
    movement_type IN (
      'receipt',
      'issue',
      'consume',
      'reserve',
      'release',
      'adjustment',
      'transfer_in',
      'transfer_out',
      'return'
    )
  ),
  valuation_method text NOT NULL DEFAULT 'weighted_average' CHECK (
    valuation_method IN ('fifo', 'lifo', 'weighted_average')
  ),
  quantity_delta numeric(18,6) NOT NULL CHECK (quantity_delta <> 0),
  balance_after numeric(18,6),
  unit_cost numeric(18,6) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric(18,6) GENERATED ALWAYS AS (abs(quantity_delta) * unit_cost) STORED,
  currency text NOT NULL DEFAULT 'USD',
  effective_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid,
  source_module text,
  source_reference text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_ledger_txn_tenant_part_effective
  ON public.amro_stock_ledger_transactions (tenant_id, part_inventory_id, effective_at DESC);

CREATE INDEX IF NOT EXISTS idx_amro_stock_ledger_txn_tenant_type_effective
  ON public.amro_stock_ledger_transactions (tenant_id, movement_type, effective_at DESC);

CREATE INDEX IF NOT EXISTS idx_amro_stock_ledger_txn_batch
  ON public.amro_stock_ledger_transactions (tenant_id, batch_id);

CREATE TABLE IF NOT EXISTS public.amro_stock_valuation_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  part_inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  valuation_method text NOT NULL CHECK (valuation_method IN ('fifo', 'lifo', 'weighted_average')),
  inbound_transaction_id uuid REFERENCES public.amro_stock_ledger_transactions(id) ON DELETE SET NULL,
  available_quantity numeric(18,6) NOT NULL CHECK (available_quantity >= 0),
  unit_cost numeric(18,6) NOT NULL CHECK (unit_cost >= 0),
  consumed_quantity numeric(18,6) NOT NULL DEFAULT 0 CHECK (consumed_quantity >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_valuation_layers_tenant_part_method
  ON public.amro_stock_valuation_layers (tenant_id, part_inventory_id, valuation_method, received_at DESC);

CREATE TABLE IF NOT EXISTS public.amro_stock_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id uuid REFERENCES public.franchises(id) ON DELETE SET NULL,
  run_status text NOT NULL DEFAULT 'pending' CHECK (run_status IN ('pending', 'running', 'completed', 'failed')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_reconcile_runs_tenant_status
  ON public.amro_stock_reconciliation_runs (tenant_id, run_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.amro_stock_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.amro_stock_reconciliation_runs(id) ON DELETE CASCADE,
  part_inventory_id uuid NOT NULL REFERENCES public.parts_inventory(id) ON DELETE CASCADE,
  expected_quantity numeric(18,6) NOT NULL,
  actual_quantity numeric(18,6) NOT NULL,
  variance_quantity numeric(18,6) NOT NULL,
  variance_cost numeric(18,6) NOT NULL DEFAULT 0,
  variance_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amro_stock_reconcile_items_tenant_run
  ON public.amro_stock_reconciliation_items (tenant_id, run_id, abs(variance_quantity) DESC);

CREATE OR REPLACE VIEW public.amro_stock_balance_summary AS
SELECT
  p.tenant_id,
  p.id AS part_inventory_id,
  p.part_number,
  p.warehouse_location,
  p.quantity_on_hand AS current_on_hand,
  p.quantity_reserved AS current_reserved,
  COALESCE(SUM(CASE
    WHEN l.movement_type IN ('receipt', 'transfer_in', 'return', 'adjustment', 'release') THEN l.quantity_delta
    WHEN l.movement_type IN ('issue', 'consume', 'transfer_out', 'reserve') THEN l.quantity_delta
    ELSE 0
  END), 0) AS ledger_net_quantity,
  MAX(l.effective_at) AS last_ledger_at
FROM public.parts_inventory p
LEFT JOIN public.amro_stock_ledger_transactions l
  ON l.part_inventory_id = p.id
  AND l.tenant_id = p.tenant_id
GROUP BY p.tenant_id, p.id, p.part_number, p.warehouse_location, p.quantity_on_hand, p.quantity_reserved;

CREATE OR REPLACE VIEW public.amro_stock_valuation_summary AS
SELECT
  v.tenant_id,
  v.part_inventory_id,
  p.part_number,
  v.valuation_method,
  COALESCE(SUM(v.available_quantity), 0) AS total_available_quantity,
  COALESCE(SUM(v.available_quantity * v.unit_cost), 0) AS total_available_value,
  MAX(v.received_at) AS last_layer_received_at
FROM public.amro_stock_valuation_layers v
JOIN public.parts_inventory p
  ON p.id = v.part_inventory_id
  AND p.tenant_id = v.tenant_id
GROUP BY v.tenant_id, v.part_inventory_id, p.part_number, v.valuation_method;

COMMIT;
