-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516060448; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ── Extend markets.signals for multi-asset signal generator v2 ─────────────

-- 1. Drop old signal_type constraint, add new types
ALTER TABLE markets.signals
  DROP CONSTRAINT IF EXISTS signals_signal_type_check;

ALTER TABLE markets.signals
  ADD CONSTRAINT signals_signal_type_check
  CHECK (signal_type = ANY (ARRAY[
    'buy','sell','hold',           -- original
    'buy_more','reduce','exit',    -- portfolio management
    'switch','roll',               -- MF switch / F&O roll
    'alert','watch'                -- existing legacy
  ]));

-- 2. Add asset-class and horizon columns for efficient filtering
ALTER TABLE markets.signals
  ADD COLUMN IF NOT EXISTS asset_class      text,
  ADD COLUMN IF NOT EXISTS instrument_type  text,
  ADD COLUMN IF NOT EXISTS horizon          text
    CHECK (horizon = ANY (ARRAY[
      'intraday','short_term','medium_term','long_term'
    ])),
  ADD COLUMN IF NOT EXISTS risk_params      jsonb NOT NULL DEFAULT '{}';

-- 3. Indices for UI query patterns
CREATE INDEX IF NOT EXISTS idx_signals_asset_class
  ON markets.signals (asset_class, ts DESC);

CREATE INDEX IF NOT EXISTS idx_signals_horizon
  ON markets.signals (horizon, ts DESC);

CREATE INDEX IF NOT EXISTS idx_signals_portfolio_type
  ON markets.signals (portfolio_id, asset_class, ts DESC)
  WHERE portfolio_id IS NOT NULL;

-- 4. Macro context cache table
CREATE TABLE IF NOT EXISTS markets.signals_macro_context (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at   timestamptz NOT NULL DEFAULT now(),
  tenant_id     uuid,

  -- Interest rates
  rbi_repo_rate_pct   numeric,
  ust_10y_yield_pct   numeric,
  ust_2y_yield_pct    numeric,

  -- Markets
  nifty50_level       numeric,
  india_vix           numeric,
  usd_inr_spot        numeric,

  -- Flows
  rbi_forex_reserves_usd_b numeric,
  india_cad_pct            numeric,

  -- Commodities
  gold_spot_inr_per_g      numeric,
  crude_wti_per_barrel_usd numeric,

  -- Derived
  market_sentiment         text
    CHECK (market_sentiment = ANY (ARRAY['risk_on','risk_off','neutral'])),

  raw_data  jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_macro_context_recorded_at
  ON markets.signals_macro_context (recorded_at DESC);

-- RLS: same owner pattern
ALTER TABLE markets.signals_macro_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant read macro context"
  ON markets.signals_macro_context FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM auth.users WHERE id = auth.uid()) OR tenant_id IS NULL);

CREATE POLICY "service insert macro context"
  ON markets.signals_macro_context FOR INSERT
  WITH CHECK (true);
