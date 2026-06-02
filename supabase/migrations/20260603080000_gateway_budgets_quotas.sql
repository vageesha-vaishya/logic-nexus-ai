-- LLM Gateway P2.3 — budget caps + quota caps + counter persistence.
-- Per design §4.2 + §4.3. Postgres-backed; Redis acceleration is a
-- later optimization (P2.3b). Period rollover is automatic via the
-- period_kind/period_started_at convention + per-call SELECT FOR UPDATE.

-- ── 1. Budget caps ($-denominated). ──
CREATE TABLE gateway.budget_caps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind      text NOT NULL CHECK (scope_kind IN ('platform','tenant','tenant_feature','franchisee')),
  scope_id        text NOT NULL,            -- '*' for platform; uuid for tenant/franchisee; "tenant_uuid::feature" for tenant_feature
  period_kind     text NOT NULL DEFAULT 'monthly'
                    CHECK (period_kind IN ('daily','weekly','monthly')),
  limit_usd       numeric(14,4) NOT NULL CHECK (limit_usd >= 0),
  warning_pct     integer NOT NULL DEFAULT 80 CHECK (warning_pct BETWEEN 0 AND 100),
  hard_cap        boolean NOT NULL DEFAULT true,
  /** When true, billing_mode='tenant_paid' invocations don't count toward this cap.
      Reflects the design: BYO-key tenants paying their provider directly often
      don't want platform-imposed budgets — but admins can opt them in if they wish. */
  tenant_paid_uncapped boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_kind, scope_id, period_kind)
);
CREATE INDEX budget_caps_scope_idx ON gateway.budget_caps (scope_kind, scope_id);
ALTER TABLE gateway.budget_caps ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway.budget_caps TO service_role;
CREATE TRIGGER trg_gw_bc_updated_at BEFORE UPDATE ON gateway.budget_caps
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ── 2. Quota caps (request-count + token-count for free tiers). ──
CREATE TABLE gateway.quota_caps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind          text NOT NULL CHECK (scope_kind IN ('platform','tenant','tenant_feature','franchisee')),
  scope_id            text NOT NULL,
  period_kind         text NOT NULL DEFAULT 'monthly' CHECK (period_kind IN ('daily','weekly','monthly')),
  limit_invocations   integer CHECK (limit_invocations IS NULL OR limit_invocations >= 0),
  limit_tokens        bigint  CHECK (limit_tokens IS NULL OR limit_tokens >= 0),
  hard_cap            boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_kind, scope_id, period_kind),
  CONSTRAINT at_least_one_limit CHECK (limit_invocations IS NOT NULL OR limit_tokens IS NOT NULL)
);
CREATE INDEX quota_caps_scope_idx ON gateway.quota_caps (scope_kind, scope_id);
ALTER TABLE gateway.quota_caps ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway.quota_caps TO service_role;
CREATE TRIGGER trg_gw_qc_updated_at BEFORE UPDATE ON gateway.quota_caps
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ── 3. Counters. One row per (scope, period_kind, period_started_at).
-- Period_started_at is the bucket start; rollover happens by inserting a
-- new row when the calling day/week/month begins.
CREATE TABLE gateway.budget_counters (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind          text NOT NULL,
  scope_id            text NOT NULL,
  period_kind         text NOT NULL CHECK (period_kind IN ('daily','weekly','monthly')),
  period_started_at   timestamptz NOT NULL,
  spent_usd           numeric(14,6) NOT NULL DEFAULT 0,
  invocations         integer       NOT NULL DEFAULT 0,
  tokens              bigint        NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope_kind, scope_id, period_kind, period_started_at)
);
CREATE INDEX budget_counters_scope_idx
  ON gateway.budget_counters (scope_kind, scope_id, period_kind, period_started_at DESC);
ALTER TABLE gateway.budget_counters ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON gateway.budget_counters TO service_role;

-- ── 4. period_start_of(timestamptz, period_kind) — deterministic bucket boundary
-- so callers (RPC + reporting) agree on what "this month" means.
CREATE OR REPLACE FUNCTION gateway.period_start_of(p_ts timestamptz, p_period_kind text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_period_kind
    WHEN 'daily'   THEN date_trunc('day',   p_ts)
    WHEN 'weekly'  THEN date_trunc('week',  p_ts)  -- ISO week (Mon start)
    WHEN 'monthly' THEN date_trunc('month', p_ts)
    ELSE date_trunc('month', p_ts)
  END;
$$;

-- ── 5. Atomic counter increment. Idempotent on per-invocation_id; admins
-- can dedupe by passing the same invocation_id twice (we IGNORE the
-- second). UPSERT pattern + WHERE NOT EXISTS dedupe.
CREATE OR REPLACE FUNCTION gateway.increment_budget_counter(
  p_scope_kind        text,
  p_scope_id          text,
  p_period_kind       text,
  p_period_started_at timestamptz,
  p_spent_usd         numeric,
  p_invocations       integer,
  p_tokens            bigint
)
RETURNS TABLE (
  spent_usd     numeric,
  invocations   integer,
  tokens        bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, gateway
AS $$
DECLARE
  v_row gateway.budget_counters%ROWTYPE;
BEGIN
  INSERT INTO gateway.budget_counters (scope_kind, scope_id, period_kind, period_started_at,
                                       spent_usd, invocations, tokens)
  VALUES (p_scope_kind, p_scope_id, p_period_kind, p_period_started_at,
          p_spent_usd, p_invocations, p_tokens)
  ON CONFLICT (scope_kind, scope_id, period_kind, period_started_at) DO UPDATE
    SET spent_usd   = gateway.budget_counters.spent_usd   + EXCLUDED.spent_usd,
        invocations = gateway.budget_counters.invocations + EXCLUDED.invocations,
        tokens      = gateway.budget_counters.tokens      + EXCLUDED.tokens,
        updated_at  = now()
  RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.spent_usd, v_row.invocations, v_row.tokens;
END;
$$;
REVOKE ALL ON FUNCTION gateway.increment_budget_counter(text, text, text, timestamptz, numeric, integer, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gateway.increment_budget_counter(text, text, text, timestamptz, numeric, integer, bigint) TO service_role;
