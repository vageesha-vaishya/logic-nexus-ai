-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516080945; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ── Feature flags core tables ────────────────────────────────────────────────

CREATE TABLE platform.feature_flags (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text    UNIQUE NOT NULL,         -- e.g. 'markets.signals.fo_enabled'
  name         text    NOT NULL,
  description  text,
  enabled      boolean NOT NULL DEFAULT false,  -- global default
  rollout_pct  integer NOT NULL DEFAULT 100     -- 0–100; % of tenants that see it
    CHECK (rollout_pct BETWEEN 0 AND 100),
  tags         text[]  NOT NULL DEFAULT '{}',   -- grouping: {'markets','billing'}
  metadata     jsonb   NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform.feature_flags IS
  'Global feature flag definitions. Use feature_flag_overrides for per-tenant/user overrides.';

-- Per-scope overrides (tenant, user, or franchise can override the global value)
CREATE TABLE platform.feature_flag_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key    text NOT NULL REFERENCES platform.feature_flags(key) ON DELETE CASCADE,
  scope_type  text NOT NULL CHECK (scope_type IN ('tenant','user','franchise')),
  scope_id    uuid NOT NULL,
  enabled     boolean NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (flag_key, scope_type, scope_id)
);

COMMENT ON TABLE platform.feature_flag_overrides IS
  'Per-tenant/user/franchise flag overrides. Takes precedence over the global flag value.';

CREATE INDEX idx_ff_overrides_scope ON platform.feature_flag_overrides (scope_type, scope_id);
CREATE INDEX idx_ff_overrides_flag  ON platform.feature_flag_overrides (flag_key);

-- updated_at triggers
CREATE OR REPLACE FUNCTION platform.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ff_updated_at
  BEFORE UPDATE ON platform.feature_flags
  FOR EACH ROW EXECUTE FUNCTION platform.touch_updated_at();

CREATE TRIGGER trg_ffo_updated_at
  BEFORE UPDATE ON platform.feature_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION platform.touch_updated_at();

-- ── Resolution function ───────────────────────────────────────────────────────
-- Returns a jsonb map {flag_key: true|false} for a given context.
-- Priority: user override > tenant override > franchise override > global (+ rollout_pct)

CREATE OR REPLACE FUNCTION platform.resolve_flags(
  p_keys      text[],         -- flag keys to resolve
  p_tenant_id uuid DEFAULT NULL,
  p_user_id   uuid DEFAULT NULL,
  p_franchise_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  rec    record;
  val    boolean;
BEGIN
  FOR rec IN
    SELECT f.key, f.enabled, f.rollout_pct,
           -- pick highest-priority override (user > tenant > franchise)
           (SELECT o.enabled
            FROM platform.feature_flag_overrides o
            WHERE o.flag_key = f.key
              AND (  (p_user_id      IS NOT NULL AND o.scope_type = 'user'      AND o.scope_id = p_user_id)
                  OR (p_tenant_id    IS NOT NULL AND o.scope_type = 'tenant'    AND o.scope_id = p_tenant_id)
                  OR (p_franchise_id IS NOT NULL AND o.scope_type = 'franchise' AND o.scope_id = p_franchise_id)
                  )
            ORDER BY CASE o.scope_type WHEN 'user' THEN 1 WHEN 'franchise' THEN 2 ELSE 3 END
            LIMIT 1
           ) AS override
    FROM platform.feature_flags f
    WHERE f.key = ANY(p_keys)
  LOOP
    IF rec.override IS NOT NULL THEN
      val := rec.override;
    ELSIF rec.enabled AND rec.rollout_pct < 100 THEN
      -- Deterministic rollout: hash of (flag_key || tenant_id) mod 100
      val := rec.enabled AND
             (abs(hashtext(rec.key || coalesce(p_tenant_id::text, 'global'))) % 100) < rec.rollout_pct;
    ELSE
      val := rec.enabled;
    END IF;
    result := result || jsonb_build_object(rec.key, val);
  END LOOP;

  -- Keys not found default to false
  DECLARE k text;
  BEGIN
    FOREACH k IN ARRAY p_keys LOOP
      IF NOT (result ? k) THEN
        result := result || jsonb_build_object(k, false);
      END IF;
    END LOOP;
  END;

  RETURN result;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE platform.feature_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

-- Everyone can read flags (resolved client-side too)
CREATE POLICY "anyone_read_flags"
  ON platform.feature_flags FOR SELECT USING (true);

CREATE POLICY "anyone_read_overrides"
  ON platform.feature_flag_overrides FOR SELECT USING (true);

-- Only service role can write (admin UI calls service role via edge fn)
CREATE POLICY "service_write_flags"
  ON platform.feature_flags FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_write_overrides"
  ON platform.feature_flag_overrides FOR ALL USING (auth.role() = 'service_role');

-- ── Seed initial flags ────────────────────────────────────────────────────────
INSERT INTO platform.feature_flags (key, name, description, enabled, tags) VALUES

  -- Markets: core
  ('markets.enabled',
   'Markets Domain',
   'Top-level gate for the entire markets domain.',
   true, '{markets}'),

  ('markets.portfolio.enabled',
   'Portfolio Tracking',
   'Holdings import, portfolio view, P&L.',
   true, '{markets}'),

  ('markets.signals.enabled',
   'AI Signals',
   'LangGraph signal generation for equity holdings.',
   true, '{markets,signals}'),

  ('markets.signals.fo_enabled',
   'F&O Signals',
   'Futures & Options signal pipeline.',
   false, '{markets,signals}'),

  ('markets.signals.intraday_enabled',
   'Intraday Signals',
   'Same-session scalp/day-trade signals (requires 5m candle feed).',
   false, '{markets,signals}'),

  ('markets.signals.commodities_enabled',
   'Commodity Signals',
   'MCX commodity signal pipeline.',
   false, '{markets,signals}'),

  ('markets.backtesting.enabled',
   'Backtesting Engine',
   'Run historical strategy backtests.',
   true, '{markets}'),

  ('markets.price_ingest.enabled',
   'Price Data Ingest',
   'Daily Yahoo Finance OHLCV fetch for portfolio instruments.',
   true, '{markets}'),

  ('markets.research.enabled',
   'AI Research Threads',
   'LLM-powered research chat over portfolio + market data.',
   true, '{markets}'),

  -- Billing
  ('billing.enabled',
   'Billing Module',
   'Subscription plans and invoicing.',
   true, '{billing}'),

  ('billing.trial_enforcement.enabled',
   'Trial Enforcement',
   'Block features after trial expires without payment.',
   false, '{billing}'),

  ('billing.plans.starter',
   'Starter Plan',
   'Show and allow purchase of the Starter plan.',
   true, '{billing}'),

  ('billing.plans.pro',
   'Professional Plan',
   'Show and allow purchase of the Professional plan.',
   true, '{billing}'),

  ('billing.plans.enterprise',
   'Enterprise Plan',
   'Show and allow purchase of the Enterprise plan.',
   true, '{billing}'),

  -- Platform
  ('platform.maintenance_mode',
   'Maintenance Mode',
   'Emergency killswitch — shows maintenance banner to all non-admin users.',
   false, '{platform}'),

  ('platform.new_user_onboarding',
   'New User Onboarding',
   'Show guided onboarding flow for new users.',
   true, '{platform}'),

  ('platform.self_serve_signup',
   'Self-Serve Signup',
   'Allow public sign-up without admin approval.',
   false, '{platform}')

ON CONFLICT (key) DO NOTHING;
