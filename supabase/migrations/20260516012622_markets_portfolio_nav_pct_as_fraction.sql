-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516012622; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- Fix: return day_change_pct and unrealized_pct as fractions (0.055 not 5.5)
-- so they can be passed directly to Numeric/MoneyDelta with isFraction=true (default).
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
  agg AS (
    SELECT
      h.portfolio_id,
      COUNT(*)                                                                  AS holdings_count,
      SUM(h.qty * COALESCE(l.close, h.avg_cost))                               AS nav_value,
      SUM(h.qty * h.avg_cost)                                                   AS invested_value,
      SUM(h.qty * (COALESCE(l.close, h.avg_cost) - h.avg_cost))                AS unrealized_pnl,
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
    ROUND(a.nav_value,      2)  AS nav_value,
    ROUND(a.invested_value, 2)  AS invested_value,
    ROUND(a.unrealized_pnl, 2)  AS unrealized_pnl,
    -- Fractions (not percentages) so UI components receive 0.055 not 5.5
    ROUND(
      CASE WHEN a.invested_value > 0
           THEN a.unrealized_pnl / a.invested_value
           ELSE 0 END, 6)       AS unrealized_pct,
    ROUND(a.day_change,     2)  AS day_change,
    ROUND(
      CASE WHEN (a.nav_value - a.day_change) > 0
           THEN a.day_change / (a.nav_value - a.day_change)
           ELSE 0 END, 6)       AS day_change_pct,
    a.holdings_count
  FROM agg a;
END;
$$;
