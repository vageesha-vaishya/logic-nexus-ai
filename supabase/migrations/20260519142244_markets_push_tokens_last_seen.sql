-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260519142244; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Extend the pre-existing markets.push_tokens table with last_seen_at so
-- the worker can decay stale tokens. Idempotent.
ALTER TABLE markets.push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS push_tokens_user_lastseen_idx
  ON markets.push_tokens (user_id, last_seen_at DESC);

-- Ensure RLS + policy + updated_at trigger are in place. The table was
-- created by an earlier migration; this guards against drift.
ALTER TABLE markets.push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='markets' AND tablename='push_tokens'
      AND policyname='Users manage own push tokens'
  ) THEN
    CREATE POLICY "Users manage own push tokens"
      ON markets.push_tokens
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DROP TRIGGER IF EXISTS push_tokens_set_updated_at ON markets.push_tokens;
CREATE TRIGGER push_tokens_set_updated_at
  BEFORE UPDATE ON markets.push_tokens
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();