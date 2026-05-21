-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517122113; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


CREATE TABLE IF NOT EXISTS markets.trade_journal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id    uuid REFERENCES markets.portfolios(id) ON DELETE SET NULL,
  instrument_id   uuid REFERENCES markets.instruments(id) ON DELETE SET NULL,
  symbol          text NOT NULL,
  exchange        text NOT NULL DEFAULT 'NSE',
  direction       text NOT NULL CHECK (direction IN ('buy', 'sell', 'short', 'cover')),
  entry_date      date NOT NULL,
  exit_date       date,
  entry_price     numeric(18,4) NOT NULL,
  exit_price      numeric(18,4),
  qty             numeric(18,4) NOT NULL,
  charges         numeric(18,4) DEFAULT 0,
  pnl             numeric(18,4),
  pnl_pct         numeric(8,4),
  rationale       text,
  exit_reason     text,
  tags            text[] DEFAULT '{}',
  emotion         text CHECK (emotion IN ('confident', 'fearful', 'greedy', 'disciplined', 'impulsive', 'neutral')),
  outcome         text CHECK (outcome IN ('win', 'loss', 'breakeven', 'open')),
  ai_tags         text[] DEFAULT '{}',
  ai_insight      text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE markets.trade_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own journal"
  ON markets.trade_journal
  FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_journal_user
  ON markets.trade_journal (user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_symbol
  ON markets.trade_journal (user_id, symbol);
