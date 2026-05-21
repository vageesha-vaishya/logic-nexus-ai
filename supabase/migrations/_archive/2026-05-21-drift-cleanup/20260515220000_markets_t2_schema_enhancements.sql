-- ══════════════════════════════════════════════════════════════════════════
-- T2 Markets Schema Enhancements
-- ══════════════════════════════════════════════════════════════════════════
--
-- All 6 T2 tables already exist with good RLS + indexes from a prior
-- migration. This migration adds the columns needed by the Python worker,
-- MCP servers, and research thread UI, plus the new markets.prompts table.
--
-- Tables augmented:
--   research_threads   + status, context_type, context_ref_id, last_message_at
--   research_messages  + tool_results, citations, sequence_num, is_error
--   strategies         + universe, constraints, version, tags
--   backtests          + period_from, period_to, initial_capital,
--                        commission_model, worker_job_id, progress
--   signals            + direction, confidence, expires_at, portfolio_id
--
-- New table:
--   markets.prompts    — versioned prompt registry consumed by LLM gateway
--
-- DB-VERIFICATION: markets-t2-schema-enhancements-v1
-- DB-ARCH-APPROVAL: vimal-2026-05-15

-- ── research_threads ─────────────────────────────────────────────────────────

ALTER TABLE markets.research_threads
  -- Lifecycle: active threads appear in list; archived are hidden by default
  ADD COLUMN IF NOT EXISTS status        TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),

  -- What is being researched — drives MCP context injection
  ADD COLUMN IF NOT EXISTS context_type  TEXT
    CHECK (context_type IN ('portfolio','watchlist','instrument','sector','general')),

  -- FK to the subject row (portfolio_id, watchlist_id, instrument_id, etc.)
  ADD COLUMN IF NOT EXISTS context_ref_id UUID,

  -- Denormalised for fast list ordering — updated by trigger on message insert
  ADD COLUMN IF NOT EXISTS last_message_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_count    INT NOT NULL DEFAULT 0;

-- Index: list view sorted by most-recently-active
CREATE INDEX IF NOT EXISTS idx_research_threads_owner_active
  ON markets.research_threads (owner_user_id, last_message_at DESC NULLS LAST)
  WHERE status = 'active';

-- Trigger: keep last_message_at + message_count in sync on insert
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

-- ── research_messages ────────────────────────────────────────────────────────

ALTER TABLE markets.research_messages
  -- tool_calls  = what the model asked to call  (already exists)
  -- tool_results = what the tool returned (injected as user-role messages)
  ADD COLUMN IF NOT EXISTS tool_results JSONB,

  -- Structured citations produced by the model
  -- [{url, title, snippet, instrument_id?}]
  ADD COLUMN IF NOT EXISTS citations    JSONB,

  -- Stable 1-based sequence number within the thread for ordered rendering
  -- Populated by trigger below so the app never needs to compute it
  ADD COLUMN IF NOT EXISTS sequence_num INT,

  -- True for error/failed messages — rendered with error styling in UI
  ADD COLUMN IF NOT EXISTS is_error     BOOLEAN NOT NULL DEFAULT false,

  -- Claude extended thinking output (claude-3-7-sonnet and later)
  ADD COLUMN IF NOT EXISTS thinking     TEXT;

-- Trigger: auto-assign sequence_num on insert
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

-- Index: efficient ordered fetch of all messages in a thread
CREATE INDEX IF NOT EXISTS idx_research_messages_thread_seq
  ON markets.research_messages (thread_id, sequence_num);

-- ── strategies ───────────────────────────────────────────────────────────────

ALTER TABLE markets.strategies
  -- Asset universe the strategy operates on
  -- {"symbols": ["RELIANCE","TCS"], "sectors": ["technology"], "index": "NIFTY50"}
  ADD COLUMN IF NOT EXISTS universe    JSONB,

  -- Risk constraints applied during backtesting + live execution
  -- {"max_position_pct": 10, "stop_loss_pct": 5, "max_drawdown_pct": 20}
  ADD COLUMN IF NOT EXISTS constraints JSONB,

  -- Monotonically increasing version; bump on every compiled_code change
  ADD COLUMN IF NOT EXISTS version     INT NOT NULL DEFAULT 1,

  -- User-defined tags for filtering ("mean-reversion", "momentum", "india-midcap")
  ADD COLUMN IF NOT EXISTS tags        TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN markets.strategies.universe IS
  'Asset universe JSON: {symbols?, sectors?, index?, exchange?}';
COMMENT ON COLUMN markets.strategies.constraints IS
  'Risk constraints JSON: {max_position_pct?, stop_loss_pct?, max_drawdown_pct?, max_leverage?}';

