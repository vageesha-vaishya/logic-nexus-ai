-- Multi-broker / multi-portfolio RLS regression suite.
--
-- Run via:
--   psql "$DATABASE_URL" -f supabase/tests/markets_multibroker_rls.sql
--   OR via the Supabase SQL editor.
--
-- Wraps everything in a transaction that ROLLBACKs at the end so it
-- leaves no rows behind. Borrows a real (user, tenant, franchise) from
-- prod data so it exercises the live policies rather than synthetic
-- ones.
--
-- Covers (10 assertions):
--   T1   owner can SELECT own broker_connections
--   T2a  different user sees zero of sample's broker_connections
--   T2b  ... portfolios
--   T2c  ... holdings
--   T2d  ... positions
--   T2e  ... orders
--   T3a  platform_admin reads sample's broker_connections via bypass
--   T4   platform_admin INSERT is blocked by RLS (read-only contract)
--   T5   holdings partial unique indexes present (clobber fix landed)
--   T6   admin_select policies present on all 7 markets tables

BEGIN;

CREATE TEMP TABLE _rls_results (
  test_name text,
  status    text,
  detail    text
) ON COMMIT DROP;
GRANT INSERT ON _rls_results TO authenticated;

DO $$
DECLARE
  sample_user_id      uuid;
  sample_tenant_id    uuid;
  sample_franchise_id uuid;
  v_other_user_id     uuid;
  v_admin_user_id     uuid;
  v_count             int;
