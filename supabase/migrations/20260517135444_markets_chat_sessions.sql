-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517135444; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ── AI Chat Sessions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New Chat',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON markets.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx ON markets.chat_sessions(updated_at DESC);

ALTER TABLE markets.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_select ON markets.chat_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY chat_sessions_insert ON markets.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY chat_sessions_update ON markets.chat_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY chat_sessions_delete ON markets.chat_sessions FOR DELETE USING (auth.uid() = user_id);

-- ── AI Chat Messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES markets.chat_sessions(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON markets.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON markets.chat_messages(created_at ASC);

ALTER TABLE markets.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_select ON markets.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY chat_messages_insert ON markets.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY chat_messages_delete ON markets.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger (reuse existing function)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'chat_sessions_updated_at') THEN
    CREATE TRIGGER chat_sessions_updated_at
      BEFORE UPDATE ON markets.chat_sessions
      FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
  END IF;
END $$;
