-- Rollback for 20260519165336_markets_portfolio_templates.
-- Drops the table, the trigger, and the RLS policy in one shot.

DROP TRIGGER IF EXISTS portfolio_templates_set_updated_at ON markets.portfolio_templates;
DROP TABLE IF EXISTS markets.portfolio_templates CASCADE;
