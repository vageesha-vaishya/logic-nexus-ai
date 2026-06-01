-- Phase 6 Step 58 — CREATE SCHEMA amro + 32 unambiguous LIKE-mirrors.
--
-- Closes amro.md §10.1 (the 'amro schema exists' acceptance) for
-- the 32 tables whose canonical home is unambiguously the AMRO
-- module. 24 inventory-adjacent tables (amro_inventory_*,
-- amro_item_master, amro_item_*, amro_part_*, amro_parts_*,
-- amro_stock_*, amro_uim_*) are deferred pending the amro.md §9.1
-- AMRO ↔ UIM inventory-boundary decision — each could land in
-- amro.* OR uim.* depending on the call, and shipping them prematurely
-- would create a deletion-and-re-create dance later.
--
-- First real demonstration of Step 57's gen_dual_write_trigger
-- codegen at scale: 32 dual-write triggers as 32 two-line spec
-- invocations instead of 32 × ~35-line DO-block + format() ladders.
--
-- Per-table per-mirror work:
--   1. CREATE TABLE amro.<stripped> (LIKE public.amro_<stripped>
--      INCLUDING DEFAULTS INCLUDING CONSTRAINTS) — same as the
--      Phase 5/6 pattern across compliance/sales/finance/logistics.
--      INCLUDING CONSTRAINTS copies CHECKs and NOT NULLs but NOT
--      foreign keys (per PG docs); mirror tables are read-models
--      that don't need FK enforcement.
--   2. ADD PRIMARY KEY (id) — codegen + backfill assume id PK.
--      All 32 source tables verified to have an `id` column +
--      `tenant_id` column pre-migration.
--   3. ENABLE RLS + tenant_select policy + GRANTs.
--   4. Backfill: INSERT INTO amro.X SELECT * FROM public.amro_X
--      ON CONFLICT (id) DO NOTHING. Rows large enough to slow this
--      down would be a surprise — most are operational/audit tables
--      with bounded row counts.
--   5. core.gen_dual_write_trigger spec → installs the AFTER
--      INSERT|UPDATE|DELETE trigger on the source.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Schema
-- ══════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS amro;
COMMENT ON SCHEMA amro IS
  'Phase 6 Step 58 — AMRO (Aircraft Maintenance, Repair & Overhaul) canonical schema. Mirrors public.amro_* tables minus the 24 inventory-adjacent ones deferred pending the amro.md §9.1 boundary decision with UIM.';

-- ══════════════════════════════════════════════════════════════════════
-- 2. Table mirrors + dual-writes + backfill (data-driven loop)
-- ══════════════════════════════════════════════════════════════════════

DO $do$
DECLARE
  v_src_full   text;
  v_tgt_short  text;
  v_tgt_full   text;
  v_src_name   text;
  v_tables text[] := ARRAY[
    'amro_aog_alerts',
    'amro_calibration_logs',
    'amro_certificates_release_service',
    'amro_compliance_ad_sb_registry',
    'amro_compliance_directives',
    'amro_compliance_documents',
    'amro_compliance_events',
    'amro_compliance_requirements_enhanced',
    'amro_emergency_work_packages',
    'amro_facilities_locations',
    'amro_maintenance_triggers',
    'amro_non_scheduled_tasks',
    'amro_operational_telemetry',
    'amro_overview_kpi_snapshots',
    'amro_predictive_maintenance_recommendations',
    'amro_purchase_order_items',
    'amro_purchase_orders',
    'amro_request_idempotency',
    'amro_resource_pools',
    'amro_sla_definitions',
    'amro_task_dependencies',
    'amro_task_time_logs',
    'amro_tool_maintenance_history',
    'amro_tool_reservations',
    'amro_tooling_instances',
    'amro_tooling_registry',
    'amro_work_order_audit_log',
    'amro_work_order_compliance_records',
    'amro_work_order_materials',
    'amro_work_order_resource_assignments',
    'amro_work_order_template_categories',
    'amro_work_order_template_versions'
  ];
