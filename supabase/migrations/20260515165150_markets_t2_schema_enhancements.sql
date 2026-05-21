-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515165150; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- T2 Markets Schema Enhancements
-- DB-VERIFICATION: markets-t2-schema-enhancements-v1
-- DB-ARCH-APPROVAL: vimal-2026-05-15

ALTER TABLE markets.research_threads
  ADD COLUMN IF NOT EXISTS status         TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  ADD COLUMN IF NOT EXISTS context_type   TEXT
    CHECK (context_type IN ('portfolio','watchlist','instrument','sector','general')),
  ADD COLUMN IF NOT EXISTS context_ref_id UUID,
  ADD COLUMN IF NOT EXISTS last_message_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_count    INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_research_threads_owner_active
  ON markets.research_threads (owner_user_id, last_message_at DESC NULLS LAST)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION markets.trg_thread_message_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = markets, public, auth
AS $$
BEGIN
  UPDATE markets.research_threads
  SET
    last_message_at = NEW.created_at,
    message_count   = message_count + 1,
    updated_at      = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_research_messages_stats ON markets.research_messages;
CREATE TRIGGER trg_research_messages_stats
  AFTER INSERT ON markets.research_messages
  FOR EACH ROW
  EXECUTE FUNCTION markets.trg_thread_message_stats();

ALTER TABLE markets.research_messages
  ADD COLUMN IF NOT EXISTS tool_results JSONB,
  ADD COLUMN IF NOT EXISTS citations    JSONB,
  ADD COLUMN IF NOT EXISTS sequence_num INT,
  ADD COLUMN IF NOT EXISTS is_error     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thinking     TEXT;

CREATE OR REPLACE FUNCTION markets.trg_message_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = markets, public, auth
AS $$
BEGIN
  SELECT COALESCE(MAX(sequence_num), 0) + 1
  INTO   NEW.sequence_num
  FROM   markets.research_messages
  WHERE  thread_id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_research_messages_sequence ON markets.research_messages;
CREATE TRIGGER trg_research_messages_sequence
  BEFORE INSERT ON markets.research_messages
  FOR EACH ROW
  EXECUTE FUNCTION markets.trg_message_sequence();

CREATE INDEX IF NOT EXISTS idx_research_messages_thread_seq
  ON markets.research_messages (thread_id, sequence_num);

ALTER TABLE markets.strategies
  ADD COLUMN IF NOT EXISTS universe    JSONB,
  ADD COLUMN IF NOT EXISTS constraints JSONB,
  ADD COLUMN IF NOT EXISTS version     INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tags        TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_strategies_tags
  ON markets.strategies USING GIN (tags);

ALTER TABLE markets.backtests
  ADD COLUMN IF NOT EXISTS period_from      DATE,
  ADD COLUMN IF NOT EXISTS period_to        DATE,
  ADD COLUMN IF NOT EXISTS initial_capital  NUMERIC NOT NULL DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS commission_model JSONB   NOT NULL DEFAULT
    '{"per_trade_bps": 3, "stt_pct": 0.1, "gst_pct": 18, "slippage_bps": 5}'::jsonb,
  ADD COLUMN IF NOT EXISTS worker_job_id    TEXT,
  ADD COLUMN IF NOT EXISTS progress         INT NOT NULL DEFAULT 0
    CHECK (progress BETWEEN 0 AND 100);

ALTER TABLE markets.signals
  ADD COLUMN IF NOT EXISTS direction       TEXT CHECK (direction IN ('long','short','neutral')),
  ADD COLUMN IF NOT EXISTS confidence      NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portfolio_id    UUID REFERENCES markets.portfolios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_at_signal NUMERIC;

CREATE INDEX IF NOT EXISTS idx_signals_portfolio_live
  ON markets.signals (portfolio_id, ts DESC)
  WHERE portfolio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signals_instrument_live
  ON markets.signals (instrument_id, ts DESC);

CREATE TABLE IF NOT EXISTS markets.prompts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            TEXT        NOT NULL,
  version            TEXT        NOT NULL,
  state              TEXT        NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','active','deprecated')),
  system_prompt      TEXT        NOT NULL,
  user_template      TEXT        NOT NULL,
  provider_overrides JSONB       NOT NULL DEFAULT '{}',
  notes              TEXT,
  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_active_task
  ON markets.prompts (task_id)
  WHERE state = 'active';

