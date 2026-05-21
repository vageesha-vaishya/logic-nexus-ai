-- Portfolio risk-score history (Phase 1 Addendum T17).
--
-- Each row is one computation snapshot. The frontend reads the latest row
-- for the headline score + the last 30 days for a sparkline. We never
-- mutate rows — every compute appends, so we keep the audit trail.
--
-- `components` jsonb is intentionally untyped so the formula can evolve
-- without schema churn. Keys today:
--   concentration_score   1-10  Herfindahl over actual tier weights
--   tier_skew_score       1-10  L1 distance between actual and target tier weights
--   drawdown_score        1-10  max peak-to-trough in last ~6 months of core NAV
--   beta_score            1-10  weighted-average beta proxy (defaults to 5 today)
--   weights               {concentration, tier_skew, drawdown, beta}
--
-- `target_score` is the score the user *intended* per their onboarding
-- risk_tag (conservative=3, moderate=6, aggressive=9). When current-target>2
-- the Home card upgrades to its elevated state.

CREATE TABLE IF NOT EXISTS markets.portfolio_risk_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  score         numeric(4, 2) NOT NULL CHECK (score >= 0 AND score <= 10),
  target_score  numeric(4, 2) NOT NULL CHECK (target_score >= 0 AND target_score <= 10),
  components    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Fast "latest score per user" + "user's last 30 days" queries.
CREATE INDEX IF NOT EXISTS portfolio_risk_history_user_time_idx
  ON markets.portfolio_risk_history (user_id, computed_at DESC);

ALTER TABLE markets.portfolio_risk_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'portfolio_risk_history'
      AND policyname = 'Users read own risk history'
  ) THEN
    CREATE POLICY "Users read own risk history"
      ON markets.portfolio_risk_history
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- Writes are service-role only — the worker inserts after computing.
-- No INSERT/UPDATE/DELETE policy means user JWTs can read but not write.
