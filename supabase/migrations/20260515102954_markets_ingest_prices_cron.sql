-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515102954; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ─── 1. EOD price trigger (5-day window, daily) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_prices()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault', 'net', 'extensions'
AS $$
DECLARE
  v_key        text;
  v_url        text    := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-prices';
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'markets_ingest_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not found in vault; markets-ingest-prices skipped';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object(
      'Authorization',   'Bearer ' || v_key,
      'Content-Type',    'application/json'
    ),
    body                 := '{"range":"5d"}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ─── 2. Weekly 30-day backfill trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_prices_backfill()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault', 'net', 'extensions'
AS $$
DECLARE
  v_key        text;
  v_url        text    := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-prices';
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'markets_ingest_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not found in vault; markets-ingest-prices backfill skipped';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object(
      'Authorization',   'Bearer ' || v_key,
      'Content-Type',    'application/json'
    ),
    body                 := '{"range":"30d"}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ─── 3. Enrich-news trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_enrich_news()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault', 'net', 'extensions'
AS $$
DECLARE
  v_key        text;
  v_url        text    := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-enrich-news';
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'markets_ingest_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not found in vault; markets-enrich-news skipped';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object(
      'Authorization',   'Bearer ' || v_key,
      'Content-Type',    'application/json'
    ),
    body                 := '{"limit":50}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ─── 4. Schedule cron jobs (idempotent) ──────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'markets-ingest-prices-eod') THEN
    PERFORM cron.schedule(
      'markets-ingest-prices-eod',
      '35 10 * * 1-5',
      'SELECT public.trigger_markets_ingest_prices();'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'markets-ingest-prices-backfill') THEN
    PERFORM cron.schedule(
      'markets-ingest-prices-backfill',
      '3 11 * * 1',
      'SELECT public.trigger_markets_ingest_prices_backfill();'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'markets-enrich-news-hourly') THEN
    PERFORM cron.schedule(
      'markets-enrich-news-hourly',
      '47 * * * 1-5',
      'SELECT public.trigger_markets_enrich_news();'
    );
  END IF;
END $$;