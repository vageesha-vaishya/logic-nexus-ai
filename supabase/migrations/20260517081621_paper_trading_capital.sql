-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517081621; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Paper capital: tracks virtual cash balance for paper portfolios
CREATE TABLE IF NOT EXISTS markets.paper_capital (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id    uuid NOT NULL UNIQUE REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  initial_capital numeric(18,2) NOT NULL DEFAULT 1000000.00,
  available_cash  numeric(18,2) NOT NULL DEFAULT 1000000.00,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE markets.paper_capital ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own paper capital"
  ON markets.paper_capital FOR ALL
  USING (
    portfolio_id IN (
      SELECT id FROM markets.portfolios WHERE owner_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_paper_capital_portfolio ON markets.paper_capital (portfolio_id);
