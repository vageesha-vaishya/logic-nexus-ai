-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516011856; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ══════════════════════════════════════════════════════════════════════════
-- markets.refresh_portfolio_nav(p_portfolio_id)
--
-- Computes NAV, day change, invested value, and unrealized P&L for one or
-- all portfolios.  Updates portfolios.metadata and upserts portfolio_snapshots.
--
-- Returns one row per portfolio with the computed metrics.
-- ══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION markets.refresh_portfolio_nav(
  p_portfolio_id uuid DEFAULT NULL
)
RETURNS TABLE (
  portfolio_id   uuid,
  nav_value      numeric,
  invested_value numeric,
  unrealized_pnl numeric,
  unrealized_pct numeric,
  day_change     numeric,
  day_change_pct numeric,
  holdings_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = markets, public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Latest 2 EOD closes per instrument (window function — single pass)
  ranked AS (
    SELECT
      ph.instrument_id,
      ph.close,
      ROW_NUMBER() OVER (PARTITION BY ph.instrument_id ORDER BY ph.ts DESC) AS rn
    FROM markets.price_history ph
    WHERE ph.close IS NOT NULL
      AND ph.instrument_id IN (
        SELECT DISTINCT h.instrument_id
        FROM markets.holdings h
        WHERE h.qty > 0
          AND (p_portfolio_id IS NULL OR h.portfolio_id = p_portfolio_id)
      )
  ),
  ltp  AS (SELECT instrument_id, close FROM ranked WHERE rn = 1),
  prev AS (SELECT instrument_id, close FROM ranked WHERE rn = 2),

  -- Per-portfolio aggregates
  agg AS (
    SELECT
      h.portfolio_id,
      COUNT(*)                                                                 AS holdings_count,
      SUM(h.qty * COALESCE(l.close, h.avg_cost))                              AS nav_value,
      SUM(h.qty * h.avg_cost)                                                  AS invested_value,
      SUM(h.qty * (COALESCE(l.close, h.avg_cost) - h.avg_cost))               AS unrealized_pnl,
      SUM(h.qty * (COALESCE(l.close, 0) - COALESCE(p.close, COALESCE(l.close, 0)))) AS day_change
    FROM markets.holdings h
    LEFT JOIN ltp  l ON l.instrument_id = h.instrument_id
    LEFT JOIN prev p ON p.instrument_id = h.instrument_id
    WHERE h.qty > 0
      AND (p_portfolio_id IS NULL OR h.portfolio_id = p_portfolio_id)
    GROUP BY h.portfolio_id
  )

  SELECT
    a.portfolio_id,
    ROUND(a.nav_value,      2) AS nav_value,
    ROUND(a.invested_value, 2) AS invested_value,
    ROUND(a.unrealized_pnl, 2) AS unrealized_pnl,
    ROUND(
      CASE WHEN a.invested_value > 0
           THEN (a.unrealized_pnl / a.invested_value) * 100
           ELSE 0 END, 2)      AS unrealized_pct,
    ROUND(a.day_change,     2) AS day_change,
    ROUND(
      CASE WHEN (a.nav_value - a.day_change) > 0
           THEN (a.day_change / (a.nav_value - a.day_change)) * 100
           ELSE 0 END, 2)      AS day_change_pct,
    a.holdings_count
  FROM agg a;
END;
$$;

-- ── Cron trigger function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_markets_compute_nav()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'vault', 'net', 'extensions'
AS $$
DECLARE
  v_key        text;
  v_url        text    := 'https://gzhxgoigflftharcmdqj.supabase.co/functions/v1/markets-compute-nav';
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'markets_ingest_service_role_key'
  LIMIT 1;
  IF v_key IS NULL OR length(v_key) = 0 THEN
    RAISE WARNING 'markets_ingest_service_role_key not in vault; compute-nav skipped';
    RETURN NULL;
  END IF;
  SELECT net.http_post(
    url                  := v_url,
    headers              := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body                 := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

-- ── Schedule: 45 min after EOD price ingest (Mon–Fri 16:50 IST = 11:20 UTC) ──
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'markets-compute-nav-eod') THEN
    PERFORM cron.schedule(
      'markets-compute-nav-eod',
      '50 11 * * 1-5',
      'SELECT public.trigger_markets_compute_nav();'
    );
  END IF;
END $$;
