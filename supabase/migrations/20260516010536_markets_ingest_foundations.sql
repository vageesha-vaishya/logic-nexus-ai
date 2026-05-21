-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516010536; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ══════════════════════════════════════════════════════════════════════════
-- markets_ingest_foundations
-- 1. Unique constraint on fx_rates (required for upsert onConflict)
-- 2. RLS + read policies on mf_schemes, fx_rates, corporate_actions
-- 3. Drop+recreate cron trigger functions (return type change void→bigint)
-- 4. Schedule cron jobs for mf-nav and fx-rates
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. fx_rates unique constraint ────────────────────────────────────────
ALTER TABLE markets.fx_rates
  ADD CONSTRAINT fx_rates_base_quote_ts_key
  UNIQUE (base_ccy, quote_ccy, ts);

-- ── 2. Enable RLS ────────────────────────────────────────────────────────
ALTER TABLE markets.mf_schemes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.fx_rates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets.corporate_actions ENABLE ROW LEVEL SECURITY;

-- ── 3. RLS policies (reference data: anyone can read, service role writes) 
CREATE POLICY "mf_schemes_read" ON markets.mf_schemes
  FOR SELECT USING (true);
CREATE POLICY "mf_schemes_service_write" ON markets.mf_schemes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "fx_rates_read" ON markets.fx_rates
  FOR SELECT USING (true);
CREATE POLICY "fx_rates_service_write" ON markets.fx_rates
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "corporate_actions_read" ON markets.corporate_actions
  FOR SELECT USING (true);
CREATE POLICY "corporate_actions_service_write" ON markets.corporate_actions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 4. Drop existing void-return functions so we can recreate as bigint ──
DROP FUNCTION IF EXISTS public.trigger_markets_ingest_mf_nav();
DROP FUNCTION IF EXISTS public.trigger_markets_ingest_fx_rates();

-- ── 5. Cron trigger functions (bigint return = net request id) ────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_mf_nav()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault', 'net', 'extensions'
AS $$
DECLARE
  v_key        text;
  v_url        text    := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-mf-nav';
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'markets_ingest_service_role_key'
  LIMIT 1;
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not in vault; mf-nav skipped';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object(
      'Authorization',   'Bearer ' || v_key,
      'Content-Type',    'application/json'
    ),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_fx_rates()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault', 'net', 'extensions'
AS $$
DECLARE
  v_key        text;
  v_url        text    := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-fx-rates';
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'markets_ingest_service_role_key'
  LIMIT 1;
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not in vault; fx-rates skipped';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object(
      'Authorization',   'Bearer ' || v_key,
      'Content-Type',    'application/json'
    ),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

-- ── 6. Schedule cron jobs ─────────────────────────────────────────────────
DO $$
BEGIN
  -- MF NAV: daily 16:00 UTC = 21:30 IST
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'markets-ingest-mf-nav-daily') THEN
    PERFORM cron.schedule(
      'markets-ingest-mf-nav-daily',
      '0 16 * * *',
      'SELECT public.trigger_markets_ingest_mf_nav();'
    );
  END IF;
  -- FX rates: daily 07:35 UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'markets-ingest-fx-rates-daily') THEN
    PERFORM cron.schedule(
      'markets-ingest-fx-rates-daily',
      '35 7 * * *',
      'SELECT public.trigger_markets_ingest_fx_rates();'
    );
  END IF;
END $$;
