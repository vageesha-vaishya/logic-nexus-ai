-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515141848; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Cron jobs for T1 ingest functions
-- Requires pg_cron + pg_net + vault secret markets_ingest_service_role_key

-- ── MF NAV ingest: daily 16:00 UTC (21:30 IST, after AMFI publishes by 9 PM) ──
CREATE OR REPLACE FUNCTION trigger_markets_ingest_mf_nav()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  service_key TEXT;
  supabase_url TEXT := current_setting('app.supabase_url', true);
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF service_key IS NULL THEN
    RAISE WARNING 'markets_ingest_service_role_key not found in vault';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/markets-ingest-mf-nav',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'markets-ingest-mf-nav-daily',
  '0 16 * * 1-5',
  'SELECT trigger_markets_ingest_mf_nav()'
);

-- ── FX rates ingest: daily 07:35 UTC (13:05 IST) ─────────────────────────
CREATE OR REPLACE FUNCTION trigger_markets_ingest_fx_rates()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  service_key TEXT;
  supabase_url TEXT := current_setting('app.supabase_url', true);
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF service_key IS NULL THEN
    RAISE WARNING 'markets_ingest_service_role_key not found in vault';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/markets-ingest-fx-rates',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'markets-ingest-fx-rates-daily',
  '35 7 * * 1-5',
  'SELECT trigger_markets_ingest_fx_rates()'
);
