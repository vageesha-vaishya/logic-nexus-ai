-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515024202; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- =========================================================================
-- Markets domain v1 — Children & analysis-output tables
-- Holdings, watchlist_items, backtests, signals, briefs, research_messages
-- =========================================================================

CREATE TABLE markets.holdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    uuid NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  instrument_id   uuid NOT NULL REFERENCES markets.instruments(id),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id    uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qty             numeric(20,6) NOT NULL DEFAULT 0,
  avg_cost        numeric(20,6) NOT NULL DEFAULT 0,
  realized_pnl    numeric(20,6) NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}',
  UNIQUE (portfolio_id, instrument_id)
);
CREATE INDEX holdings_portfolio_fk_idx  ON markets.holdings (portfolio_id);
CREATE INDEX holdings_instrument_fk_idx ON markets.holdings (instrument_id);
CREATE INDEX holdings_tenant_fk_idx     ON markets.holdings (tenant_id);
CREATE INDEX holdings_franchise_fk_idx  ON markets.holdings (franchise_id);
CREATE INDEX holdings_owner_fk_idx      ON markets.holdings (owner_user_id);

CREATE TABLE markets.watchlist_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id  uuid NOT NULL REFERENCES markets.watchlists(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES markets.instruments(id),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id  uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note          text,
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, instrument_id)
);
CREATE INDEX watchlist_items_watchlist_fk_idx  ON markets.watchlist_items (watchlist_id);
CREATE INDEX watchlist_items_instrument_fk_idx ON markets.watchlist_items (instrument_id);
CREATE INDEX watchlist_items_tenant_fk_idx     ON markets.watchlist_items (tenant_id);
CREATE INDEX watchlist_items_franchise_fk_idx  ON markets.watchlist_items (franchise_id);
CREATE INDEX watchlist_items_owner_fk_idx      ON markets.watchlist_items (owner_user_id);

CREATE TABLE markets.backtests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id   uuid NOT NULL REFERENCES markets.strategies(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id  uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','running','completed','failed','cancelled')),
  params        jsonb NOT NULL DEFAULT '{}',
  metrics       jsonb,
  results_url   text,
  error         text
);
CREATE INDEX backtests_strategy_fk_idx  ON markets.backtests (strategy_id);
CREATE INDEX backtests_tenant_fk_idx    ON markets.backtests (tenant_id);
CREATE INDEX backtests_franchise_fk_idx ON markets.backtests (franchise_id);
CREATE INDEX backtests_owner_fk_idx     ON markets.backtests (owner_user_id);
CREATE INDEX backtests_status_idx       ON markets.backtests (status) WHERE status IN ('queued','running');

CREATE TABLE markets.signals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts            timestamptz NOT NULL DEFAULT now(),
  instrument_id uuid NOT NULL REFERENCES markets.instruments(id),
  strategy_id   uuid REFERENCES markets.strategies(id) ON DELETE SET NULL,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id  uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  signal_type   text NOT NULL CHECK (signal_type IN ('buy','sell','hold','alert','watch')),
  score         numeric(7,4),
  rationale     text,
  generated_by  text,
  metadata      jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX signals_ts_idx           ON markets.signals (ts DESC);
CREATE INDEX signals_instrument_fk_idx ON markets.signals (instrument_id);
CREATE INDEX signals_strategy_fk_idx  ON markets.signals (strategy_id) WHERE strategy_id IS NOT NULL;
CREATE INDEX signals_tenant_fk_idx    ON markets.signals (tenant_id);
CREATE INDEX signals_franchise_fk_idx ON markets.signals (franchise_id);
CREATE INDEX signals_owner_fk_idx     ON markets.signals (owner_user_id);

CREATE TABLE markets.briefs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts             timestamptz NOT NULL DEFAULT now(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id   uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope          text NOT NULL CHECK (scope IN ('portfolio','watchlist','sector','instrument','market')),
  scope_ref_id   uuid,
  title          text,
  body           text,
  sources        jsonb,
  llm_provider   text,
  llm_model      text,
  input_tokens   integer,
  output_tokens  integer,
  cost_usd       numeric(12,6),
  metadata       jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX briefs_tenant_fk_idx     ON markets.briefs (tenant_id);
CREATE INDEX briefs_franchise_fk_idx  ON markets.briefs (franchise_id);
CREATE INDEX briefs_owner_recent_idx  ON markets.briefs (owner_user_id, ts DESC);
CREATE INDEX briefs_scope_idx         ON markets.briefs (scope, scope_ref_id);

CREATE TABLE markets.research_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id      uuid NOT NULL REFERENCES markets.research_threads(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),
  franchise_id   uuid NOT NULL REFERENCES public.franchises(id),
  owner_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role           text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content        text NOT NULL,
  tool_calls     jsonb,
  llm_provider   text,
  llm_model      text,
  input_tokens   integer,
  output_tokens  integer,
  cost_usd       numeric(12,6),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_messages_thread_idx     ON markets.research_messages (thread_id, created_at);
CREATE INDEX research_messages_tenant_fk_idx  ON markets.research_messages (tenant_id);
CREATE INDEX research_messages_franchise_fk_idx ON markets.research_messages (franchise_id);
CREATE INDEX research_messages_owner_fk_idx   ON markets.research_messages (owner_user_id);

-- RLS — owner-based, single permissive policy per (role, command)
ALTER TABLE markets.holdings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.watchlist_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.backtests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.signals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.briefs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.research_messages  ENABLE ROW LEVEL SECURITY;

-- holdings
CREATE POLICY holdings_owner_select ON markets.holdings
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY holdings_owner_insert ON markets.holdings
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY holdings_owner_update ON markets.holdings
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY holdings_owner_delete ON markets.holdings
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

-- watchlist_items
CREATE POLICY watchlist_items_owner_select ON markets.watchlist_items
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY watchlist_items_owner_insert ON markets.watchlist_items
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY watchlist_items_owner_update ON markets.watchlist_items
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY watchlist_items_owner_delete ON markets.watchlist_items
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

-- backtests
CREATE POLICY backtests_owner_select ON markets.backtests
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY backtests_owner_insert ON markets.backtests
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY backtests_owner_update ON markets.backtests
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY backtests_owner_delete ON markets.backtests
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

-- signals
CREATE POLICY signals_owner_select ON markets.signals
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY signals_owner_insert ON markets.signals
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY signals_owner_update ON markets.signals
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY signals_owner_delete ON markets.signals
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

-- briefs
CREATE POLICY briefs_owner_select ON markets.briefs
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY briefs_owner_insert ON markets.briefs
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY briefs_owner_update ON markets.briefs
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY briefs_owner_delete ON markets.briefs
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

-- research_messages
CREATE POLICY research_messages_owner_select ON markets.research_messages
  FOR SELECT TO authenticated USING (owner_user_id = (SELECT auth.uid()));
CREATE POLICY research_messages_owner_insert ON markets.research_messages
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY research_messages_owner_update ON markets.research_messages
  FOR UPDATE TO authenticated USING (owner_user_id = (SELECT auth.uid()))
                              WITH CHECK (owner_user_id = (SELECT auth.uid()));
CREATE POLICY research_messages_owner_delete ON markets.research_messages
  FOR DELETE TO authenticated USING (owner_user_id = (SELECT auth.uid()));

-- Refresh privileges for new tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA markets TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA markets TO service_role;