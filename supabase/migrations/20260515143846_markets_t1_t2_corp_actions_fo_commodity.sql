-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515143846; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ══════════════════════════════════════════════════════════════════════════
-- T1: Corporate actions table
-- T2: Extend instruments for F&O + commodity fields
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. markets.corporate_actions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.corporate_actions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id UUID        REFERENCES markets.instruments(id) ON DELETE CASCADE,
  action_type   TEXT        NOT NULL
    CHECK (action_type IN ('dividend','bonus','split','rights','merger','demerger','buyback')),
  ex_date       DATE        NOT NULL,
  record_date   DATE,
  ratio         NUMERIC,
  dividend_amt  NUMERIC,
  face_value    NUMERIC,
  remarks       TEXT,
  source        TEXT        DEFAULT 'yahoo_finance',
  raw_data      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (instrument_id, action_type, ex_date)
);

CREATE INDEX IF NOT EXISTS idx_corp_actions_instr_date
  ON markets.corporate_actions (instrument_id, ex_date DESC);
CREATE INDEX IF NOT EXISTS idx_corp_actions_exdate
  ON markets.corporate_actions (ex_date DESC);

-- ── 2. Extend markets.instruments for F&O + commodity ────────────────────
ALTER TABLE markets.instruments
  ADD COLUMN IF NOT EXISTS underlying_id    UUID REFERENCES markets.instruments(id),
  ADD COLUMN IF NOT EXISTS option_type      TEXT   CHECK (option_type IN ('CE','PE')),
  ADD COLUMN IF NOT EXISTS delivery_unit    TEXT,
  ADD COLUMN IF NOT EXISTS contract_months  TEXT[];

CREATE INDEX IF NOT EXISTS idx_instruments_underlying
  ON markets.instruments (underlying_id) WHERE underlying_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instruments_asset_class
  ON markets.instruments (asset_class) WHERE asset_class IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_instruments_expiry
  ON markets.instruments (expiry) WHERE expiry IS NOT NULL;

-- ── 3. Pre-seed commodity spot instruments ────────────────────────────────
DO $$
DECLARE rows TEXT[][] := ARRAY[
  ARRAY['GOLD',        'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Gold","unit":"gram"}'],
  ARRAY['SILVER',      'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Silver","unit":"kg"}'],
  ARRAY['CRUDEOIL',    'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Crude Oil","unit":"barrel"}'],
  ARRAY['NATURALGAS',  'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Natural Gas","unit":"mmbtu"}'],
  ARRAY['COPPER',      'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Copper","unit":"kg"}'],
  ARRAY['ALUMINIUM',   'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Aluminium","unit":"kg"}'],
  ARRAY['ZINC',        'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Zinc","unit":"kg"}'],
  ARRAY['LEAD',        'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Lead","unit":"kg"}'],
  ARRAY['NICKEL',      'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Nickel","unit":"kg"}'],
  ARRAY['COTTON',      'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Cotton","unit":"bale"}'],
  ARRAY['MENTHAOIL',   'MCX', 'commodity_spot', 'commodity', 'INR', 'XMCX', '{"name":"Mentha Oil","unit":"kg"}']
];
r TEXT[];
BEGIN
  FOREACH r SLICE 1 IN ARRAY rows LOOP
    INSERT INTO markets.instruments (symbol, exchange, instrument_type, asset_class, currency_code, exchange_mic, country_code, is_active, metadata)
    SELECT r[1], r[2], r[3], r[4], r[5], r[6], 'IN', true, r[7]::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM markets.instruments WHERE exchange = r[2] AND symbol = r[1]
    );
  END LOOP;
END $$;

-- ── 4. Pre-seed index underlyings for F&O ─────────────────────────────────
DO $$
DECLARE rows TEXT[][] := ARRAY[
  ARRAY['NIFTY',     'NSE', 'index', '{"name":"NIFTY 50","lot_size":25}'],
  ARRAY['BANKNIFTY', 'NSE', 'index', '{"name":"NIFTY Bank","lot_size":15}'],
  ARRAY['FINNIFTY',  'NSE', 'index', '{"name":"NIFTY Financial Services","lot_size":40}'],
  ARRAY['MIDCPNIFTY','NSE', 'index', '{"name":"NIFTY Midcap Select","lot_size":75}'],
  ARRAY['SENSEX',    'BSE', 'index', '{"name":"S&P BSE SENSEX","lot_size":10}']
];
r TEXT[];
BEGIN
  FOREACH r SLICE 1 IN ARRAY rows LOOP
    INSERT INTO markets.instruments (symbol, exchange, instrument_type, asset_class, currency_code, exchange_mic, country_code, is_active, metadata)
    SELECT r[1], r[2], r[3], 'equity', 'INR', CASE WHEN r[2]='BSE' THEN 'XBOM' ELSE 'XNSE' END, 'IN', true, r[4]::jsonb
    WHERE NOT EXISTS (
      SELECT 1 FROM markets.instruments WHERE exchange = r[2] AND symbol = r[1]
    );
  END LOOP;
END $$;