-- Index: tag-based filtering (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_strategies_tags
  ON markets.strategies USING GIN (tags);

-- ── backtests ────────────────────────────────────────────────────────────────

ALTER TABLE markets.backtests
  -- Date range the backtest covers
  ADD COLUMN IF NOT EXISTS period_from     DATE,
  ADD COLUMN IF NOT EXISTS period_to       DATE,

  -- Starting capital in INR (or portfolio base currency)
  ADD COLUMN IF NOT EXISTS initial_capital NUMERIC NOT NULL DEFAULT 1000000,

  -- Cost model applied: {per_trade_bps, stt_pct, gst_pct, slippage_bps}
  ADD COLUMN IF NOT EXISTS commission_model JSONB NOT NULL DEFAULT
    '{"per_trade_bps": 3, "stt_pct": 0.1, "gst_pct": 18, "slippage_bps": 5}'::jsonb,

  -- RQ job ID — used by Python worker to check status / cancel
  ADD COLUMN IF NOT EXISTS worker_job_id   TEXT,

  -- 0–100 progress percentage for live progress bar
  ADD COLUMN IF NOT EXISTS progress        INT NOT NULL DEFAULT 0
    CHECK (progress BETWEEN 0 AND 100);

COMMENT ON COLUMN markets.backtests.metrics IS
  'Computed by Python worker: {cagr, sharpe, sortino, max_drawdown, win_rate, profit_factor, '
  'total_trades, avg_trade_duration_days, calmar, volatility_annualised}';
COMMENT ON COLUMN markets.backtests.commission_model IS
  'Cost model: per_trade_bps (brokerage), stt_pct (STT), gst_pct (GST on brokerage), slippage_bps';

-- Index: worker picks up queued/running jobs by status
-- (already exists: backtests_status_idx covers queued+running)

-- ── signals ──────────────────────────────────────────────────────────────────

ALTER TABLE markets.signals
  -- long / short / neutral — the actionable direction
  ADD COLUMN IF NOT EXISTS direction    TEXT
    CHECK (direction IN ('long','short','neutral')),

  -- 0.0–1.0 model confidence score
  ADD COLUMN IF NOT EXISTS confidence   NUMERIC
    CHECK (confidence BETWEEN 0 AND 1),

  -- When signal is no longer actionable
  ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ,

  -- If signal is scoped to a specific portfolio (NULL = instrument-wide)
  ADD COLUMN IF NOT EXISTS portfolio_id UUID
    REFERENCES markets.portfolios(id) ON DELETE SET NULL,

  -- Instrument price at signal generation time
  ADD COLUMN IF NOT EXISTS price_at_signal NUMERIC;

-- Index: signals per portfolio ordered by recency
CREATE INDEX IF NOT EXISTS idx_signals_portfolio_live
  ON markets.signals (portfolio_id, ts DESC)
  WHERE portfolio_id IS NOT NULL;

-- Index: signals per instrument ordered by recency (query filters expires_at at runtime)
CREATE INDEX IF NOT EXISTS idx_signals_instrument_live
  ON markets.signals (instrument_id, ts DESC);

-- ── markets.prompts — versioned prompt registry ───────────────────────────────
-- Consumed by the LLM gateway to resolve the active prompt for a task.
-- Changing a prompt is a DB write, not a code deploy.

CREATE TABLE IF NOT EXISTS markets.prompts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Matches LlmTaskId in _shared/llm-gateway.ts
  -- e.g. 'markets.daily_brief', 'markets.research_thread', 'markets.news_sentiment'
  task_id          TEXT        NOT NULL,

  -- Human-readable version tag, e.g. 'v3-2026-05-15'
  version          TEXT        NOT NULL,

  -- Only one prompt per task_id can be 'active' at a time (enforced by partial index)
  state            TEXT        NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','active','deprecated')),

  system_prompt    TEXT        NOT NULL,
  user_template    TEXT        NOT NULL,

  -- Override provider/model/temperature for this specific prompt
  -- {"provider": "anthropic", "model": "claude-sonnet-4-6", "max_tokens": 2048, "temperature": 0}
  provider_overrides JSONB     NOT NULL DEFAULT '{}',

  -- Human notes: why this version was created, what changed
  notes            TEXT,

  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (task_id, version)
);

-- At most one active prompt per task_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompts_active_task
  ON markets.prompts (task_id)
  WHERE state = 'active';

-- Lookup index for gateway: find active prompt for task
CREATE INDEX IF NOT EXISTS idx_prompts_task_state
  ON markets.prompts (task_id, state);

ALTER TABLE markets.prompts ENABLE ROW LEVEL SECURITY;

