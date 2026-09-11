-- ====================================================================
-- Third-party freight rate provider integration framework.
-- Per docs/smart-quote-module-design.md §11 (LLM tool-calling retrieval
-- architecture). Mirrors platform.llm_provider_configs' vault-backed
-- credential pattern exactly (20260515063246_platform_llm_provider_configs.sql)
-- -- same shape, same SECURITY DEFINER decrypt-on-read helper, same RLS
-- roles -- for consistency and because that pattern is already audited
-- and in production use.
--
-- Provider-specific adapters (the actual 11 named platforms) are not
-- shipped in this migration -- this is the generic registry + credential
-- storage + health/circuit-breaker + normalized-rate-cache schema that
-- any adapter registers against. See
-- supabase/functions/_shared/rate-providers/ for the TypeScript side.
-- ====================================================================

-- ─── Provider configs (credentials + connection metadata) ──────────────

CREATE TABLE public.rate_provider_configs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_name     text NOT NULL,                  -- e.g. 'freightos', 'xeneta' -- free text, not an enum, so
                                                      -- new providers don't need a migration to add
  display_name      text NOT NULL,
  base_url          text NOT NULL,
  auth_scheme       text NOT NULL DEFAULT 'bearer' CHECK (auth_scheme IN ('bearer', 'api_key_header', 'basic', 'oauth2_client_credentials')),
  auth_header_name  text,                            -- e.g. 'X-API-Key' when auth_scheme = 'api_key_header'
  vault_secret_name text NOT NULL,                   -- name in vault.decrypted_secrets -- never store the raw key here
  timeout_ms        integer NOT NULL DEFAULT 8000 CHECK (timeout_ms BETWEEN 1000 AND 30000),
  priority          integer NOT NULL DEFAULT 100,    -- lower = tried first when multiple providers cover the same lane
  is_active         boolean NOT NULL DEFAULT true,
  daily_call_cap    integer,                         -- NULL = no cap; enforced in rate_provider_health, not here
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  metadata          jsonb NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, provider_name)
);

CREATE INDEX rate_provider_configs_tenant_idx
  ON public.rate_provider_configs (tenant_id, is_active);

CREATE OR REPLACE FUNCTION public.rate_provider_configs_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rate_provider_configs_touch
  BEFORE UPDATE ON public.rate_provider_configs
  FOR EACH ROW EXECUTE FUNCTION public.rate_provider_configs_touch_updated_at();

ALTER TABLE public.rate_provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY rate_provider_configs_tenant_admin_select ON public.rate_provider_configs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = rate_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
  );

CREATE POLICY rate_provider_configs_tenant_admin_insert ON public.rate_provider_configs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = rate_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  );

CREATE POLICY rate_provider_configs_tenant_admin_update ON public.rate_provider_configs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = rate_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = rate_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  );

CREATE POLICY rate_provider_configs_tenant_admin_delete ON public.rate_provider_configs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = rate_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_provider_configs TO authenticated;
GRANT ALL                            ON public.rate_provider_configs TO service_role;

-- ─── Health / circuit-breaker state ─────────────────────────────────────
-- One row per (tenant, provider). Updated after every real call attempt
-- by the orchestrator (_shared/rate-providers/orchestrator.ts). A
-- provider tripped into 'open' is skipped by the registry (never offered
-- to the LLM as a callable tool, never actually called) until
-- open_until has passed -- see the design doc's error-handling section
-- for the exact state machine.

CREATE TABLE public.rate_provider_health (
  tenant_id            uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_name        text NOT NULL,
  status               text NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'open', 'half_open')),
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_success_at      timestamptz,
  last_failure_at      timestamptz,
  last_error           text,
  avg_latency_ms       integer,
  calls_today          integer NOT NULL DEFAULT 0,
  calls_today_date     date NOT NULL DEFAULT current_date,
  open_until           timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, provider_name)
);

ALTER TABLE public.rate_provider_health ENABLE ROW LEVEL SECURITY;

-- Health state is operational telemetry, not tenant-editable data --
-- readable by the same admin roles as the configs, writable only by the
-- edge function (service_role).
CREATE POLICY rate_provider_health_tenant_admin_select ON public.rate_provider_health
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = rate_provider_health.tenant_id
        AND ur.role IN ('tenant_admin','franchise_admin','platform_admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'platform_admin'
    )
  );

