-- Smoke: LLM Gateway P2.3 — budget_caps + quota_caps + budget_counters
-- + period_start_of + increment_budget_counter.
BEGIN;

-- A1: all 3 tables exist + RLS enabled
DO $$
DECLARE rls boolean; t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['budget_caps','quota_caps','budget_counters']) LOOP
    PERFORM 1 FROM information_schema.tables WHERE table_schema='gateway' AND table_name = t;
    IF NOT FOUND THEN RAISE EXCEPTION 'gateway.% missing', t; END IF;
    SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='gateway' AND c.relname = t;
    IF NOT rls THEN RAISE EXCEPTION 'gateway.% missing RLS', t; END IF;
  END LOOP;
  RAISE NOTICE 'A1 OK';
END $$;

-- A2: period_start_of computes the boundaries we expect
DO $$
BEGIN
  IF gateway.period_start_of('2026-06-15 13:45'::timestamptz, 'daily') <> '2026-06-15 00:00'::timestamptz THEN
    RAISE EXCEPTION 'daily boundary wrong';
  END IF;
  IF gateway.period_start_of('2026-06-15 13:45'::timestamptz, 'monthly') <> '2026-06-01 00:00'::timestamptz THEN
    RAISE EXCEPTION 'monthly boundary wrong';
  END IF;
  RAISE NOTICE 'A2 OK';
END $$;

-- A3: budget_caps CHECK on warning_pct rejects out-of-range
DO $$
BEGIN
  BEGIN
    INSERT INTO gateway.budget_caps (scope_kind, scope_id, period_kind, limit_usd, warning_pct)
      VALUES ('tenant', 'tA', 'monthly', 100, 150);
    RAISE EXCEPTION 'expected CHECK to reject warning_pct=150';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A3 OK';
  END;
END $$;

-- A4: quota_caps CHECK on at_least_one_limit
DO $$
BEGIN
  BEGIN
    INSERT INTO gateway.quota_caps (scope_kind, scope_id, period_kind, limit_invocations, limit_tokens)
      VALUES ('tenant', 'tA', 'monthly', NULL, NULL);
    RAISE EXCEPTION 'expected CHECK to reject both limits NULL';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'A4 OK';
  END;
END $$;

-- A5: increment_budget_counter accumulates within same period
DO $$
DECLARE
  v_period timestamptz := gateway.period_start_of(now(), 'monthly');
  r record;
BEGIN
  PERFORM gateway.increment_budget_counter('tenant', 'sm-bud', 'monthly', v_period, 1.50, 1, 100);
  PERFORM gateway.increment_budget_counter('tenant', 'sm-bud', 'monthly', v_period, 2.50, 1, 200);
  SELECT * INTO r FROM gateway.budget_counters
    WHERE scope_kind='tenant' AND scope_id='sm-bud' AND period_kind='monthly' AND period_started_at = v_period;
  IF r.spent_usd <> 4.0 THEN RAISE EXCEPTION 'expected spent_usd=4.0, got %', r.spent_usd; END IF;
  IF r.invocations <> 2 THEN RAISE EXCEPTION 'expected invocations=2, got %', r.invocations; END IF;
  IF r.tokens <> 300 THEN RAISE EXCEPTION 'expected tokens=300, got %', r.tokens; END IF;
  RAISE NOTICE 'A5 OK';
END $$;

-- A6: increment_budget_counter creates a separate row for a different period bucket
DO $$
DECLARE
  v_period_a timestamptz := '2026-05-01 00:00'::timestamptz;
  v_period_b timestamptz := '2026-06-01 00:00'::timestamptz;
  n int;
BEGIN
  PERFORM gateway.increment_budget_counter('tenant', 'sm-bud2', 'monthly', v_period_a, 1.0, 1, 10);
  PERFORM gateway.increment_budget_counter('tenant', 'sm-bud2', 'monthly', v_period_b, 1.0, 1, 10);
  SELECT COUNT(*) INTO n FROM gateway.budget_counters
    WHERE scope_kind='tenant' AND scope_id='sm-bud2';
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 rows (different periods), got %', n; END IF;
  RAISE NOTICE 'A6 OK';
END $$;

ROLLBACK;
SELECT 'gateway_budgets_quotas OK' AS smoke_result;
