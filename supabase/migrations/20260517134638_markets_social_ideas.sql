-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517134638; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ── Trade Ideas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.ideas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL DEFAULT '',
    symbol          TEXT,
    instrument_id   UUID REFERENCES markets.instruments(id) ON DELETE SET NULL,
    direction       TEXT NOT NULL DEFAULT 'neutral'
                        CHECK (direction IN ('bullish', 'bearish', 'neutral')),
    timeframe       TEXT DEFAULT '1D',
    target_price    NUMERIC(18,4),
    stop_loss       NUMERIC(18,4),
    entry_price     NUMERIC(18,4),
    is_published    BOOLEAN NOT NULL DEFAULT TRUE,
    view_count      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ideas_user_id_idx      ON markets.ideas(user_id);
CREATE INDEX IF NOT EXISTS ideas_instrument_id_idx ON markets.ideas(instrument_id);
CREATE INDEX IF NOT EXISTS ideas_created_at_idx   ON markets.ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS ideas_symbol_idx       ON markets.ideas(symbol);

ALTER TABLE markets.ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY ideas_select  ON markets.ideas FOR SELECT USING (is_published = TRUE);
CREATE POLICY ideas_insert  ON markets.ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY ideas_update  ON markets.ideas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY ideas_delete  ON markets.ideas FOR DELETE USING (auth.uid() = user_id);

-- ── Reactions (like / fire / bookmark) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.idea_reactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id       UUID NOT NULL REFERENCES markets.ideas(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'fire', 'bookmark')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (idea_id, user_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idea_reactions_idea_id_idx ON markets.idea_reactions(idea_id);

ALTER TABLE markets.idea_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY idea_reactions_select ON markets.idea_reactions FOR SELECT USING (TRUE);
CREATE POLICY idea_reactions_insert ON markets.idea_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY idea_reactions_delete ON markets.idea_reactions FOR DELETE USING (auth.uid() = user_id);

-- ── Comments (threaded) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.idea_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id           UUID NOT NULL REFERENCES markets.ideas(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body              TEXT NOT NULL,
    parent_comment_id UUID REFERENCES markets.idea_comments(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idea_comments_idea_id_idx    ON markets.idea_comments(idea_id);
CREATE INDEX IF NOT EXISTS idea_comments_parent_id_idx  ON markets.idea_comments(parent_comment_id);

ALTER TABLE markets.idea_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY idea_comments_select ON markets.idea_comments FOR SELECT USING (TRUE);
CREATE POLICY idea_comments_insert ON markets.idea_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY idea_comments_update ON markets.idea_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY idea_comments_delete ON markets.idea_comments FOR DELETE USING (auth.uid() = user_id);

-- ── User follows ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.idea_follows (
    follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idea_follows_following_id_idx ON markets.idea_follows(following_id);

ALTER TABLE markets.idea_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY idea_follows_select ON markets.idea_follows FOR SELECT USING (TRUE);
CREATE POLICY idea_follows_insert ON markets.idea_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY idea_follows_delete ON markets.idea_follows FOR DELETE USING (auth.uid() = follower_id);

-- ── updated_at trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION markets.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ideas_updated_at') THEN
    CREATE TRIGGER ideas_updated_at
      BEFORE UPDATE ON markets.ideas
      FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'idea_comments_updated_at') THEN
    CREATE TRIGGER idea_comments_updated_at
      BEFORE UPDATE ON markets.idea_comments
      FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
  END IF;
END $$;
