-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515141642; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ══════════════════════════════════════════════════════════════════════════
-- T1 Foundation: transactions, tax_lots, fx_rates, mf_schemes,
--                portfolio_snapshots + extend instruments + holdings
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Extend markets.instruments ──────────────────────────────────────
ALTER TABLE markets.instruments
  ADD COLUMN IF NOT EXISTS asset_class   TEXT    DEFAULT 'equity',
  ADD COLUMN IF NOT EXISTS country_code  CHAR(2) DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS currency_code CHAR(3) DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS exchange_mic  TEXT;

COMMENT ON COLUMN markets.instruments.asset_class   IS 'High-level class: equity|mutual_fund|commodity|forex|fixed_income|derivative|reit|cash';
COMMENT ON COLUMN markets.instruments.currency_code IS 'Trading currency of the instrument (default INR)';
COMMENT ON COLUMN markets.instruments.exchange_mic  IS 'ISO 10383 MIC code: XNSE, XBOM, XMCX, XNYS, etc.';

-- Back-fill existing instrument rows
UPDATE markets.instruments SET asset_class = 'equity'
  WHERE asset_class IS NULL OR asset_class = 'equity';
UPDATE markets.instruments SET asset_class = 'derivative'
  WHERE instrument_type IN ('futures','option');
UPDATE markets.instruments SET exchange_mic = 'XNSE'
  WHERE exchange = 'NSE' AND exchange_mic IS NULL;
UPDATE markets.instruments SET exchange_mic = 'XBOM'
  WHERE exchange = 'BSE' AND exchange_mic IS NULL;

-- ── 2. Extend markets.holdings ──────────────────────────────────────────
ALTER TABLE markets.holdings
  ADD COLUMN IF NOT EXISTS asset_class   TEXT,
  ADD COLUMN IF NOT EXISTS folio_number  TEXT,
  ADD COLUMN IF NOT EXISTS sip_amount    NUMERIC,
  ADD COLUMN IF NOT EXISTS sip_date      INTEGER;   -- day of month (1-28)

-- ── 3. markets.mf_schemes — AMFI mutual fund metadata ──────────────────
CREATE TABLE IF NOT EXISTS markets.mf_schemes (
  instrument_id   UUID        PRIMARY KEY REFERENCES markets.instruments(id) ON DELETE CASCADE,
  amfi_code       TEXT        UNIQUE NOT NULL,
  isin_growth     TEXT,
  isin_idcw       TEXT,
  amc_name        TEXT,
  category        TEXT,        -- SEBI category e.g. "Equity Scheme - Large Cap Fund"
  sub_category    TEXT,
  plan_type       TEXT         CHECK (plan_type  IN ('direct','regular')),
  option_type     TEXT         CHECK (option_type IN ('growth','idcw','bonus')),
  aum_cr          NUMERIC,
  expense_ratio   NUMERIC,
  fund_manager    TEXT[],
  benchmark       TEXT,
  exit_load_pct   NUMERIC,
  exit_load_days  INTEGER,
  min_sip_amount  NUMERIC      DEFAULT 500,
  risk_rating     TEXT         CHECK (risk_rating IN ('low','low_to_moderate','moderate','moderately_high','high','very_high')),
  metadata        JSONB,
  updated_at      TIMESTAMPTZ  DEFAULT now()
);

-- ── 4. markets.fx_rates — intraday + EOD foreign-exchange rates ─────────
CREATE TABLE IF NOT EXISTS markets.fx_rates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  base_ccy    CHAR(3)     NOT NULL,
  quote_ccy   CHAR(3)     NOT NULL,
  rate        NUMERIC(18,6) NOT NULL,
  ts          TIMESTAMPTZ NOT NULL,
  source      TEXT        DEFAULT 'frankfurter',
  UNIQUE (base_ccy, quote_ccy, ts)
);
CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_ts
  ON markets.fx_rates (base_ccy, quote_ccy, ts DESC);

