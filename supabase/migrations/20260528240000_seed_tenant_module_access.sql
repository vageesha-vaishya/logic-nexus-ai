-- Phase 1 Slice E Part 2 prep — seed core.tenant_module_access for existing tenants
-- Per master design doc §8.2.1 + Phase 1 implementation state
--
-- core.has_module_access() returns FALSE for modules where:
--   - core.modules.default_enabled = false (amro, logistics, markets, uim), AND
--   - core.tenant_module_access has no active row for (tenant, module)
--
-- Until this migration ran, NO tenant on prod had any tenant_module_access
-- rows — so any route that adopted `requiredModule="amro"` (or logistics /
-- markets / uim) would have denied every live user. This migration seeds
-- the table from existing public.tenant_domain_assignments so the new
-- gate is safe to start adopting on routes.
--
-- Seeding rules:
--   1. Every tenant gets the 7 always-on commercial modules
--      (core, crm, sales, quotation, finance, compliance, comms). These
--      are default_enabled=true so has_module_access() would return TRUE
--      via the fallback anyway, but seeding explicit rows is more honest
--      and gives the admin UI something to show.
--   2. Tenants with AMRO domain assigned (case-insensitive) → seed amro
--      and uim (uim is the inventory + integration spine that AMRO + the
--      logistics module both rely on).
--   3. Tenants with logistics domain assigned → seed logistics + uim.
--   4. Tenants with markets domain assigned → seed markets.
--
-- TEST/RLS_TEST/test-* domains are seeded just like real ones — better to
-- mirror their actual state than carve out exceptions that would have to
-- be re-discovered later.
--
-- Re-runnable: PK (tenant_id, module_code) + ON CONFLICT DO NOTHING.
-- Enabled_by_user_id is NULL — this is a system backfill, not a manual
-- admin grant.

-- Always-on commercial bundle for every tenant.
INSERT INTO core.tenant_module_access (tenant_id, module_code, status, enabled_at)
SELECT t.id, m.code, 'active'::text, now()
FROM public.tenants t
CROSS JOIN (VALUES
  ('core'),
  ('crm'),
  ('sales'),
  ('quotation'),
  ('finance'),
  ('compliance'),
  ('comms')
) AS m(code)
ON CONFLICT (tenant_id, module_code) DO NOTHING;

-- Domain-gated bundles.
WITH tenant_with_domain AS (
  SELECT DISTINCT
    tda.tenant_id,
    lower(pd.code) AS domain_code_lower
  FROM   public.tenant_domain_assignments tda
  JOIN   public.platform_domains          pd ON pd.id = tda.domain_id
  WHERE  tda.is_active = true
    AND  pd.is_active  = true
    AND  pd.code IS NOT NULL
)
INSERT INTO core.tenant_module_access (tenant_id, module_code, status, enabled_at)
SELECT twd.tenant_id, m.code, 'active'::text, now()
FROM   tenant_with_domain twd
JOIN   LATERAL (
  -- AMRO domain → amro + uim
  SELECT 'amro'      AS code WHERE twd.domain_code_lower = 'amro'
  UNION ALL
  SELECT 'uim'              WHERE twd.domain_code_lower = 'amro'
  UNION ALL
  -- logistics domain → logistics + uim
  SELECT 'logistics'        WHERE twd.domain_code_lower = 'logistics'
  UNION ALL
  SELECT 'uim'              WHERE twd.domain_code_lower = 'logistics'
  UNION ALL
  -- markets domain → markets
  SELECT 'markets'          WHERE twd.domain_code_lower = 'markets'
) m ON true
ON CONFLICT (tenant_id, module_code) DO NOTHING;

-- Reconciliation: count what landed. Run after via
--   SELECT * FROM core.tenant_module_access_seeded_summary();
-- to verify the seed.

CREATE OR REPLACE FUNCTION core.tenant_module_access_seeded_summary()
RETURNS TABLE (
  module_code   text,
  tenant_count  bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  SELECT
    m.module_code,
    count(DISTINCT tma.tenant_id) AS tenant_count
  FROM   core.modules m
  LEFT   JOIN core.tenant_module_access tma
            ON tma.module_code = m.module_code
           AND tma.status IN ('trial','active')
  GROUP BY m.module_code
  ORDER BY m.module_code;
$$;

COMMENT ON FUNCTION core.tenant_module_access_seeded_summary IS
  'Quick post-seed sanity: rows per module_code. After 20260528240000, the always-on bundle should match the total tenant count; amro and markets should match the count of tenants with that domain assigned.';

GRANT EXECUTE ON FUNCTION core.tenant_module_access_seeded_summary
  TO service_role;
