-- m:n broker-connection ↔ portfolio data model. Closed-beta task #37.
--
-- Lands the schema additive-only: existing 1:1 path via
-- broker_connections.portfolio_id keeps working (backward-compatible
-- default destination). New join table allows one connection to feed
-- many portfolios (e.g. equity → Core, F&O → Experimental) AND many
-- connections to feed one consolidated portfolio (e.g. Zerodha + Fyers
-- → "All my equity"). holdings.broker_connection_id tags each row with
-- the broker it was sync'd from so the user can later split or
-- consolidate without losing provenance.
--
-- No UI lands today — that's the next pass. See
-- docs/plans/2026-05-18-retail-investment-platform-design.md:463 for
-- the documented "single true portfolio view across all brokers" intent.

-- 1. Join table
CREATE TABLE IF NOT EXISTS markets.broker_portfolio_links (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_connection_id  uuid NOT NULL REFERENCES markets.broker_connections(id) ON DELETE CASCADE,
  portfolio_id          uuid NOT NULL REFERENCES markets.portfolios(id) ON DELETE CASCADE,
  owner_user_id         uuid NOT NULL, -- denormalised for RLS speed
  tenant_id             uuid NOT NULL,
  franchise_id          uuid NOT NULL,
  -- weight ∈ [0,1]: fraction of this broker's holdings routed to this
  -- portfolio. NULL = "everything not claimed by another link"; sum across
  -- links for one broker_connection_id should ≤ 1 when explicit. Default 1.0.
  weight                numeric NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  -- sync_filter: optional jsonb that constrains which holdings flow here.
  -- Examples: {"asset_class": "equity"}, {"segments": ["EQ","BSE"]},
  -- {"symbols": ["RELIANCE","TCS"]}. NULL = match all.
  sync_filter           jsonb,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broker_connection_id, portfolio_id)
);

COMMENT ON TABLE markets.broker_portfolio_links IS
  'Many-to-many mapping of broker connections to portfolios. Closed-beta task #37. UI not yet wired — broker_connections.portfolio_id remains the default destination for backward compatibility.';

CREATE INDEX IF NOT EXISTS broker_portfolio_links_owner_idx
  ON markets.broker_portfolio_links (owner_user_id);
CREATE INDEX IF NOT EXISTS broker_portfolio_links_connection_idx
  ON markets.broker_portfolio_links (broker_connection_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS broker_portfolio_links_portfolio_idx
  ON markets.broker_portfolio_links (portfolio_id) WHERE is_active = true;

ALTER TABLE markets.broker_portfolio_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY broker_portfolio_links_owner_select
  ON markets.broker_portfolio_links FOR SELECT TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));

CREATE POLICY broker_portfolio_links_owner_insert
  ON markets.broker_portfolio_links FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY broker_portfolio_links_owner_update
  ON markets.broker_portfolio_links FOR UPDATE TO authenticated
  USING (owner_user_id = (SELECT auth.uid()))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

CREATE POLICY broker_portfolio_links_owner_delete
  ON markets.broker_portfolio_links FOR DELETE TO authenticated
  USING (owner_user_id = (SELECT auth.uid()));

-- 2. Holdings source-tagging
ALTER TABLE markets.holdings
  ADD COLUMN IF NOT EXISTS broker_connection_id uuid
    REFERENCES markets.broker_connections(id) ON DELETE SET NULL;

COMMENT ON COLUMN markets.holdings.broker_connection_id IS
  'Which broker this row was sync''d from. NULL means manually-added or pre-m:n holdings. Set by sync jobs; used by split-across-portfolios UX (closed-beta task #37 follow-up).';

CREATE INDEX IF NOT EXISTS holdings_broker_connection_idx
  ON markets.holdings (broker_connection_id) WHERE broker_connection_id IS NOT NULL;

-- 3. Backfill: copy existing 1:1 mappings into the join table so the new
-- code path can rely on a uniform source of truth. broker_connections
-- without a portfolio_id are skipped (they're unmapped today).
INSERT INTO markets.broker_portfolio_links
  (broker_connection_id, portfolio_id, owner_user_id, tenant_id, franchise_id, weight)
SELECT
  bc.id,
  bc.portfolio_id,
  bc.owner_user_id,
  bc.tenant_id,
  bc.franchise_id,
  1.0
FROM markets.broker_connections bc
WHERE bc.portfolio_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM markets.broker_portfolio_links l
    WHERE l.broker_connection_id = bc.id
      AND l.portfolio_id = bc.portfolio_id
  );

-- 4. Backfill: tag existing holdings with the broker connection that owns
-- their portfolio (single-broker case is unambiguous; multi-broker
-- portfolios get the first connection — acceptable for v1, can be
-- refined when sync metadata is richer).
UPDATE markets.holdings h
SET broker_connection_id = bc.id
FROM markets.broker_connections bc
WHERE h.broker_connection_id IS NULL
  AND bc.portfolio_id = h.portfolio_id;
