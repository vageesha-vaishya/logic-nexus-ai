-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260519113410; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

CREATE TABLE IF NOT EXISTS markets.portfolio_risk_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  computed_at   timestamptz NOT NULL DEFAULT now(),
  score         numeric(4, 2) NOT NULL CHECK (score >= 0 AND score <= 10),
  target_score  numeric(4, 2) NOT NULL CHECK (target_score >= 0 AND target_score <= 10),
  components    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

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