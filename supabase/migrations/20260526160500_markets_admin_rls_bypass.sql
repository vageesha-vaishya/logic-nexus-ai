-- Admin / tenant / franchise SELECT-only RLS bypass on markets tables.
--
-- Existing model: only owner_user_id = auth.uid() can SELECT. That means
-- platform admins, tenant admins, and franchise admins — who legitimately
-- need to inspect a user's broker connections / portfolios / holdings to
-- diagnose support tickets and run compliance reviews — could not read
-- the rows. They had to fall back to service_role SQL, which bypasses
-- all RLS and leaves no audit trail of which admin viewed what.
--
-- This migration adds ONE new SELECT policy per table, additive to the
-- existing owner_select. Postgres RLS is permissive-OR across multiple
-- policies, so:
--   • owners keep reading their own rows via the existing policy
--   • platform_admin reads everything
--   • tenant_admin reads rows where tenant_id matches the admin's tenant
--   • franchise_admin reads rows where franchise_id matches the admin's franchise
--
-- Writes (INSERT/UPDATE/DELETE) are NOT extended. Admins observe but do
-- not mutate. If an admin needs to fix corrupted user data they go
-- through service_role, which leaves a worker log.
--
-- Tables covered (7):
--   markets.broker_connections
--   markets.broker_portfolio_links
--   markets.portfolios
--   markets.holdings
--   markets.positions
--   markets.orders
--   markets.gtt_orders

BEGIN;

-- Idempotent guard — re-running the migration locally is safe.
DROP POLICY IF EXISTS broker_connections_admin_select       ON markets.broker_connections;
DROP POLICY IF EXISTS broker_portfolio_links_admin_select   ON markets.broker_portfolio_links;
DROP POLICY IF EXISTS portfolios_admin_select               ON markets.portfolios;
DROP POLICY IF EXISTS holdings_admin_select                 ON markets.holdings;
DROP POLICY IF EXISTS positions_admin_select                ON markets.positions;
DROP POLICY IF EXISTS orders_admin_select                   ON markets.orders;
DROP POLICY IF EXISTS gtt_orders_admin_select               ON markets.gtt_orders;

-- Shared predicate: pulled out as a SQL function so the policies stay
-- one-liners AND the predicate has a single source of truth. STABLE so
-- the planner can cache it within a query. SECURITY INVOKER (default)
-- because all the underlying helpers it calls are SECURITY DEFINER.
CREATE OR REPLACE FUNCTION markets.is_markets_admin_for(
  p_tenant_id    uuid,
  p_franchise_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, markets
AS $$
  SELECT
       public.is_platform_admin((SELECT auth.uid()))
    OR (
         public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
     AND p_tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    )
    OR (
         public.has_role((SELECT auth.uid()), 'franchise_admin'::public.app_role)
     AND p_franchise_id = public.get_user_franchise_id((SELECT auth.uid()))
    );
$$;

COMMENT ON FUNCTION markets.is_markets_admin_for(uuid, uuid) IS
  'True if the current authenticated user is a platform admin, OR a tenant admin whose tenant matches p_tenant_id, OR a franchise admin whose franchise matches p_franchise_id. Used in RLS SELECT policies for read-only admin access to markets data.';

CREATE POLICY broker_connections_admin_select
  ON markets.broker_connections FOR SELECT TO authenticated
  USING (markets.is_markets_admin_for(tenant_id, franchise_id));

CREATE POLICY broker_portfolio_links_admin_select
  ON markets.broker_portfolio_links FOR SELECT TO authenticated
  USING (markets.is_markets_admin_for(tenant_id, franchise_id));

CREATE POLICY portfolios_admin_select
  ON markets.portfolios FOR SELECT TO authenticated
  USING (markets.is_markets_admin_for(tenant_id, franchise_id));

CREATE POLICY holdings_admin_select
  ON markets.holdings FOR SELECT TO authenticated
  USING (markets.is_markets_admin_for(tenant_id, franchise_id));

CREATE POLICY positions_admin_select
  ON markets.positions FOR SELECT TO authenticated
  USING (markets.is_markets_admin_for(tenant_id, franchise_id));

CREATE POLICY orders_admin_select
  ON markets.orders FOR SELECT TO authenticated
  USING (markets.is_markets_admin_for(tenant_id, franchise_id));

CREATE POLICY gtt_orders_admin_select
  ON markets.gtt_orders FOR SELECT TO authenticated
  USING (markets.is_markets_admin_for(tenant_id, franchise_id));

COMMIT;