GRANT SELECT      ON public.rate_provider_health TO authenticated;
GRANT ALL         ON public.rate_provider_health TO service_role;

-- ─── Normalized rate cache ───────────────────────────────────────────────
-- Every successful tool-call result gets normalized (see
-- _shared/rate-providers/types.ts NormalizedRate) and cached here, keyed
-- on the lookup parameters. Serves two purposes: (1) avoid paying for a
-- repeat call to a metered third-party API within the TTL window, (2)
-- give buildBenchmarkContext() (ai-advisor/index.ts) a real, multi-
-- provider data point instead of only this tenant's own historical
-- `rates` table -- see design doc §7/§11.

CREATE TABLE public.external_rate_cache (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_name      text NOT NULL,
  origin             text NOT NULL,
  destination        text NOT NULL,
  mode               text NOT NULL,
  container_type     text,
  normalized_payload jsonb NOT NULL,   -- NormalizedRate shape -- see types.ts
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL,
  request_hash       text NOT NULL    -- origin|destination|mode|container_type, for fast lookup
);

CREATE INDEX external_rate_cache_lookup_idx
  ON public.external_rate_cache (tenant_id, request_hash, expires_at);

CREATE INDEX external_rate_cache_expiry_idx
  ON public.external_rate_cache (expires_at);

ALTER TABLE public.external_rate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY external_rate_cache_tenant_select ON public.external_rate_cache
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

GRANT SELECT      ON public.external_rate_cache TO authenticated;
GRANT ALL         ON public.external_rate_cache TO service_role;

-- ====================================================================
-- Gateway-side decryption helper -- SECURITY DEFINER, service_role only.
-- Returns EVERY active provider config for a tenant WITH decrypted keys,
-- filtered to providers not currently circuit-broken open. This is what
-- the registry (_shared/rate-providers/registry.ts) calls once per
-- request to build both (a) the tool-schema enum offered to the LLM and
-- (b) the dispatch map used when a tool_call actually needs executing.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_rate_providers(
  p_tenant_id uuid
)
RETURNS TABLE (
  config_id         uuid,
  provider_name     text,
  display_name      text,
  base_url          text,
  auth_scheme       text,
  auth_header_name  text,
  api_key           text,    -- DECRYPTED — never expose this to clients
  timeout_ms        integer,
  priority          integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, vault
AS $$
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id                AS config_id,
    c.provider_name      AS provider_name,
    c.display_name      AS display_name,
    c.base_url          AS base_url,
    c.auth_scheme       AS auth_scheme,
    c.auth_header_name  AS auth_header_name,
    vs.decrypted_secret AS api_key,
    c.timeout_ms        AS timeout_ms,
    c.priority          AS priority
  FROM public.rate_provider_configs c
  LEFT JOIN vault.decrypted_secrets vs ON vs.name = c.vault_secret_name
  LEFT JOIN public.rate_provider_health h
    ON h.tenant_id = c.tenant_id AND h.provider_name = c.provider_name
  WHERE c.tenant_id = p_tenant_id
    AND c.is_active = true
    AND (h.status IS NULL OR h.status <> 'open' OR h.open_until < now())
  ORDER BY c.priority ASC, c.created_at ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_rate_providers FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_tenant_rate_providers TO service_role;

COMMENT ON FUNCTION public.get_tenant_rate_providers IS
  'Gateway helper for the Smart Quote tool-calling flow. SECURITY DEFINER + service_role-only. Returns every active, non-circuit-broken rate provider for a tenant WITH decrypted credentials. Never expose to clients.';

COMMENT ON TABLE public.rate_provider_configs IS
  'Per-tenant third-party freight rate provider credentials + connection metadata. Mirrors platform.llm_provider_configs'' vault-backed pattern. See docs/smart-quote-module-design.md.';
COMMENT ON TABLE public.rate_provider_health IS
  'Circuit-breaker state per (tenant, provider), updated by the tool-call orchestrator after every real attempt. A provider with status=open is excluded from the LLM''s tool schema entirely until open_until passes.';
COMMENT ON TABLE public.external_rate_cache IS
  'Normalized rate results from successful third-party tool calls, cached by TTL. Also feeds the competitive-benchmark context in ai-advisor''s generateSmartQuotes.';