-- ── 5. markets.transactions — the backbone of all P&L / cost basis ──────
CREATE TABLE IF NOT EXISTS markets.transactions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID        NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  instrument_id   UUID        REFERENCES markets.instruments(id),
  txn_type        TEXT        NOT NULL
    CHECK (txn_type IN (
      'buy','sell',
      'sip','redemption',
      'dividend','interest',
      'bonus','split',
      'transfer_in','transfer_out',
      'fd_deposit','fd_maturity',
      'fee','adjustment'
    )),
  txn_date        DATE        NOT NULL,
  settlement_date DATE,
  qty             NUMERIC     NOT NULL DEFAULT 0,
  price           NUMERIC     NOT NULL DEFAULT 0,
  charges         NUMERIC     DEFAULT 0,  -- brokerage + STT + GST + stamp duty
  net_amount      NUMERIC,                -- positive = cash out (buy), negative = cash in (sell)
  currency        CHAR(3)     DEFAULT 'INR',
  fx_rate         NUMERIC     DEFAULT 1,  -- rate to portfolio base_currency at txn date
  asset_class     TEXT,                   -- denormalised for fast reporting
  notes           TEXT,
  source          TEXT        DEFAULT 'manual'
    CHECK (source IN ('manual','import','broker_api','cas_import')),
  reference_id    TEXT,        -- broker order ID or AMFI txn ref
  folio_number    TEXT,        -- MF folio
  owner_user_id   UUID        NOT NULL REFERENCES auth.users(id),
  tenant_id       UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_txn_portfolio_date
  ON markets.transactions (portfolio_id, txn_date DESC);
CREATE INDEX IF NOT EXISTS idx_txn_instrument
  ON markets.transactions (instrument_id) WHERE instrument_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_txn_owner
  ON markets.transactions (owner_user_id);

ALTER TABLE markets.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY txn_select ON markets.transactions FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY txn_insert ON markets.transactions FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY txn_update ON markets.transactions FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY txn_delete ON markets.transactions FOR DELETE USING (owner_user_id = auth.uid());

-- ── 6. markets.tax_lots — FIFO cost basis lots ──────────────────────────
CREATE TABLE IF NOT EXISTS markets.tax_lots (
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID     NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  instrument_id   UUID     REFERENCES markets.instruments(id),
  buy_txn_id      UUID     REFERENCES markets.transactions(id) ON DELETE CASCADE,
  buy_date        DATE     NOT NULL,
  buy_qty         NUMERIC  NOT NULL,
  buy_price       NUMERIC  NOT NULL,
  remaining_qty   NUMERIC  NOT NULL,
  is_closed       BOOLEAN  DEFAULT false,
  asset_class     TEXT,
  owner_user_id   UUID     REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_lots_open
  ON markets.tax_lots (portfolio_id, instrument_id) WHERE NOT is_closed;

ALTER TABLE markets.tax_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_lots_owner ON markets.tax_lots FOR ALL USING (owner_user_id = auth.uid());

-- ── 7. markets.portfolio_snapshots — daily NAV history ──────────────────
CREATE TABLE IF NOT EXISTS markets.portfolio_snapshots (
  id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    UUID     NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  snapshot_date   DATE     NOT NULL,
  total_nav       NUMERIC,
  invested_value  NUMERIC,
  unrealized_pnl  NUMERIC,
  realized_pnl    NUMERIC,
  cash_balance    NUMERIC  DEFAULT 0,
  day_change      NUMERIC,
  day_change_pct  NUMERIC,
  allocation      JSONB,   -- { equity: 0.45, mutual_fund: 0.30, gold: 0.08, cash: 0.17 }
  owner_user_id   UUID     REFERENCES auth.users(id),
  metadata        JSONB,
  UNIQUE (portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_portfolio_date
  ON markets.portfolio_snapshots (portfolio_id, snapshot_date DESC);

ALTER TABLE markets.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY snapshots_owner ON markets.portfolio_snapshots FOR ALL USING (owner_user_id = auth.uid());
