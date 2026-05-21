-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515144112; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Cron jobs for T1 corporate-actions + T2 F&O + commodity ingest

-- ── Corporate actions: 02:35 UTC daily (08:05 IST) ─────────────────────
CREATE OR REPLACE FUNCTION trigger_markets_ingest_corp_actions()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  service_key  TEXT;
  supabase_url TEXT := current_setting('app.supabase_url', true);
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF service_key IS NULL THEN RAISE WARNING 'markets_ingest_service_role_key not found'; RETURN; END IF;
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/markets-ingest-corporate-actions',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
    body    := '{"range":"2y"}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'markets-ingest-corp-actions-daily',
  '35 2 * * 1-5',
  'SELECT trigger_markets_ingest_corp_actions()'
);

-- ── NSE F&O Bhav: 13:05 UTC (18:35 IST) — same window as equity bhav ───
CREATE OR REPLACE FUNCTION trigger_markets_ingest_fo_prices()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  service_key  TEXT;
  supabase_url TEXT := current_setting('app.supabase_url', true);
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF service_key IS NULL THEN RAISE WARNING 'markets_ingest_service_role_key not found'; RETURN; END IF;
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/markets-ingest-fo-prices',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
    body    := '{"range":5}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'markets-ingest-fo-prices-daily',
  '5 13 * * 1-5',
  'SELECT trigger_markets_ingest_fo_prices()'
);

-- ── MCX commodities: 18:05 UTC (23:35 IST) — after MCX closes ──────────
CREATE OR REPLACE FUNCTION trigger_markets_ingest_commodity_prices()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  service_key  TEXT;
  supabase_url TEXT := current_setting('app.supabase_url', true);
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF service_key IS NULL THEN RAISE WARNING 'markets_ingest_service_role_key not found'; RETURN; END IF;
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/markets-ingest-commodity-prices',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
    body    := '{"range":5}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'markets-ingest-commodity-prices-daily',
  '5 18 * * 1-5',
  'SELECT trigger_markets_ingest_commodity_prices()'
);
