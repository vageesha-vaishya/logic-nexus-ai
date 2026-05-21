-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260519112753; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Starter portfolio templates (Phase 1 Addendum T14).
CREATE TABLE IF NOT EXISTS markets.portfolio_templates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  display_name      text NOT NULL,
  description       text NOT NULL,
  risk_tag          text NOT NULL
                    CHECK (risk_tag IN ('conservative', 'moderate', 'aggressive')),
  tier_allocations  jsonb NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  display_order     int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_templates_active_order_idx
  ON markets.portfolio_templates (is_active, display_order);

ALTER TABLE markets.portfolio_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'markets' AND tablename = 'portfolio_templates'
      AND policyname = 'Authenticated users read templates'
  ) THEN
    CREATE POLICY "Authenticated users read templates"
      ON markets.portfolio_templates
      FOR SELECT
      TO authenticated
      USING (is_active = true);
  END IF;
END$$;

DROP TRIGGER IF EXISTS portfolio_templates_set_updated_at ON markets.portfolio_templates;
CREATE TRIGGER portfolio_templates_set_updated_at
  BEFORE UPDATE ON markets.portfolio_templates
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();

INSERT INTO markets.portfolio_templates (slug, display_name, description, risk_tag, display_order, tier_allocations)
VALUES
  (
    'conservative',
    'Conservative',
    'Capital preservation first. 70% safety, 25% growth, 5% experimental. Right if you cant afford to lose 10%+ in a downturn or youre investing for a goal within 5 years.',
    'conservative',
    10,
    $json$[
      {"tier_number":1,"weight_pct":70,"focus":"Safety Net — debt funds + arbitrage + emergency cash","suggested_holdings":[{"symbol":"LIQUIDBEES","exchange":"NSE","name":"Nippon Liquid ETF","weight_pct":30},{"symbol":"SBINIFTYBEE","exchange":"NSE","name":"SBI Nifty 50 ETF","weight_pct":25},{"symbol":"ICICILOVOL","exchange":"NSE","name":"ICICI Low Vol 30 ETF","weight_pct":15}]},
      {"tier_number":2,"weight_pct":25,"focus":"Core — broad-market index funds","suggested_holdings":[{"symbol":"NIFTYBEES","exchange":"NSE","name":"Nippon Nifty 50 ETF","weight_pct":15},{"symbol":"JUNIORBEES","exchange":"NSE","name":"Nippon Nifty Next 50 ETF","weight_pct":10}]},
      {"tier_number":3,"weight_pct":5,"focus":"Experimental — small allocation for learning","suggested_holdings":[{"symbol":"MOM50","exchange":"NSE","name":"Mirae Asset Nifty 200 Momentum 30 ETF","weight_pct":5}]}
    ]$json$::jsonb
  ),
  (
    'balanced',
    'Balanced',
    '55% safety, 35% growth, 10% experimental. The standard answer for most working professionals — enough growth to outpace inflation, enough cushion to survive a crash without panic.',
    'moderate',
    20,
    $json$[
      {"tier_number":1,"weight_pct":55,"focus":"Safety Net — debt + arbitrage","suggested_holdings":[{"symbol":"LIQUIDBEES","exchange":"NSE","name":"Nippon Liquid ETF","weight_pct":25},{"symbol":"GILT5YBEES","exchange":"NSE","name":"5Y Gilt ETF","weight_pct":20},{"symbol":"ICICILOVOL","exchange":"NSE","name":"ICICI Low Vol 30 ETF","weight_pct":10}]},
      {"tier_number":2,"weight_pct":35,"focus":"Core — diversified equity","suggested_holdings":[{"symbol":"NIFTYBEES","exchange":"NSE","name":"Nippon Nifty 50 ETF","weight_pct":18},{"symbol":"BANKBEES","exchange":"NSE","name":"Nippon Bank ETF","weight_pct":10},{"symbol":"MAFANG","exchange":"NSE","name":"Mirae Asset NYSE FANG+ ETF","weight_pct":7}]},
      {"tier_number":3,"weight_pct":10,"focus":"Experimental — momentum + sectoral tilts","suggested_holdings":[{"symbol":"MOM50","exchange":"NSE","name":"Mirae Momentum 30 ETF","weight_pct":6},{"symbol":"ITBEES","exchange":"NSE","name":"Nippon IT ETF","weight_pct":4}]}
    ]$json$::jsonb
  ),
  (
    'growth',
    'Growth',
    '40% safety, 40% growth, 20% experimental. Higher reward potential and higher swings. Suitable if youre investing for >10 years and can ride out a 20%+ drawdown without selling.',
    'aggressive',
    30,
    $json$[
      {"tier_number":1,"weight_pct":40,"focus":"Safety Net — debt + low-vol equity","suggested_holdings":[{"symbol":"GILT5YBEES","exchange":"NSE","name":"5Y Gilt ETF","weight_pct":20},{"symbol":"ICICILOVOL","exchange":"NSE","name":"ICICI Low Vol 30 ETF","weight_pct":20}]},
      {"tier_number":2,"weight_pct":40,"focus":"Core — broad-market + international","suggested_holdings":[{"symbol":"NIFTYBEES","exchange":"NSE","name":"Nippon Nifty 50 ETF","weight_pct":20},{"symbol":"JUNIORBEES","exchange":"NSE","name":"Nippon Nifty Next 50 ETF","weight_pct":10},{"symbol":"MAFANG","exchange":"NSE","name":"Mirae Asset NYSE FANG+ ETF","weight_pct":10}]},
      {"tier_number":3,"weight_pct":20,"focus":"Experimental — momentum, sectors, small-cap","suggested_holdings":[{"symbol":"MOM50","exchange":"NSE","name":"Mirae Momentum 30 ETF","weight_pct":8},{"symbol":"ITBEES","exchange":"NSE","name":"Nippon IT ETF","weight_pct":6},{"symbol":"SMALLCAP","exchange":"NSE","name":"Nippon Small Cap ETF","weight_pct":6}]}
    ]$json$::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  description      = EXCLUDED.description,
  risk_tag         = EXCLUDED.risk_tag,
  tier_allocations = EXCLUDED.tier_allocations,
  display_order    = EXCLUDED.display_order,
  is_active        = true,
  updated_at       = now();