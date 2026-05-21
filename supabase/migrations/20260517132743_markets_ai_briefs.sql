-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517132743; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- AI Briefs table for portfolio advisor (trade_journal already exists)
CREATE TABLE IF NOT EXISTS markets.ai_briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    uuid REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid,
  scope           text NOT NULL DEFAULT 'portfolio_advisor'
                  CHECK (scope IN ('portfolio_advisor', 'instrument_brief', 'market_summary')),
  content         text NOT NULL,
  model           text,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE markets.ai_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own briefs" ON markets.ai_briefs;
DROP POLICY IF EXISTS "service role inserts briefs" ON markets.ai_briefs;

CREATE POLICY "users read own briefs"
  ON markets.ai_briefs FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "service role inserts briefs"
  ON markets.ai_briefs FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_briefs_portfolio
  ON markets.ai_briefs (portfolio_id, scope, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_briefs_owner
  ON markets.ai_briefs (owner_user_id, generated_at DESC);