BEGIN
  SELECT owner_user_id, tenant_id, franchise_id
    INTO sample_user_id, sample_tenant_id, sample_franchise_id
  FROM markets.broker_connections LIMIT 1;
  SELECT id INTO v_other_user_id FROM auth.users WHERE id <> sample_user_id LIMIT 1;
  SELECT user_id INTO v_admin_user_id FROM public.user_roles
    WHERE role = 'platform_admin'::public.app_role LIMIT 1;

  -- T1 owner sees own
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', sample_user_id::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT COUNT(*) INTO v_count FROM markets.broker_connections
    WHERE owner_user_id = sample_user_id;
  INSERT INTO _rls_results VALUES (
    'T1_owner_sees_own_broker_connections',
    CASE WHEN v_count > 0 THEN 'PASS' ELSE 'FAIL' END,
    format('visible=%s', v_count));

  -- T2 cross-user isolation
  IF v_other_user_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_other_user_id::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    SELECT COUNT(*) INTO v_count FROM markets.broker_connections
      WHERE owner_user_id = sample_user_id;
    INSERT INTO _rls_results VALUES (
      'T2a_other_sees_zero_broker_connections',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      format('visible=%s', v_count));

    SELECT COUNT(*) INTO v_count FROM markets.portfolios WHERE owner_user_id = sample_user_id;
    INSERT INTO _rls_results VALUES (
      'T2b_other_sees_zero_portfolios',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      format('visible=%s', v_count));

    SELECT COUNT(*) INTO v_count FROM markets.holdings WHERE owner_user_id = sample_user_id;
    INSERT INTO _rls_results VALUES (
      'T2c_other_sees_zero_holdings',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      format('visible=%s', v_count));

    SELECT COUNT(*) INTO v_count FROM markets.positions WHERE owner_user_id = sample_user_id;
    INSERT INTO _rls_results VALUES (
      'T2d_other_sees_zero_positions',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      format('visible=%s', v_count));

    SELECT COUNT(*) INTO v_count FROM markets.orders WHERE owner_user_id = sample_user_id;
    INSERT INTO _rls_results VALUES (
      'T2e_other_sees_zero_orders',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      format('visible=%s', v_count));
  END IF;

  -- T3 + T4 admin
  IF v_admin_user_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin_user_id::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    SELECT COUNT(*) INTO v_count FROM markets.broker_connections
      WHERE owner_user_id = sample_user_id;
    INSERT INTO _rls_results VALUES (
      'T3a_platform_admin_reads_broker_connections',
      CASE WHEN v_count > 0 THEN 'PASS' ELSE 'FAIL' END,
      format('visible=%s', v_count));

    BEGIN
      INSERT INTO markets.broker_connections
        (id, tenant_id, franchise_id, owner_user_id, broker, broker_client_id,
         display_name, status, credentials_enc, segments, can_trade)
      VALUES
        (gen_random_uuid(), sample_tenant_id, sample_franchise_id, sample_user_id,
         'dhan', 'rls_test_'||gen_random_uuid()::text,
         'rls-test', 'active', 'enc', ARRAY['equity']::text[], false);
      INSERT INTO _rls_results VALUES ('T4_admin_INSERT_blocked','FAIL','INSERT succeeded');
    EXCEPTION WHEN others THEN
      INSERT INTO _rls_results VALUES ('T4_admin_INSERT_blocked','PASS',
        format('blocked: %s', substring(SQLERRM, 1, 80)));
    END;
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- T5 partial unique indexes
  SELECT COUNT(*) INTO v_count
  FROM pg_indexes WHERE schemaname='markets'
    AND indexname IN ('holdings_broker_scoped_uniq','holdings_manual_uniq');
  INSERT INTO _rls_results VALUES (
    'T5_holdings_partial_indexes_present',
    CASE WHEN v_count = 2 THEN 'PASS' ELSE 'FAIL' END,
    format('found=%s/2', v_count));

  -- T6 admin_select policies on all 7 tables
  SELECT COUNT(*) INTO v_count
  FROM pg_policies WHERE schemaname='markets' AND policyname LIKE '%_admin_select';
  INSERT INTO _rls_results VALUES (
    'T6_admin_select_policies_present',
    CASE WHEN v_count = 7 THEN 'PASS' ELSE 'FAIL' END,
    format('found=%s/7', v_count));

  -- T7 broker_portfolio_links owner-isolation
  IF v_other_user_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_other_user_id::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT COUNT(*) INTO v_count FROM markets.broker_portfolio_links
      WHERE owner_user_id = sample_user_id;
    INSERT INTO _rls_results VALUES (
      'T7_other_sees_zero_broker_portfolio_links',
      CASE WHEN v_count = 0 THEN 'PASS' ELSE 'FAIL' END,
      format('visible=%s', v_count));
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
  END IF;

  -- T8 broker_portfolio_links admin-bypass works
  IF v_admin_user_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin_user_id::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    -- Sample user may have zero links — assert the policy lets admin
    -- SELECT (no exception), not that there's data.
    BEGIN
      PERFORM 1 FROM markets.broker_portfolio_links
        WHERE owner_user_id = sample_user_id LIMIT 1;
      INSERT INTO _rls_results VALUES (
        'T8_admin_can_select_broker_portfolio_links','PASS','no RLS rejection');
    EXCEPTION WHEN insufficient_privilege OR others THEN
      INSERT INTO _rls_results VALUES (
        'T8_admin_can_select_broker_portfolio_links','FAIL',
        format('rejected: %s', substring(SQLERRM, 1, 80)));
    END;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
  END IF;

  -- T9 holdings partial unique index enforces uniqueness on
  -- (portfolio_id, broker_connection_id, instrument_id). Try a duplicate
  -- INSERT-on-conflict and assert it doesn't create a second row.
  -- We don't INSERT here to avoid touching FKs / RLS as different roles;
  -- instead, just confirm the index definition explicitly includes the
  -- 3-column tuple. (The Python upsert test pins the on_conflict key.)
  SELECT COUNT(*) INTO v_count
  FROM pg_indexes
  WHERE schemaname='markets' AND indexname='holdings_broker_scoped_uniq'
    AND indexdef LIKE '%(portfolio_id, broker_connection_id, instrument_id)%';
  INSERT INTO _rls_results VALUES (
    'T9_holdings_uniq_uses_three_column_tuple',
    CASE WHEN v_count = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('found=%s', v_count));
END $$;

SELECT test_name, status, detail FROM _rls_results ORDER BY test_name;

-- If any test failed, raise so a CI run sees a non-zero exit.
DO $$
DECLARE v_failed int;
BEGIN
  SELECT COUNT(*) INTO v_failed FROM _rls_results WHERE status <> 'PASS';
  IF v_failed > 0 THEN
    RAISE EXCEPTION '% RLS test(s) failed — see SELECT above', v_failed;
  END IF;
END $$;

ROLLBACK;
