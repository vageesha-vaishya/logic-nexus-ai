-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515061018; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ====================================================================
-- Schedule markets-ingest-news via pg_cron + pg_net.
-- Per markets design doc §11 T2 ("Data ingestion: NSE/BSE EOD prices,
-- BSE StAR MF NAVs, news (free APIs to start)").
--
-- Window: every 15 minutes, 03:00-10:59 UTC, Mon-Fri.
--         That covers NSE market hours 09:15-15:30 IST with a small buffer.
--
-- Secret-handling note: this migration does NOT contain the service-role
-- key. The helper function reads it from supabase_vault. Owner inserts
-- the secret separately via:
--
--   SELECT vault.create_secret(
--     '<service_role_jwt>',
--     'markets_ingest_service_role_key',
--     'Used by cron.trigger_markets_ingest_news for scheduled ingestion'
--   );
--
-- Until the secret is stored, the helper logs a warning and skips the call.
-- This is the safe, repeatable pattern; no key in migration history.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper function — SECURITY DEFINER so the cron job (run as `postgres`)
-- can read the vault secret regardless of the calling role.
CREATE OR REPLACE FUNCTION public.trigger_markets_ingest_news()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault, net, extensions
AS $$
DECLARE
  v_key text;
  v_url text := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-ingest-news';
  v_request_id bigint;
BEGIN
  -- Pull service-role JWT from vault. If absent, log + return null;
  -- skipping is safer than crashing the cron run.
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'markets_ingest_service_role_key'
  LIMIT 1;

  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not found in vault; markets-ingest-news skipped';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.trigger_markets_ingest_news() IS
  'Cron-callable helper that POSTs to the markets-ingest-news Edge Function. Reads service-role JWT from vault.decrypted_secrets (name=markets_ingest_service_role_key). Returns net.http_request_queue id.';

-- Lock down: revoke the world; only postgres (cron) calls this.
REVOKE EXECUTE ON FUNCTION public.trigger_markets_ingest_news() FROM PUBLIC;

-- Schedule the cron job.
-- '*/15 3-10 * * 1-5'  = every 15 min, hours 3-10 UTC, Mon-Fri
-- ≈ 08:30-16:15 IST (covers NSE 09:15-15:30 IST with buffer for pre-open + post-close)
SELECT cron.schedule(
  'markets-ingest-news-market-hours',
  '*/15 3-10 * * 1-5',
  $cron$SELECT public.trigger_markets_ingest_news();$cron$
);