-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260517075241; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- Price alerts: triggers a notification when LTP crosses a threshold
CREATE TABLE IF NOT EXISTS markets.price_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_id   uuid REFERENCES markets.instruments(id) ON DELETE CASCADE,
  symbol          text NOT NULL,
  exchange        text NOT NULL DEFAULT 'NSE',
  condition       text NOT NULL CHECK (condition IN ('above', 'below')),
  trigger_price   numeric(18,4) NOT NULL CHECK (trigger_price > 0),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled', 'expired')),
  triggered_at    timestamptz,
  triggered_price numeric(18,4),
  notes           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE markets.price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own price alerts"
  ON markets.price_alerts FOR ALL
  USING (user_id = auth.uid());

-- Index for fast active-alert polling
CREATE INDEX IF NOT EXISTS idx_price_alerts_active
  ON markets.price_alerts (symbol, exchange)
  WHERE status = 'active';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION markets.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER price_alerts_updated_at
  BEFORE UPDATE ON markets.price_alerts
  FOR EACH ROW EXECUTE FUNCTION markets.set_updated_at();