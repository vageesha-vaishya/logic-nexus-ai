-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516155002; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ══════════════════════════════════════════════════════════════════════════
-- T2.5 Phase A: Broker connectivity tables
-- markets.broker_connections, markets.orders, markets.positions
-- ══════════════════════════════════════════════════════════════════════════
-- DB-VERIFICATION: markets-broker-connectivity-v1
-- DB-ARCH-APPROVAL: vimal-2026-05-16

-- ── Supported brokers enum ────────────────────────────────────────────────────
CREATE TYPE markets.broker_name AS ENUM (
  'icici_breeze',
  'angel_one',
  'dhan',
  'fyers',
  'zerodha',
  'upstox',
  'hdfc_securities',
  'kotak_neo',
  '5paisa'
);

-- ── markets.broker_connections ────────────────────────────────────────────────
-- One row per user-broker account link.
-- credentials_enc: Fernet-encrypted JSON blob containing all auth tokens.
-- Schema of the decrypted JSON varies per broker (see brokers/*.py).
CREATE TABLE markets.broker_connections (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id        UUID        NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  owner_user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id        UUID        REFERENCES markets.portfolios(id) ON DELETE SET NULL,

  broker              markets.broker_name NOT NULL,
  broker_client_id    TEXT        NOT NULL,        -- broker's account/client ID
  display_name        TEXT        NOT NULL,        -- e.g. "Zerodha – Vimal Bahuguna"
  status              TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','expired','revoked','error')),

  credentials_enc     TEXT,                        -- Fernet-encrypted JSON
  token_expires_at    TIMESTAMPTZ,                 -- when the access token expires
  last_synced_at      TIMESTAMPTZ,                 -- last successful broker sync

  -- Capabilities enabled for this connection
  can_trade           BOOLEAN NOT NULL DEFAULT false,
  can_read_holdings   BOOLEAN NOT NULL DEFAULT true,
  can_read_positions  BOOLEAN NOT NULL DEFAULT true,
  can_read_orders     BOOLEAN NOT NULL DEFAULT true,
  segments            TEXT[]  NOT NULL DEFAULT ARRAY['equity'],
                               -- equity | fno | currency | commodity | mf

  error_message       TEXT,    -- last auth/sync error
  metadata            JSONB   NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (owner_user_id, broker, broker_client_id)
);

-- ── markets.orders ────────────────────────────────────────────────────────────
CREATE TABLE markets.orders (
  id                    UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID   NOT NULL REFERENCES public.tenants(id),
  franchise_id          UUID   NOT NULL REFERENCES public.franchises(id),
  owner_user_id         UUID   NOT NULL REFERENCES auth.users(id),
  portfolio_id          UUID   NOT NULL REFERENCES markets.portfolios(id),
  broker_connection_id  UUID   NOT NULL REFERENCES markets.broker_connections(id),

  broker_order_id       TEXT,                 -- broker's own order ID
  exchange              TEXT   NOT NULL,       -- NSE | BSE | MCX | NCDEX | CDS | NFO
  segment               TEXT   NOT NULL DEFAULT 'equity',
                                              -- equity | fno | currency | commodity | mf
  instrument_id         UUID   REFERENCES markets.instruments(id),
  tradingsymbol         TEXT   NOT NULL,      -- broker-specific symbol

  order_type            TEXT   NOT NULL,      -- MARKET | LIMIT | SL | SL-M | AMO | GTT
  product               TEXT   NOT NULL,      -- CNC | MIS | NRML
  transaction_type      TEXT   NOT NULL CHECK (transaction_type IN ('BUY','SELL')),

  quantity              NUMERIC(18,4) NOT NULL,
  price                 NUMERIC(18,4),        -- NULL for market orders
  trigger_price         NUMERIC(18,4),        -- for SL orders
  disclosed_quantity    NUMERIC(18,4) DEFAULT 0,
  validity              TEXT   NOT NULL DEFAULT 'DAY', -- DAY | IOC | TTL | GTC

  status                TEXT   NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','pending','complete','cancelled','rejected','modified')),
  filled_quantity       NUMERIC(18,4) DEFAULT 0,
  avg_fill_price        NUMERIC(18,4),
  pending_quantity      NUMERIC(18,4),
  cancelled_quantity    NUMERIC(18,4) DEFAULT 0,
  status_message        TEXT,

  algo_tag              TEXT,                 -- SEBI algo_id for system-generated orders
  parent_order_id       UUID REFERENCES markets.orders(id),  -- bracket/OCO legs
  source                TEXT NOT NULL DEFAULT 'manual'
                          CHECK (source IN ('manual','strategy','signal','bracket','gtt')),

  placed_at             TIMESTAMPTZ,
  exchange_timestamp    TIMESTAMPTZ,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── markets.positions ─────────────────────────────────────────────────────────
CREATE TABLE markets.positions (
  id                    UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID   NOT NULL REFERENCES public.tenants(id),
  franchise_id          UUID   NOT NULL REFERENCES public.franchises(id),
  owner_user_id         UUID   NOT NULL REFERENCES auth.users(id),
  portfolio_id          UUID   NOT NULL REFERENCES markets.portfolios(id),
  broker_connection_id  UUID   NOT NULL REFERENCES markets.broker_connections(id),

  exchange              TEXT   NOT NULL,
  segment               TEXT   NOT NULL DEFAULT 'equity',
  tradingsymbol         TEXT   NOT NULL,
  instrument_id         UUID   REFERENCES markets.instruments(id),
  product               TEXT   NOT NULL CHECK (product IN ('MIS','NRML','CNC')),

  quantity              NUMERIC(18,4) NOT NULL,   -- net; negative = short
  overnight_quantity    NUMERIC(18,4) DEFAULT 0,
  buy_quantity          NUMERIC(18,4) DEFAULT 0,
  sell_quantity         NUMERIC(18,4) DEFAULT 0,
  buy_price             NUMERIC(18,4),
  sell_price            NUMERIC(18,4),
  avg_price             NUMERIC(18,4) NOT NULL,
  last_price            NUMERIC(18,4),
  close_price           NUMERIC(18,4),            -- previous day close

  pnl                   NUMERIC(18,4),            -- unrealised P&L
  realised_pnl          NUMERIC(18,4) DEFAULT 0,
  m2m                   NUMERIC(18,4),            -- mark-to-market (F&O)
  multiplier            NUMERIC(10,4) DEFAULT 1,  -- lot multiplier
  value                 NUMERIC(18,4),            -- abs qty × last_price × multiplier

  day_buy_quantity      NUMERIC(18,4) DEFAULT 0,
  day_sell_quantity     NUMERIC(18,4) DEFAULT 0,

  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata              JSONB   NOT NULL DEFAULT '{}',

  UNIQUE (portfolio_id, broker_connection_id, tradingsymbol, exchange, product)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_broker_connections_owner   ON markets.broker_connections (owner_user_id);
CREATE INDEX idx_broker_connections_portfolio ON markets.broker_connections (portfolio_id);
CREATE INDEX idx_broker_connections_status  ON markets.broker_connections (status) WHERE status = 'active';

CREATE INDEX idx_orders_portfolio           ON markets.orders (portfolio_id);
CREATE INDEX idx_orders_broker_connection   ON markets.orders (broker_connection_id);
CREATE INDEX idx_orders_status              ON markets.orders (status);
CREATE INDEX idx_orders_placed_at           ON markets.orders (placed_at DESC);
CREATE INDEX idx_orders_tradingsymbol       ON markets.orders (tradingsymbol, exchange);

CREATE INDEX idx_positions_portfolio        ON markets.positions (portfolio_id);
CREATE INDEX idx_positions_broker_connection ON markets.positions (broker_connection_id);
CREATE INDEX idx_positions_tradingsymbol    ON markets.positions (tradingsymbol, exchange);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE markets.broker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.positions          ENABLE ROW LEVEL SECURITY;

-- broker_connections: owner sees their own only
CREATE POLICY bc_owner_select ON markets.broker_connections FOR SELECT
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY bc_owner_insert ON markets.broker_connections FOR INSERT
  WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY bc_owner_update ON markets.broker_connections FOR UPDATE
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY bc_owner_delete ON markets.broker_connections FOR DELETE
  USING (owner_user_id = (SELECT auth.uid()));

-- orders: owner sees their own only
CREATE POLICY ord_owner_select ON markets.orders FOR SELECT
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY ord_owner_insert ON markets.orders FOR INSERT
  WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY ord_owner_update ON markets.orders FOR UPDATE
  USING (owner_user_id = (SELECT auth.uid()));

-- positions: owner sees their own only
CREATE POLICY pos_owner_select ON markets.positions FOR SELECT
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY pos_owner_insert ON markets.positions FOR INSERT
  WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY pos_owner_update ON markets.positions FOR UPDATE
  USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY pos_owner_delete ON markets.positions FOR DELETE
  USING (owner_user_id = (SELECT auth.uid()));

-- ── Updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION markets.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_bc_updated_at  BEFORE UPDATE ON markets.broker_connections
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
CREATE TRIGGER trg_ord_updated_at BEFORE UPDATE ON markets.orders
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();

COMMENT ON TABLE markets.broker_connections IS
  'Per-user broker account links. credentials_enc is Fernet-encrypted JSON; decryption key in BROKER_ENCRYPTION_KEY env var.';
COMMENT ON TABLE markets.orders IS
  'Full order lifecycle — placement through fills. broker_order_id is the broker''s own ID.';
COMMENT ON TABLE markets.positions IS
  'Open positions synced from broker. Refreshed every 30min during market hours.';
