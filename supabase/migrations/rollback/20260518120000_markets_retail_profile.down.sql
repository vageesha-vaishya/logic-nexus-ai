-- Rollback for 20260518120000_markets_retail_profile.sql
--
-- Drops portfolio_tiers + risk_profiles and their triggers/policies. The shared
-- markets.set_updated_at function is left in place because other tables in the
-- markets schema reference it.

DROP TRIGGER IF EXISTS trg_portfolio_tiers_updated_at ON markets.portfolio_tiers;
DROP TRIGGER IF EXISTS trg_risk_profiles_updated_at  ON markets.risk_profiles;

DROP POLICY IF EXISTS "Users manage own tiers"        ON markets.portfolio_tiers;
DROP POLICY IF EXISTS "Users manage own risk profile" ON markets.risk_profiles;

DROP TABLE IF EXISTS markets.portfolio_tiers;
DROP TABLE IF EXISTS markets.risk_profiles;
