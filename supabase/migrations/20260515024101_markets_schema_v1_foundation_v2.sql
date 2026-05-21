-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515024101; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- =========================================================================
-- Markets domain v1 — Foundation migration
-- Schema + reference tables (no tenant scoping) + top-level user-owned tables
-- Per design doc §6.2 and ADR-001 / ADR-004 / ADR-012 / ADR-013
-- =========================================================================

CREATE SCHEMA IF NOT EXISTS markets;
GRANT USAGE ON SCHEMA markets TO authenticated, anon, service_role;

-- -------------------------------------------------------------------------
-- Reference tables — platform-wide, no tenant_id (ADR-012 documented exception)
-- -------------------------------------------------------------------------

CREATE TABLE markets.instruments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol          text NOT NULL,
  exchange        text NOT NULL,
  isin            text,
  instrument_type text NOT NULL,
  lot_size        integer,
  tick_size       numeric(10,4),
  expiry          date,
  strike          numeric(15,4),
  underlying_id   uuid REFERENCES markets.instruments(id),
  metadata        jsonb NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
-- Unique contract identity (handles options/futures via expiry+strike, spot via NULL sentinels)
CREATE UNIQUE INDEX instruments_unique_contract_idx
  ON markets.instruments
  (exchange, symbol, COALESCE(expiry, '1970-01-01'::date), COALESCE(strike, 0::numeric));
CREATE INDEX instruments_symbol_idx        ON markets.instruments (symbol);
CREATE INDEX instruments_isin_idx          ON markets.instruments (isin) WHERE isin IS NOT NULL;
CREATE INDEX instruments_type_active_idx   ON markets.instruments (instrument_type, is_active);
CREATE INDEX instruments_underlying_fk_idx ON markets.instruments (underlying_id) WHERE underlying_id IS NOT NULL;

CREATE TABLE markets.price_history (
  instrument_id uuid NOT NULL REFERENCES markets.instruments(id) ON DELETE CASCADE,
  ts            timestamptz NOT NULL,
  open          numeric(15,4),
  high          numeric(15,4),
  low           numeric(15,4),
  close         numeric(15,4),
  volume        bigint,
  oi            bigint,
  source        text,
  PRIMARY KEY (instrument_id, ts)
) PARTITION BY RANGE (ts);

CREATE TABLE markets.price_history_y2025
  PARTITION OF markets.price_history FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
CREATE TABLE markets.price_history_y2026
  PARTITION OF markets.price_history FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE markets.price_history_y2027
  PARTITION OF markets.price_history FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE INDEX price_history_ts_idx ON markets.price_history (ts DESC);

CREATE TABLE markets.news_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts              timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL,
  title           text NOT NULL,
  body            text,
  instruments     text[],
  sentiment_score numeric(5,4),
  raw_url         text,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX news_events_ts_idx          ON markets.news_events (ts DESC);
CREATE INDEX news_events_source_idx      ON markets.news_events (source);
CREATE INDEX news_events_instruments_gin ON markets.news_events USING gin (instruments);

-- -------------------------------------------------------------------------
-- Top-level user-owned tables — tenant_id + franchise_id NOT NULL (ADR-012)
-- -------------------------------------------------------------------------

CREATE TABLE markets.portfolios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id   uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  base_currency  text NOT NULL DEFAULT 'INR',
  mode           text NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper','live')),
  is_active      boolean NOT NULL DEFAULT true,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolios_tenant_fk_idx    ON markets.portfolios (tenant_id);
CREATE INDEX portfolios_franchise_fk_idx ON markets.portfolios (franchise_id);
CREATE INDEX portfolios_owner_fk_idx     ON markets.portfolios (owner_user_id);

CREATE TABLE markets.watchlists (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id   uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  is_default     boolean NOT NULL DEFAULT false,
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX watchlists_tenant_fk_idx    ON markets.watchlists (tenant_id);
CREATE INDEX watchlists_franchise_fk_idx ON markets.watchlists (franchise_id);
CREATE INDEX watchlists_owner_fk_idx     ON markets.watchlists (owner_user_id);

CREATE TABLE markets.strategies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id    uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id   uuid NOT NULL REFERENCES auth.users(id),
  name            text NOT NULL,
  description     text,
  dsl             text,
  compiled_code   text,
  lifecycle_state text NOT NULL DEFAULT 'draft'
                  CHECK (lifecycle_state IN ('draft','active','paused','archived')),
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX strategies_tenant_fk_idx    ON markets.strategies (tenant_id);
CREATE INDEX strategies_franchise_fk_idx ON markets.strategies (franchise_id);
CREATE INDEX strategies_owner_fk_idx     ON markets.strategies (owner_user_id);
CREATE INDEX strategies_lifecycle_idx    ON markets.strategies (lifecycle_state)
  WHERE lifecycle_state IN ('active','paused');

CREATE TABLE markets.research_threads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id   uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text NOT NULL DEFAULT 'New research thread',
  metadata       jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_threads_tenant_fk_idx    ON markets.research_threads (tenant_id);
CREATE INDEX research_threads_franchise_fk_idx ON markets.research_threads (franchise_id);
CREATE INDEX research_threads_owner_recent_idx ON markets.research_threads (owner_user_id, updated_at DESC);

-- -------------------------------------------------------------------------
-- RLS — single permissive policy per (role, command) using (SELECT auth.uid())
-- -------------------------------------------------------------------------

ALTER TABLE markets.instruments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.price_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.news_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.portfolios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.watchlists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.strategies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.research_threads  ENABLE ROW LEVEL SECURITY;

CREATE POLICY instruments_authenticated_read   ON markets.instruments       FOR SELECT TO authenticated USING (true);
CREATE POLICY price_history_authenticated_read ON markets.price_history     FOR SELECT TO authenticated USING (true);
CREATE POLICY news_events_authenticated_read   ON markets.news_events       FOR SELECT TO authenticated USING (true);

CREATE POLICY portfolios_owner_select ON markets.portfolios
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY portfolios_owner_insert ON markets.portfolios
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY portfolios_owner_update ON markets.portfolios
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY portfolios_owner_delete ON markets.portfolios
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY watchlists_owner_select ON markets.watchlists
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY watchlists_owner_insert ON markets.watchlists
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY watchlists_owner_update ON markets.watchlists
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY watchlists_owner_delete ON markets.watchlists
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY strategies_owner_select ON markets.strategies
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY strategies_owner_insert ON markets.strategies
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY strategies_owner_update ON markets.strategies
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY strategies_owner_delete ON markets.strategies
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY research_threads_owner_select ON markets.research_threads
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY research_threads_owner_insert ON markets.research_threads
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY research_threads_owner_update ON markets.research_threads
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY research_threads_owner_delete ON markets.research_threads
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA markets TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA markets TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA markets GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA markets GRANT ALL ON TABLES TO service_role;