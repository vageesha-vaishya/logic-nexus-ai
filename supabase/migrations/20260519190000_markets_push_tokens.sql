-- Push notification tokens, extended for Phase 1 Addendum T24c.
--
-- A markets.push_tokens table from an earlier migration already shipped
-- with (id, user_id, token, platform, device_name, is_active,
-- created_at, updated_at) and a unique (user_id, token) constraint —
-- exactly what FCM dispatch needs to dedupe device re-registrations.
--
-- T24c adds:
--   • last_seen_at  — set each time the device re-registers, so we can
--                     prune cold tokens later.
--   • Composite index on (user_id, last_seen_at DESC) for the worker's
--     "active tokens for this user" lookup.
--   • Idempotent guards for RLS + the updated_at trigger.

ALTER TABLE markets.push_tokens
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS push_tokens_user_lastseen_idx
  ON markets.push_tokens (user_id, last_seen_at DESC);

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