-- Platform admins manage prompts; authenticated users read active prompts only
CREATE POLICY prompts_platform_admin_all ON markets.prompts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );

CREATE POLICY prompts_authenticated_select ON markets.prompts
  FOR SELECT USING (
    state = 'active'
    OR created_by = auth.uid()
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS prompts_set_updated_at ON markets.prompts;
CREATE TRIGGER prompts_set_updated_at
  BEFORE UPDATE ON markets.prompts
  FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

-- ── Seed active prompts from the LLM gateway hardcoded values ────────────────
-- These mirror PROMPTS in _shared/llm-gateway.ts so the gateway can resolve
-- them from the DB. Once the gateway reads from this table, the hardcoded
-- PROMPTS constant becomes a fallback only.

INSERT INTO markets.prompts (task_id, version, state, system_prompt, user_template, provider_overrides, notes)
VALUES
(
  'markets.daily_brief',
  'v3-2026-05-15',
  'active',
  'You are a calm, India-market-focused portfolio analyst. Output is concise Markdown. Use ₹ for INR. Never give personalized investment advice.

STRICT GROUNDING RULES (these override anything else):
1. You may ONLY make claims directly supported by an item in the Recent news JSON. Do not draw on general training knowledge about specific companies, prices, or events.
2. Every factual claim must be cited with a numbered source [N] where N is the 1-based index of an item in Recent news JSON.
3. If Recent news JSON is empty or contains no items relevant to the user''s tracked instruments, output ONLY the ## No fresh news template.',
  'Generate today''s brief for the portfolio below.

Holdings JSON:
${holdings_json}

Recent news JSON (items from last 24 h relevant to these instruments):
${news_json}

Output format:
## Portfolio snapshot
[1-sentence current value + day change from snapshot data]

## Key moves today
[Bullet list — ONLY instruments with relevant news, cite sources]

## No fresh news
[Only output this section if news_json is empty or irrelevant]
Today''s brief skipped — no market news was ingested for your tracked instruments (${tracked_symbols_csv}). A brief will be generated once relevant news is ingested.',
  '{"provider": "anthropic", "model": "claude-sonnet-4-6", "max_tokens": 2048}',
  'Migrated from hardcoded PROMPTS constant in llm-gateway.ts v3'
),
(
  'markets.news_sentiment',
  'v1-2026-05-15',
  'active',
  'You are a financial news analyst specialising in Indian markets. Return ONLY valid JSON. No prose.',
  'Analyse the sentiment of this news headline and snippet for the Indian stock market context.

Headline: ${headline}
Snippet: ${snippet}
Instruments mentioned: ${instruments_csv}

Return JSON: {"sentiment": "positive"|"negative"|"neutral", "score": -1.0_to_1.0, "summary": "10 words max"}',
  '{"provider": "anthropic", "model": "claude-haiku-4-5", "max_tokens": 256}',
  'Fast cheap sentiment scoring for news ingestion pipeline'
),
(
  'markets.research_thread',
  'v1-2026-05-15',
  'active',
  'You are an expert Indian equity and multi-asset analyst with deep knowledge of NSE, BSE, MCX, and AMFI instruments. You have access to tools that provide live portfolio data, historical prices, fundamentals, news, and market context. Always ground your analysis in the data returned by tools — do not hallucinate prices, valuations, or events. Use ₹ for INR. Format responses in clear Markdown.',
  '${user_message}',
  '{"provider": "anthropic", "model": "claude-sonnet-4-6", "max_tokens": 4096}',
  'Interactive research thread system prompt — drives MCP tool-use loop'
),
(
  'markets.strategy_explain',
  'v1-2026-05-15',
  'active',
  'You are a quantitative trading strategy expert. Explain strategies in plain English suitable for a sophisticated retail investor. Identify assumptions and failure modes.',
  'Strategy DSL:
${strategy_dsl}

Backtest metrics JSON: ${metrics_json}',
  '{"provider": "anthropic", "model": "claude-sonnet-4-6", "max_tokens": 2048}',
  'Strategy explainer used on the strategy detail page'
)
ON CONFLICT (task_id, version) DO NOTHING;

-- ── GRANTs ────────────────────────────────────────────────────────────────────
GRANT USAGE  ON SCHEMA markets              TO authenticated;
GRANT SELECT ON markets.prompts             TO authenticated;
GRANT SELECT ON markets.research_threads    TO authenticated;
GRANT SELECT ON markets.research_messages   TO authenticated;
GRANT SELECT ON markets.strategies          TO authenticated;
GRANT SELECT ON markets.backtests           TO authenticated;
GRANT SELECT ON markets.signals             TO authenticated;
