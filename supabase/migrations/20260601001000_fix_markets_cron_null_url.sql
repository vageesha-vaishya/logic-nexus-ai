-- Phase 6 Step 67 — fix the 3 failing markets cron jobs surfaced by
-- Step 49's v_cron_status view.
--
-- Symptom (live in prod since the cron migration landed 2026-05-15):
--   markets-ingest-fo-prices-daily         FAIL
--   markets-ingest-corp-actions-daily      FAIL
--   markets-ingest-commodity-prices-daily  FAIL
--   "null value in column \"url\" of relation \"http_request\""
--
-- Root cause: these 3 fns derive their endpoint URL from a database
-- GUC:
--   supabase_url TEXT := current_setting('app.supabase_url', true);
--   ...
--   url := supabase_url || '/functions/v1/...'
-- The GUC was never SET on the postgres role the cron daemon runs
-- as. current_setting(...,true) returns NULL on miss; NULL || text
-- = NULL; net.http_post(url := NULL) violates the not-null
-- constraint on http_request.
--
-- The OTHER 7 markets cron fns (markets-ingest-news,
-- markets-ingest-prices-eod, markets-compute-nav, etc.) hardcode
-- the project URL as a literal:
--   v_url text := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/...';
-- That's the established pattern. The 3 failing fns are inconsistent
-- outliers.
--
-- This migration brings the 3 in line — hardcode the URL, drop the
-- GUC dependency. Belt-and-suspenders: the service_key NULL-check
-- pattern stays.

-- ── Corporate actions ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_corp_actions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault, net, extensions
AS $$
DECLARE
  v_key text;
  v_url text := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-corporate-actions';
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not in vault; ingest-corporate-actions skipped';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body    := '{"range":"2y"}'::jsonb
  );
END;
$$;

-- ── NSE F&O Bhav ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_fo_prices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault, net, extensions
AS $$
DECLARE
  v_key text;
  v_url text := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-fo-prices';
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not in vault; ingest-fo-prices skipped';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body    := '{"range":5}'::jsonb
  );
END;
$$;

-- ── MCX commodities ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_commodity_prices()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault, net, extensions
AS $$
DECLARE
  v_key text;
  v_url text := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-commodity-prices';
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'markets_ingest_service_role_key' LIMIT 1;
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not in vault; ingest-commodity-prices skipped';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_key),
    body    := '{"range":5}'::jsonb
  );
END;
$$;
