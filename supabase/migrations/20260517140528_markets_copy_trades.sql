-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517140528; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ── Copy Trading relationships ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.copy_trades (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copier_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trader_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    paper_portfolio_id  UUID NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
    allocation_pct      NUMERIC(5,2) NOT NULL DEFAULT 10.0 CHECK (allocation_pct > 0 AND allocation_pct <= 100),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (copier_id, trader_id)
);

CREATE INDEX IF NOT EXISTS copy_trades_copier_id_idx  ON markets.copy_trades(copier_id);
CREATE INDEX IF NOT EXISTS copy_trades_trader_id_idx  ON markets.copy_trades(trader_id);

ALTER TABLE markets.copy_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY copy_trades_select ON markets.copy_trades FOR SELECT USING (auth.uid() = copier_id);
CREATE POLICY copy_trades_insert ON markets.copy_trades FOR INSERT WITH CHECK (auth.uid() = copier_id);
CREATE POLICY copy_trades_update ON markets.copy_trades FOR UPDATE USING (auth.uid() = copier_id);
CREATE POLICY copy_trades_delete ON markets.copy_trades FOR DELETE USING (auth.uid() = copier_id);

-- ── Executed copy orders log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS markets.copy_executions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    copy_trade_id    UUID NOT NULL REFERENCES markets.copy_trades(id) ON DELETE CASCADE,
    idea_id          UUID REFERENCES markets.ideas(id) ON DELETE SET NULL,
    copier_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol           TEXT NOT NULL,
    side             TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity         NUMERIC(18,4) NOT NULL,
    price            NUMERIC(18,4) NOT NULL,
    amount           NUMERIC(18,4) NOT NULL,
    paper_portfolio_id UUID NOT NULL,
    executed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS copy_executions_copy_trade_id_idx ON markets.copy_executions(copy_trade_id);
CREATE INDEX IF NOT EXISTS copy_executions_copier_id_idx     ON markets.copy_executions(copier_id);

ALTER TABLE markets.copy_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY copy_executions_select ON markets.copy_executions FOR SELECT USING (auth.uid() = copier_id);
CREATE POLICY copy_executions_insert ON markets.copy_executions FOR INSERT WITH CHECK (auth.uid() = copier_id);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'copy_trades_updated_at') THEN
    CREATE TRIGGER copy_trades_updated_at
      BEFORE UPDATE ON markets.copy_trades
      FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();
  END IF;
END $$;