BEGIN
  FOREACH v_src_name IN ARRAY v_tables LOOP
    v_src_full  := 'public.' || v_src_name;
    -- strip 'amro_' prefix for the target schema-qualified name
    v_tgt_short := substring(v_src_name FROM 6);
    v_tgt_full  := 'amro.' || v_tgt_short;

    -- Create mirror with LIKE; mirror PK + RLS state copied via constraints
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s (LIKE %s INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      v_tgt_full, v_src_full
    );

    -- Add PK on id if not present (LIKE INCLUDING CONSTRAINTS does NOT
    -- copy PRIMARY KEY constraint in PG ≥10 when the parent's PK is on
    -- a column that's part of an inherited index)
    EXECUTE format($pk$
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_index i
          JOIN pg_class c ON c.oid = i.indrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='amro' AND c.relname=%L AND i.indisprimary
        ) THEN
          ALTER TABLE %s ADD PRIMARY KEY (id);
        END IF;
      END $$;
    $pk$, v_tgt_short, v_tgt_full);

    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_tgt_full);

    EXECUTE format(
      'CREATE POLICY %I ON %s FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))',
      v_tgt_short || '_tenant_select', v_tgt_full
    );

    EXECUTE format('GRANT SELECT ON %s TO authenticated', v_tgt_full);
    EXECUTE format('GRANT ALL    ON %s TO service_role',  v_tgt_full);

    -- Backfill
    EXECUTE format(
      'INSERT INTO %s SELECT * FROM %s ON CONFLICT (id) DO NOTHING',
      v_tgt_full, v_src_full
    );

    -- Dual-write trigger via Step 57 codegen
    PERFORM core.gen_dual_write_trigger(jsonb_build_object(
      'source_table', v_src_full,
      'target_table', v_tgt_full
    ));

    RAISE NOTICE 'mirrored % → %', v_src_full, v_tgt_full;
  END LOOP;
END $do$;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Drift monitor (mirrors the compliance.base_drift_check pattern)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION amro.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = amro, public, pg_catalog
AS $$
DECLARE
  v_src_name  text;
  v_tgt_short text;
  v_src_count bigint;
  v_tgt_count bigint;
  v_tables text[] := ARRAY[
    'amro_aog_alerts','amro_calibration_logs','amro_certificates_release_service',
    'amro_compliance_ad_sb_registry','amro_compliance_directives','amro_compliance_documents',
    'amro_compliance_events','amro_compliance_requirements_enhanced',
    'amro_emergency_work_packages','amro_facilities_locations','amro_maintenance_triggers',
    'amro_non_scheduled_tasks','amro_operational_telemetry','amro_overview_kpi_snapshots',
    'amro_predictive_maintenance_recommendations','amro_purchase_order_items','amro_purchase_orders',
    'amro_request_idempotency','amro_resource_pools','amro_sla_definitions',
    'amro_task_dependencies','amro_task_time_logs','amro_tool_maintenance_history',
    'amro_tool_reservations','amro_tooling_instances','amro_tooling_registry',
    'amro_work_order_audit_log','amro_work_order_compliance_records','amro_work_order_materials',
    'amro_work_order_resource_assignments','amro_work_order_template_categories',
    'amro_work_order_template_versions'
  ];
BEGIN
  FOREACH v_src_name IN ARRAY v_tables LOOP
    v_tgt_short := substring(v_src_name FROM 6);
    EXECUTE format('SELECT count(*) FROM public.%I', v_src_name) INTO v_src_count;
    EXECUTE format('SELECT count(*) FROM amro.%I',   v_tgt_short) INTO v_tgt_count;
    metric := v_tgt_short || '_minus_amro';
    delta  := v_src_count - v_tgt_count;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION amro.base_drift_check() IS
  'Phase 6 Step 58 — per-table drift between public.amro_* source and amro.* mirror. All 32 deltas should remain 0 after Step 58 backfill + ongoing dual-write triggers.';

GRANT EXECUTE ON FUNCTION amro.base_drift_check() TO service_role;
