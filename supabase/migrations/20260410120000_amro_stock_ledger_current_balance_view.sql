BEGIN;

CREATE OR REPLACE VIEW public.amro_stock_ledger_current_balance AS
SELECT
  l.tenant_id,
  l.franchise_id,
  l.part_inventory_id,
  p.part_number,
  p.warehouse_location,
  SUM(
    CASE
      WHEN l.movement_type IN ('receipt', 'transfer_in', 'return') THEN l.quantity_delta
      WHEN l.movement_type IN ('issue', 'consume', 'transfer_out', 'reserve') THEN -l.quantity_delta
      WHEN l.movement_type = 'adjustment' THEN l.quantity_delta
      WHEN l.movement_type = 'release' THEN -l.quantity_delta
      ELSE 0
    END
  ) AS ledger_quantity_on_hand,
  SUM(
    CASE
      WHEN l.movement_type = 'reserve' THEN l.quantity_delta
      WHEN l.movement_type = 'release' THEN -l.quantity_delta
      ELSE 0
    END
  ) AS ledger_quantity_reserved,
  SUM(
    CASE
      WHEN l.movement_type IN ('receipt', 'transfer_in', 'return') THEN l.quantity_delta
      WHEN l.movement_type IN ('issue', 'consume', 'transfer_out', 'reserve', 'release') THEN -l.quantity_delta
      WHEN l.movement_type = 'adjustment' THEN l.quantity_delta
      ELSE 0
    END
  ) AS ledger_quantity_available,
  SUM(l.total_cost) AS total_ledger_cost,
  AVG(l.unit_cost) FILTER (WHERE l.movement_type IN ('receipt', 'transfer_in')) AS avg_receipt_unit_cost,
  COUNT(*) AS transaction_count,
  MAX(l.effective_at) AS last_transaction_at,
  MAX(l.created_at) AS updated_at
FROM public.amro_stock_ledger_transactions l
JOIN public.parts_inventory p
  ON p.id = l.part_inventory_id
  AND p.tenant_id = l.tenant_id
WHERE l.is_voided = false
GROUP BY
  l.tenant_id,
  l.franchise_id,
  l.part_inventory_id,
  p.part_number,
  p.warehouse_location;

CREATE INDEX IF NOT EXISTS idx_amro_stock_ledger_balance_tenant_part
  ON public.amro_stock_ledger_transactions (tenant_id, part_inventory_id)
  WHERE is_voided = false;

COMMIT;
