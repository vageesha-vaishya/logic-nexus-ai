-- Drift-based rebalance recommendations (Phase 1 Addendum T21).
--
-- The detector writes one row per (user_id, generated_at) when any tier
-- drifts > 5% from its template-weight target. Status moves through:
--
--   pending  → executed | dismissed | expired | partially_executed
--
-- `payload` is the full recommendation object the frontend renders:
-- a `reason` string, a list of `orders` (action/symbol/tier/amount), a
-- `net_cash_impact`, and an `estimated_brokerage`. Kept untyped at the
-- DB level so the formula can evolve without schema churn.
--
-- Expiry is 7 days from generation (per addendum §4). Cleanup is handled
-- in-line on read: rows with expires_at < now() are flipped to status
-- 'expired' when the detector runs.

CREATE TABLE IF NOT EXISTS markets.rebalance_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'executed', 'dismissed', 'expired', 'partially_executed')),
  payload         jsonb NOT NULL,
  executed_at     timestamptz,
  -- The confirmation timestamp + payload combine into the SEBI audit trail
  -- (addendum §4: "Every executed rebalance is logged with the user's
  -- explicit biometric confirmation timestamp + the recommendation payload").
  confirm_method  text CHECK (confirm_method IN ('biometric', 'password', 'web')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Fast "latest pending for user" lookup.
CREATE INDEX IF NOT EXISTS rebalance_recs_user_status_idx
  ON markets.rebalance_recommendations (user_id, status, generated_at DESC);

ALTER TABLE markets.rebalance_recommendations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'rebalance_recommendations'
      AND policyname = 'Users read own rebalance recs'
  ) THEN
    CREATE POLICY "Users read own rebalance recs"
      ON markets.rebalance_recommendations
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'rebalance_recommendations'
      AND policyname = 'Users dismiss/execute own rebalance recs'
  ) THEN
    -- Allow the user to mark their own rec dismissed or executed. INSERT
    -- stays service-role-only (the worker generates recs); UPDATE is
    -- scoped to the user's own rows.
    CREATE POLICY "Users dismiss/execute own rebalance recs"
      ON markets.rebalance_recommendations
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DROP TRIGGER IF EXISTS rebalance_recs_set_updated_at ON markets.rebalance_recommendations;
CREATE TRIGGER rebalance_recs_set_updated_at
  BEFORE UPDATE ON markets.rebalance_recommendations
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
