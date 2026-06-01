-- Phase 6 Step 62 — AMRO extension-table mirrors per ADR-0013.
--
-- Of the 3 tables the ADR classifies as "amro.* aviation-regulatory
-- extension":
--   - 2 are real tables → mirrored here
--   - 1 is a view (amro_parts_demand_overview) → deferred to the
--     same view-recreation slice that handles the 5 UIM views from
--     Step 61.
--
-- Includes an explicit rename per the ADR mapping table:
--   public.amro_inventory_work_order_links → amro.work_order_item_links
-- The semantic shift (inventory_work_order_links → work_order_item_links)
-- reflects the boundary: items live in UIM; AMRO records "this work
-- order consumed these items" via the link table.
--
-- The codegen handles arbitrary source/target name mappings; both
-- mirrors go through it identically. RLS + grants + backfill + dual-
-- write trigger follow the Step 58 / Step 61 pattern exactly.

DO $do$
DECLARE
  v_src_full   text;
  v_tgt_full   text;
  v_tgt_short  text;
  v_pair       record;
  -- (source_basename, target_short_name) — explicit because Step 62
  -- has one rename that doesn't fit the prefix-strip rule.
  v_pairs jsonb := jsonb_build_array(
    jsonb_build_object('src','amro_inventory_work_order_links', 'tgt','work_order_item_links'),
    jsonb_build_object('src','amro_parts_mro_workflow_events',  'tgt','parts_mro_workflow_events')
  );
BEGIN
  FOR v_pair IN SELECT (p->>'src') AS src, (p->>'tgt') AS tgt
                FROM jsonb_array_elements(v_pairs) p LOOP
    v_src_full  := 'public.' || v_pair.src;
    v_tgt_short := v_pair.tgt;
    v_tgt_full  := 'amro.' || v_tgt_short;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %s (LIKE %s INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      v_tgt_full, v_src_full
    );

    IF NOT EXISTS (
      SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='amro' AND c.relname=v_tgt_short AND i.indisprimary
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

-- Extend amro.base_drift_check from Step 58 by replacing with a
-- version that includes the 2 new tables. Step 58's original 32-table
-- coverage stays intact.
CREATE OR REPLACE FUNCTION amro.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = amro, public, pg_catalog
AS $fn$
DECLARE
  v_pair record;
  v_src_count bigint;
  v_tgt_count bigint;
  -- Step 58's 32 + Step 62's 2 = 34 mirrors tracked
  v_pairs jsonb := jsonb_build_array(
    -- Step 58 (prefix-strip)
    jsonb_build_object('src','amro_aog_alerts','tgt','aog_alerts'),
    jsonb_build_object('src','amro_calibration_logs','tgt','calibration_logs'),
    jsonb_build_object('src','amro_certificates_release_service','tgt','certificates_release_service'),
    jsonb_build_object('src','amro_compliance_ad_sb_registry','tgt','compliance_ad_sb_registry'),
    jsonb_build_object('src','amro_compliance_directives','tgt','compliance_directives'),
    jsonb_build_object('src','amro_compliance_documents','tgt','compliance_documents'),
    jsonb_build_object('src','amro_compliance_events','tgt','compliance_events'),
    jsonb_build_object('src','amro_compliance_requirements_enhanced','tgt','compliance_requirements_enhanced'),
    jsonb_build_object('src','amro_emergency_work_packages','tgt','emergency_work_packages'),
    jsonb_build_object('src','amro_facilities_locations','tgt','facilities_locations'),
    jsonb_build_object('src','amro_maintenance_triggers','tgt','maintenance_triggers'),
    jsonb_build_object('src','amro_non_scheduled_tasks','tgt','non_scheduled_tasks'),
    jsonb_build_object('src','amro_operational_telemetry','tgt','operational_telemetry'),
    jsonb_build_object('src','amro_overview_kpi_snapshots','tgt','overview_kpi_snapshots'),
    jsonb_build_object('src','amro_predictive_maintenance_recommendations','tgt','predictive_maintenance_recommendations'),
    jsonb_build_object('src','amro_purchase_order_items','tgt','purchase_order_items'),
    jsonb_build_object('src','amro_purchase_orders','tgt','purchase_orders'),
    jsonb_build_object('src','amro_request_idempotency','tgt','request_idempotency'),
    jsonb_build_object('src','amro_resource_pools','tgt','resource_pools'),
    jsonb_build_object('src','amro_sla_definitions','tgt','sla_definitions'),
    jsonb_build_object('src','amro_task_dependencies','tgt','task_dependencies'),
    jsonb_build_object('src','amro_task_time_logs','tgt','task_time_logs'),
    jsonb_build_object('src','amro_tool_maintenance_history','tgt','tool_maintenance_history'),
    jsonb_build_object('src','amro_tool_reservations','tgt','tool_reservations'),
    jsonb_build_object('src','amro_tooling_instances','tgt','tooling_instances'),
    jsonb_build_object('src','amro_tooling_registry','tgt','tooling_registry'),
    jsonb_build_object('src','amro_work_order_audit_log','tgt','work_order_audit_log'),
    jsonb_build_object('src','amro_work_order_compliance_records','tgt','work_order_compliance_records'),
    jsonb_build_object('src','amro_work_order_materials','tgt','work_order_materials'),
    jsonb_build_object('src','amro_work_order_resource_assignments','tgt','work_order_resource_assignments'),
    jsonb_build_object('src','amro_work_order_template_categories','tgt','work_order_template_categories'),
    jsonb_build_object('src','amro_work_order_template_versions','tgt','work_order_template_versions'),
    -- Step 62 (extensions; one rename)
    jsonb_build_object('src','amro_inventory_work_order_links','tgt','work_order_item_links'),
    jsonb_build_object('src','amro_parts_mro_workflow_events','tgt','parts_mro_workflow_events')
  );
BEGIN
  FOR v_pair IN SELECT (p->>'src') AS src, (p->>'tgt') AS tgt
                FROM jsonb_array_elements(v_pairs) p LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_pair.src) INTO v_src_count;
    EXECUTE format('SELECT count(*) FROM amro.%I',   v_pair.tgt) INTO v_tgt_count;
    metric := v_pair.tgt || '_minus_amro';
    delta  := v_src_count - v_tgt_count;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

COMMENT ON FUNCTION amro.base_drift_check() IS
  'Phase 6 Step 58 + 62 — per-table drift between public.amro_* sources and amro.* mirrors. 34 tracked pairs. All deltas should remain 0.';
