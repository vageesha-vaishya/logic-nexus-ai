-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260519131459; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

CREATE TABLE IF NOT EXISTS markets.rebalance_recommendations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'executed', 'dismissed', 'expired', 'partially_executed')),
  payload         jsonb NOT NULL,
  executed_at     timestamptz,
  confirm_method  text CHECK (confirm_method IN ('biometric', 'password', 'web')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

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