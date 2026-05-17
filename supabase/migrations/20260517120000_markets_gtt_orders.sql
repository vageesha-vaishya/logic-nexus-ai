-- markets.gtt_orders — persists GTT state synced from broker
CREATE TABLE IF NOT EXISTS markets.gtt_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id    uuid NOT NULL REFERENCES markets.broker_connections(id) ON DELETE CASCADE,
  broker_gtt_id    text NOT NULL,
  owner_user_id    uuid NOT NULL,
  tenant_id        uuid NOT NULL,
  franchise_id     uuid NOT NULL,
  tradingsymbol    text NOT NULL,
  exchange         text NOT NULL,
  trigger_type     text NOT NULL DEFAULT 'single',  -- single | oco
  ltp_at_creation  numeric,
  status           text NOT NULL DEFAULT 'active',   -- active | triggered | cancelled | expired
  triggers         jsonb NOT NULL DEFAULT '[]',
  triggered_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, broker_gtt_id)
);

CREATE INDEX idx_gtt_orders_owner ON markets.gtt_orders (owner_user_id, status);
CREATE INDEX idx_gtt_orders_connection ON markets.gtt_orders (connection_id);

ALTER TABLE markets.gtt_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own gtts"
  ON markets.gtt_orders FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "service role full access"
  ON markets.gtt_orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
