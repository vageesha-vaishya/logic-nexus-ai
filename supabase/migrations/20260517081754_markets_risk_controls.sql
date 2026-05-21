-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517081754; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


CREATE TABLE IF NOT EXISTS markets.risk_controls (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id         uuid REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  daily_loss_limit_inr numeric(18,2),
  max_position_pct     numeric(5,2) DEFAULT 10.0,
  equity_enabled       boolean NOT NULL DEFAULT true,
  fno_enabled          boolean NOT NULL DEFAULT true,
  mf_enabled           boolean NOT NULL DEFAULT true,
  kill_switch_active   boolean NOT NULL DEFAULT false,
  kill_switch_reason   text,
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE markets.risk_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own risk controls"
  ON markets.risk_controls FOR ALL
  USING (user_id = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_controls_user_portfolio
  ON markets.risk_controls (user_id, COALESCE(portfolio_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE OR REPLACE FUNCTION markets.set_risk_controls_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER risk_controls_updated_at
  BEFORE UPDATE ON markets.risk_controls
  FOR EACH ROW EXECUTE FUNCTION markets.set_risk_controls_updated_at();
