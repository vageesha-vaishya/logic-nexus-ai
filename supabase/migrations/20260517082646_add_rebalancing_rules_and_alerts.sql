-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517082646; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

CREATE TABLE IF NOT EXISTS markets.rebalancing_rules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id     uuid NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  instrument_id    uuid REFERENCES markets.instruments(id) ON DELETE CASCADE,
  symbol           text,
  target_weight    numeric(5,2),
  min_weight       numeric(5,2),
  max_weight       numeric(5,2),
  alert_enabled    boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(portfolio_id, instrument_id)
);

ALTER TABLE markets.rebalancing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own rebalancing rules"
  ON markets.rebalancing_rules FOR ALL
  USING (
    portfolio_id IN (
      SELECT id FROM markets.portfolios WHERE owner_user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS markets.rebalancing_alerts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id          uuid NOT NULL REFERENCES markets.rebalancing_rules(id) ON DELETE CASCADE,
  portfolio_id     uuid NOT NULL,
  symbol           text NOT NULL,
  current_weight   numeric(5,2) NOT NULL,
  target_weight    numeric(5,2),
  direction        text NOT NULL CHECK (direction IN ('over', 'under')),
  triggered_at     timestamptz DEFAULT now(),
  acknowledged     boolean DEFAULT false
);

ALTER TABLE markets.rebalancing_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own rebalancing alerts"
  ON markets.rebalancing_alerts FOR ALL
  USING (
    portfolio_id IN (
      SELECT id FROM markets.portfolios WHERE owner_user_id = auth.uid()
    )
  );