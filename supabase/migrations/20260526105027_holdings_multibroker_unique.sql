-- Holdings unique key — make multi-broker safe.
--
-- BEFORE: UNIQUE (portfolio_id, instrument_id)
--   When two broker connections sync the same symbol into the same
--   portfolio (e.g. user holds RELIANCE in both Zerodha and Groww,
--   both pointed at the "Core" portfolio), the second sync's upsert
--   silently overwrote the first row's qty/avg_cost. The provenance
--   of qty was effectively last-write-wins.
--
-- AFTER: two partial unique indexes
--   • Broker-sourced rows  (broker_connection_id IS NOT NULL)
--       unique on (portfolio_id, broker_connection_id, instrument_id)
--   • Manually-added rows  (broker_connection_id IS NULL)
--       unique on (portfolio_id, instrument_id)
--
-- Manual entries stay one-per-symbol-per-portfolio (the original
-- contract for human-entered holdings). Broker-sync entries are now
-- one-per-symbol-per-(portfolio, connection), so each connection
-- keeps its own row and the aggregate qty for a symbol-in-portfolio
-- is the SUM of all per-connection rows, not the last-write-wins.
--
-- Companion code change: services/markets-worker/.../broker_sync.py
-- updates the upsert on_conflict clause to match the new index.

BEGIN;

-- 1. Drop the old composite unique constraint (added during initial schema).
ALTER TABLE markets.holdings
  DROP CONSTRAINT IF EXISTS holdings_portfolio_id_instrument_id_key;

-- Drop any prior partial indexes from re-running this migration locally.
DROP INDEX IF EXISTS markets.holdings_broker_scoped_uniq;
DROP INDEX IF EXISTS markets.holdings_manual_uniq;

-- 2. Broker-sourced: each (portfolio, connection, symbol) is one row.
CREATE UNIQUE INDEX holdings_broker_scoped_uniq
  ON markets.holdings (portfolio_id, broker_connection_id, instrument_id)
  WHERE broker_connection_id IS NOT NULL;

-- 3. Manually-entered: one row per (portfolio, symbol). Mirrors the
--    pre-multi-broker behaviour for human-entered holdings.
CREATE UNIQUE INDEX holdings_manual_uniq
  ON markets.holdings (portfolio_id, instrument_id)
  WHERE broker_connection_id IS NULL;

COMMENT ON INDEX markets.holdings_broker_scoped_uniq IS
  'Broker-sync rows: one per (portfolio, connection, symbol). Allows the same symbol to be held in the same portfolio via two different broker connections without clobber.';

COMMENT ON INDEX markets.holdings_manual_uniq IS
  'Manually-entered rows: one per (portfolio, symbol). Preserves the original 1:1 contract for human-entered holdings.';

COMMIT;