CREATE INDEX IF NOT EXISTS idx_prompts_task_state
  ON markets.prompts (task_id, state);

ALTER TABLE markets.prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY prompts_platform_admin_all ON markets.prompts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'platform_admin')
  );

CREATE POLICY prompts_authenticated_select ON markets.prompts
  FOR SELECT USING (state = 'active' OR created_by = auth.uid());

DROP TRIGGER IF EXISTS prompts_set_updated_at ON markets.prompts;
CREATE TRIGGER prompts_set_updated_at
  BEFORE UPDATE ON markets.prompts
  FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

INSERT INTO markets.prompts (task_id, version, state, system_prompt, user_template, provider_overrides, notes)
VALUES
(
  'markets.daily_brief', 'v3-2026-05-15', 'active',
  'You are a calm, India-market-focused portfolio analyst. Output is concise Markdown. Use ₹ for INR. Never give personalized investment advice.

STRICT GROUNDING RULES:
1. You may ONLY make claims directly supported by an item in the Recent news JSON.
2. Every factual claim must be cited with a numbered source [N].
3. If Recent news JSON is empty, output ONLY the ## No fresh news section.',
  'Generate today''s brief for the portfolio below.

Holdings JSON:
${holdings_json}

Recent news JSON (items from last 24 h):
${news_json}

Output format:
## Portfolio snapshot
[1-sentence current value + day change]

## Key moves today
[Bullet list — ONLY instruments with relevant news, cite sources]

## No fresh news
Today''s brief skipped — no market news for your tracked instruments (${tracked_symbols_csv}).',
  '{"provider": "anthropic", "model": "claude-sonnet-4-6", "max_tokens": 2048}',
  'Migrated from hardcoded PROMPTS constant in llm-gateway.ts v3'
),
(
  'markets.news_sentiment', 'v1-2026-05-15', 'active',
  'You are a financial news analyst specialising in Indian markets. Return ONLY valid JSON. No prose.',
  'Analyse the sentiment of this news headline and snippet.

Headline: ${headline}
Snippet: ${snippet}
Instruments mentioned: ${instruments_csv}

Return JSON: {"sentiment": "positive"|"negative"|"neutral", "score": -1.0_to_1.0, "summary": "10 words max"}',
  '{"provider": "anthropic", "model": "claude-haiku-4-5", "max_tokens": 256}',
  'Fast sentiment scoring for news ingestion pipeline'
),
(
  'markets.research_thread', 'v1-2026-05-15', 'active',
  'You are an expert Indian equity and multi-asset analyst with deep knowledge of NSE, BSE, MCX, and AMFI instruments. You have access to tools that provide live portfolio data, historical prices, fundamentals, news, and market context. Always ground your analysis in tool data — do not hallucinate prices, valuations, or events. Use ₹ for INR. Format responses in clear Markdown.',
  '${user_message}',
  '{"provider": "anthropic", "model": "claude-sonnet-4-6", "max_tokens": 4096}',
  'Interactive research thread system prompt — drives MCP tool-use loop'
),
(
  'markets.strategy_explain', 'v1-2026-05-15', 'active',
  'You are a quantitative trading strategy expert. Explain strategies in plain English for a sophisticated retail investor. Identify assumptions and failure modes.',
  'Strategy DSL:
${strategy_dsl}

Backtest metrics JSON: ${metrics_json}',
  '{"provider": "anthropic", "model": "claude-sonnet-4-6", "max_tokens": 2048}',
  'Strategy explainer used on the strategy detail page'
)
ON CONFLICT (task_id, version) DO NOTHING;

GRANT USAGE  ON SCHEMA markets              TO authenticated;
GRANT SELECT ON markets.prompts             TO authenticated;
GRANT SELECT ON markets.research_threads    TO authenticated;
GRANT SELECT ON markets.research_messages   TO authenticated;
GRANT SELECT ON markets.strategies          TO authenticated;
GRANT SELECT ON markets.backtests           TO authenticated;
GRANT SELECT ON markets.signals             TO authenticated;