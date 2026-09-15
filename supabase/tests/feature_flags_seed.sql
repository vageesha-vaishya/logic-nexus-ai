-- supabase/tests/feature_flags_seed.sql
--
-- Feature-flags seed smoke test. Run manually against a database with
-- 20260915120000_seed_app_feature_flags.sql applied -- local dev
-- (supabase db reset) or the self-hosted instance, never automatically.
-- Run with: npm run supabase:exec -- supabase/tests/feature_flags_seed.sql
-- Read-only: asserts against existing platform.feature_flags /
-- feature_flag_overrides rows, creates and deletes nothing.
--
-- Asserts:
--   A1. resolve_flags returns the expected value for each of the 10 seeded
--       keys (matching the call-site defaults table in the design spec).
--   A2. resolve_flags on an unknown key returns false.
--   A3. All 10 seeded rows have rollout_pct = 100.
--   A4. No row in platform.feature_flag_overrides references any of the
--       10 seeded keys -- this is the assertion that actually backs the
--       "byte-for-byte identical behavior" safety claim; nothing else
--       checks it.

DO $$
DECLARE
  v_result jsonb;
  v_count  integer;
  v_expected jsonb := jsonb_build_object(
    'amro_rbac_fix_enabled',             true,
    'hybrid_route_configuration_v1',     true,
    'quotation_import_export_v2',        true,
    'hybrid_route_metrics_dashboard_v1', false,
    'domain_grouped_nav',                false,
    'user_info_header_module',           false,
    'user_info_header_dual_mode',        false,
    'composer_multi_leg_autofill',       false,
    'quotation_phase2_guards',           false,
    'lead_three_section_layout',         true
  );
  k text;
BEGIN
  -- A1: resolve_flags matches the expected table, key by key.
  SELECT platform.resolve_flags(
    ARRAY(SELECT jsonb_object_keys(v_expected))
  ) INTO v_result;

  FOR k IN SELECT jsonb_object_keys(v_expected) LOOP
    IF (v_result -> k) IS DISTINCT FROM (v_expected -> k) THEN
      RAISE EXCEPTION 'A1 FAILED: % expected %, resolve_flags returned %',
        k, v_expected -> k, v_result -> k;
    END IF;
  END LOOP;

  -- A2: unknown key resolves to false.
  SELECT platform.resolve_flags(ARRAY['definitely_not_a_real_flag_key'])
    INTO v_result;
  IF (v_result -> 'definitely_not_a_real_flag_key') IS DISTINCT FROM 'false'::jsonb THEN
    RAISE EXCEPTION 'A2 FAILED: unknown key should resolve to false, got %',
      v_result -> 'definitely_not_a_real_flag_key';
  END IF;

  -- A3: rollout_pct = 100 on every seeded row.
  SELECT count(*) INTO v_count
    FROM platform.feature_flags
    WHERE key = ANY(ARRAY(SELECT jsonb_object_keys(v_expected)))
      AND rollout_pct <> 100;
  IF v_count != 0 THEN
    RAISE EXCEPTION 'A3 FAILED: % seeded row(s) have rollout_pct != 100', v_count;
  END IF;

  -- A4: no override rows for any seeded key -- the check that actually
  -- backs the "byte-for-byte identical" claim.
  SELECT count(*) INTO v_count
    FROM platform.feature_flag_overrides
    WHERE flag_key = ANY(ARRAY(SELECT jsonb_object_keys(v_expected)));
  IF v_count != 0 THEN
    RAISE EXCEPTION 'A4 FAILED: % override row(s) exist for seeded keys -- the "byte-for-byte identical" claim does not hold; reconcile by hand before treating this seed as safe', v_count;
  END IF;

  RAISE NOTICE 'feature_flags_seed.sql: all assertions passed (A1-A4)';
END $$;
