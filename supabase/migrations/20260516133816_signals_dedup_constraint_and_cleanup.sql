-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260516133816; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--


-- ── Step 1: Delete portfolio-tagged signals for instruments no longer in holdings ──
-- These are orphans: had portfolio_id set but the instrument left the portfolio.
DELETE FROM markets.signals
WHERE portfolio_id IS NOT NULL
  AND instrument_id NOT IN (
    SELECT DISTINCT instrument_id FROM markets.holdings WHERE qty > 0
  );

-- ── Step 2: Delete duplicate signals — keep only the latest per
--    (instrument_id, portfolio_id, horizon, UTC-day) ─────────────────────────
DELETE FROM markets.signals
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY instrument_id, portfolio_id, COALESCE(horizon, ''),
                     date_trunc('day', ts AT TIME ZONE 'UTC')
        ORDER BY ts DESC
      ) AS rn
    FROM markets.signals
  ) ranked
  WHERE rn > 1
);

-- ── Step 3: Unique partial index — one signal per (instrument, portfolio, horizon, UTC-day)
CREATE UNIQUE INDEX IF NOT EXISTS signals_portfolio_daily_dedup
ON markets.signals (
  instrument_id,
  portfolio_id,
  COALESCE(horizon, ''),
  date_trunc('day', ts AT TIME ZONE 'UTC')
)
WHERE portfolio_id IS NOT NULL;
