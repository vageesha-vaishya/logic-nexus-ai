-- Phase 7 UIM Step 9i — rebuild 4 AMRO views on uim.* mirror tables.
--
-- Created 4 uim.v_* views that produce the same data as the existing
-- public.amro_* views, but sourced from uim.* mirror tables instead
-- of the legacy public.amro_* tables. These uim.v_* views survive
-- slice 9j's drop of public.amro_*.
--
-- Public PostgREST aliases (public.uim_v_*) follow the 9d pattern.
--
-- Cross-schema dep on public.parts_inventory (4,783 rows) is
-- intentional — that table has NOT been mirrored to uim yet.
-- When uim.parts_inventory lands in a follow-up slice, the view
-- definitions get a one-line swap.
--
-- Applied to prod 2026-06-03; smoke verified:
--   audit_export       99 ↔ 99
--   balance_summary    4,783 ↔ 4,783
--   ledger_curr_bal    40 ↔ 40
--   valuation_summary  40 ↔ 40
-- (Full row-count parity across all 4 views.)

BEGIN;

CREATE OR REPLACE VIEW uim.v_stock_balance_summary AS
SELECT
  p.tenant_id, p.id AS part_inventory_id,
  p.part_number, p.warehouse_location,
  p.quantity_on_hand AS current_on_hand,
  p.quantity_reserved AS current_reserved,
  COALESCE(sum(
    CASE
      WHEN l.movement_type = ANY (ARRAY['receipt','transfer_in','return','adjustment','release']) THEN l.quantity_delta
      WHEN l.movement_type = ANY (ARRAY['issue','consume','transfer_out','reserve'])              THEN l.quantity_delta
      ELSE 0::numeric
    END), 0::numeric) AS ledger_net_quantity,
  max(l.effective_at) AS last_ledger_at
FROM public.parts_inventory p
LEFT JOIN uim.stock_ledger_transactions l
  ON l.part_inventory_id = p.id AND l.tenant_id = p.tenant_id
GROUP BY p.tenant_id, p.id, p.part_number, p.warehouse_location, p.quantity_on_hand, p.quantity_reserved;

CREATE OR REPLACE VIEW uim.v_stock_ledger_current_balance AS
SELECT
  l.tenant_id, l.franchise_id, l.part_inventory_id,
  p.part_number, p.warehouse_location,
  sum(CASE
    WHEN l.movement_type = ANY (ARRAY['receipt','transfer_in','return']) THEN l.quantity_delta
    WHEN l.movement_type = ANY (ARRAY['issue','consume','transfer_out','reserve']) THEN -l.quantity_delta
    WHEN l.movement_type = 'adjustment' THEN l.quantity_delta
    WHEN l.movement_type = 'release' THEN -l.quantity_delta
    ELSE 0::numeric END) AS ledger_quantity_on_hand,
  sum(CASE
    WHEN l.movement_type = 'reserve' THEN l.quantity_delta
    WHEN l.movement_type = 'release' THEN -l.quantity_delta
    ELSE 0::numeric END) AS ledger_quantity_reserved,
  sum(CASE
    WHEN l.movement_type = ANY (ARRAY['receipt','transfer_in','return']) THEN l.quantity_delta
    WHEN l.movement_type = ANY (ARRAY['issue','consume','transfer_out','reserve','release']) THEN -l.quantity_delta
    WHEN l.movement_type = 'adjustment' THEN l.quantity_delta
    ELSE 0::numeric END) AS ledger_quantity_available,
  sum(l.total_cost) AS total_ledger_cost,
  avg(l.unit_cost) FILTER (WHERE l.movement_type = ANY (ARRAY['receipt','transfer_in'])) AS avg_receipt_unit_cost,
  count(*) AS transaction_count,
  max(l.effective_at) AS last_transaction_at,
  max(l.created_at) AS updated_at
FROM uim.stock_ledger_transactions l
JOIN public.parts_inventory p ON p.id = l.part_inventory_id AND p.tenant_id = l.tenant_id
WHERE l.is_voided = false
GROUP BY l.tenant_id, l.franchise_id, l.part_inventory_id, p.part_number, p.warehouse_location;

CREATE OR REPLACE VIEW uim.v_stock_valuation_summary AS
SELECT
  v.tenant_id, v.part_inventory_id, p.part_number, v.valuation_method,
  COALESCE(sum(v.available_quantity), 0::numeric) AS total_available_quantity,
  COALESCE(sum(v.available_quantity * v.unit_cost), 0::numeric) AS total_available_value,
  max(v.received_at) AS last_layer_received_at
FROM uim.stock_valuation_layers v
JOIN public.parts_inventory p ON p.id = v.part_inventory_id AND p.tenant_id = v.tenant_id
GROUP BY v.tenant_id, v.part_inventory_id, p.part_number, v.valuation_method;

CREATE OR REPLACE VIEW uim.v_stock_audit_export AS
SELECT
  tenant_id, franchise_id, actor_user_id,
  event_type, event_category, reference_id,
  event_payload, immutable_hash, created_at
FROM uim.stock_audit_timeline
ORDER BY created_at DESC;

CREATE OR REPLACE VIEW public.uim_v_stock_balance_summary       AS SELECT * FROM uim.v_stock_balance_summary;
CREATE OR REPLACE VIEW public.uim_v_stock_ledger_current_balance AS SELECT * FROM uim.v_stock_ledger_current_balance;
CREATE OR REPLACE VIEW public.uim_v_stock_valuation_summary     AS SELECT * FROM uim.v_stock_valuation_summary;
CREATE OR REPLACE VIEW public.uim_v_stock_audit_export          AS SELECT * FROM uim.v_stock_audit_export;

GRANT SELECT ON uim.v_stock_balance_summary       TO authenticated;
GRANT SELECT ON uim.v_stock_ledger_current_balance TO authenticated;
GRANT SELECT ON uim.v_stock_valuation_summary     TO authenticated;
GRANT SELECT ON uim.v_stock_audit_export          TO authenticated;

GRANT SELECT ON public.uim_v_stock_balance_summary       TO authenticated;
GRANT SELECT ON public.uim_v_stock_ledger_current_balance TO authenticated;
GRANT SELECT ON public.uim_v_stock_valuation_summary     TO authenticated;
GRANT SELECT ON public.uim_v_stock_audit_export          TO authenticated;

COMMIT;
