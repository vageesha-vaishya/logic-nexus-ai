-- Phase 6 Step 61 — CREATE SCHEMA uim + 14 inventory-canonical mirrors.
--
-- Implements ADR-0013 (AMRO ↔ UIM boundary). Of the 19 tables the
-- ADR classifies as "uim.* canonical inventory":
--   - 14 are real tables (relkind='r')   → mirrored here
--   -  5 are views     (relkind='v')     → deferred to Step 61b
--     (health_overview, audit_export, balance_summary,
--      ledger_current_balance, valuation_summary)
--     Views can't be LIKE-mirrored; each needs an explicit
--     CREATE VIEW uim.X AS SELECT … over the new uim.* tables.
--     Deferred until a concrete consumer reads from uim.*.
--
-- Same shape as Step 58 (the AMRO 32-table batch):
--   1. CREATE TABLE uim.<stripped> (LIKE public.amro_<stripped>
--      INCLUDING DEFAULTS INCLUDING CONSTRAINTS)
--   2. Add primary key on id
--   3. ENABLE RLS + tenant_select policy + GRANTs
--   4. Backfill via INSERT...SELECT...ON CONFLICT (id) DO NOTHING
--   5. Dual-write trigger via core.gen_dual_write_trigger (Step 57)
--
-- All 14 tables are small (largest = stock_reconciliation_items at
-- ~5000 rows). Backfill is sub-second.

CREATE SCHEMA IF NOT EXISTS uim;
COMMENT ON SCHEMA uim IS
  'Phase 6 Step 61 — UIM (Universal Inventory Master + Integration). Canonical inventory state per ADR-0013. AMRO uses these as primary store; aviation-regulatory metadata lives in amro.* extension tables keyed by uim.item_master.id.';

DO $do$
DECLARE
  v_src_full   text;
  v_tgt_short  text;
  v_tgt_full   text;
  v_src_name   text;
  -- 14 real tables (excludes the 5 views deferred to 61b)
  v_tables text[] := ARRAY[
    'amro_item_master',
    'amro_item_uom_conversions',
    'amro_item_cross_references',
    'amro_part_interchangeability',
    'amro_inventory_scan_events',
    'amro_inventory_reorder_queue',
    'amro_stock_ledger_transactions',
    'amro_stock_approval_queue',
    'amro_stock_audit_timeline',
    'amro_stock_period_closes',
    'amro_stock_reconciliation_items',
    'amro_stock_reconciliation_runs',
    'amro_stock_valuation_consumptions',
    'amro_stock_valuation_layers'
  ];
BEGIN
  FOREACH v_src_name IN ARRAY v_tables LOOP
    v_src_full  := 'public.' || v_src_name;
    -- strip 'amro_' prefix (5 chars + 1 for underscore = 6)
    v_tgt_short := substring(v_src_name FROM 6);
    v_tgt_full  := 'uim.' || v_tgt_short;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s (LIKE %s INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      v_tgt_full, v_src_full
    );

    -- Add PK if not inherited
    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='uim' AND c.relname=v_tgt_short AND i.indisprimary
    ) THEN
      EXECUTE format('ALTER TABLE %s ADD PRIMARY KEY (id)', v_tgt_full);
    END IF;

    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_tgt_full);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))',
      v_tgt_short || '_tenant_select', v_tgt_full
    );
    EXECUTE format('GRANT SELECT ON %s TO authenticated', v_tgt_full);
    EXECUTE format('GRANT ALL    ON %s TO service_role',  v_tgt_full);

    EXECUTE format(
      'INSERT INTO %s SELECT * FROM %s ON CONFLICT (id) DO NOTHING',
      v_tgt_full, v_src_full
    );

    PERFORM core.gen_dual_write_trigger(jsonb_build_object(
      'source_table', v_src_full,
      'target_table', v_tgt_full
    ));

    RAISE NOTICE 'mirrored % -> %', v_src_full, v_tgt_full;
  END LOOP;
END $do$;

-- Drift check
CREATE OR REPLACE FUNCTION uim.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = uim, public, pg_catalog
AS $fn$
DECLARE
  v_src_name  text;
  v_tgt_short text;
  v_src_count bigint;
  v_tgt_count bigint;
  v_tables text[] := ARRAY[
    'amro_item_master','amro_item_uom_conversions','amro_item_cross_references',
    'amro_part_interchangeability','amro_inventory_scan_events','amro_inventory_reorder_queue',
    'amro_stock_ledger_transactions','amro_stock_approval_queue','amro_stock_audit_timeline',
    'amro_stock_period_closes','amro_stock_reconciliation_items','amro_stock_reconciliation_runs',
    'amro_stock_valuation_consumptions','amro_stock_valuation_layers'
  ];
BEGIN
  FOREACH v_src_name IN ARRAY v_tables LOOP
    v_tgt_short := substring(v_src_name FROM 6);
    EXECUTE format('SELECT count(*) FROM public.%I', v_src_name) INTO v_src_count;
    EXECUTE format('SELECT count(*) FROM uim.%I',    v_tgt_short) INTO v_tgt_count;
    metric := v_tgt_short || '_minus_uim';
    delta  := v_src_count - v_tgt_count;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

COMMENT ON FUNCTION uim.base_drift_check() IS
  'Phase 6 Step 61 — per-table drift between public.amro_* source and uim.* mirror per ADR-0013. All 14 deltas should remain 0.';

GRANT EXECUTE ON FUNCTION uim.base_drift_check() TO service_role;
