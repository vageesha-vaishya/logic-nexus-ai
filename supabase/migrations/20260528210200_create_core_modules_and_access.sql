-- Phase 1 Slice E Part 1 — core.modules + core.tenant_module_access + has_module_access()
-- Per master §2.3 + §2.7 + §8.2
--
-- Module catalog + per-tenant access table + the canonical helper function
-- that future RLS policies use to gate access. Distinct from core.domains:
--
--   core.domains              = high-level domain catalog (AMRO, MARKETS, ...)
--                               used by `requiredDomainCode` route guard
--   core.modules              = fine-grained module catalog (logistics, crm,
--                               quotation, sales, finance, ...) used by
--                               `moduleCode` route guard + RLS policies
--   core.tenant_module_access = per-tenant enablement of a module
--   core.has_module_access()  = the helper RLS calls
--
-- Earlier Phase 1 RLS migrations (Slice A/B/C/D) use public.has_role +
-- public.get_user_tenant_id as a stopgap. New RLS policies — and rewrites
-- of existing ones — call core.has_module_access() instead.

-- ──────────────────────────────────────────────────────────────────────────
-- core.modules  (module catalog — one row per module on the platform)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.modules (
  module_code           text PRIMARY KEY,
  display_name          text NOT NULL,
  description           text,
  category              text NOT NULL,                              -- 'platform','commercial','operational','regulatory','financial','communications','integration','investment'
  default_enabled       boolean NOT NULL DEFAULT false,             -- ships enabled on new tenants
  is_billable           boolean NOT NULL DEFAULT true,
  min_plan_tier         text DEFAULT 'free'
                        CHECK (min_plan_tier IN ('free','basic','pro','enterprise')),
  required_for_modules  text[] NOT NULL DEFAULT '{}',               -- transitive dependencies
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.modules IS
  'Module catalog for the platform. Master §8.2.1. Seeded with the 11 modules from §2.6.';

CREATE TRIGGER trg_core_modules_updated_at
  BEFORE UPDATE ON core.modules
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- Seed with the 11 modules from master §2.6.
INSERT INTO core.modules (module_code, display_name, category, default_enabled, is_billable, description) VALUES
  ('core',        'Platform Core',     'platform',        true,  false, 'Identity, parties, audit, files, outbox, notifications. Foundation; cannot be disabled.'),
  ('crm',         'CRM',               'commercial',      true,  true,  'Relationship management: account/contact extensions, activities, campaigns, segments.'),
  ('sales',       'Sales',             'commercial',      true,  true,  'Pipeline: leads, opportunities, pipelines, stages, forecasts, targets, commissions.'),
  ('quotation',   'Quotation',         'commercial',      true,  true,  'Pricing & proposals: quotations, versions, options, legs, pricing rules, approvals.'),
  ('logistics',   'Logistics',         'operational',     false, true,  'Fulfilment: shipments, bookings, carriers, lanes, customs, milestones.'),
  ('finance',     'Finance',           'financial',       true,  true,  'Invoices, payments, GL, taxes, dunning, refunds, commission payouts, SaaS subscription billing.'),
  ('compliance',  'Compliance',        'regulatory',      true,  false, 'Sanctions screening, KYC/KYB, denied-party hits, audit decisions. Gates downstream actions.'),
  ('comms',       'Communications',    'communications',  true,  false, 'Email, SMS, WhatsApp, push delivery. Owns inboxes, threads, messages, suppression list.'),
  ('amro',        'AMRO',              'operational',     false, true,  'Aircraft Maintenance, Repair & Overhaul. Aircraft, work orders, MPD, directives, parts, tooling.'),
  ('uim',         'UIM',               'integration',     false, true,  'Universal Inventory Master + Integration Spine. Item-master, stock-ledger, connectors, webhooks.'),
  ('markets',     'Markets',           'investment',      false, true,  'Retail investment & trading: portfolios, holdings, orders, watchlists, AI research.')
ON CONFLICT (module_code) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- core.tenant_module_access  (per-tenant enablement)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.tenant_module_access (
  tenant_id             uuid NOT NULL,
  module_code           text NOT NULL REFERENCES core.modules(module_code) ON DELETE CASCADE,
  status                text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('trial','active','suspended','cancelled')),
  enabled_at            timestamptz NOT NULL DEFAULT now(),
  trial_ends_at         timestamptz,
  suspended_at          timestamptz,
  cancelled_at          timestamptz,
  config                jsonb NOT NULL DEFAULT '{}'::jsonb,         -- per-tenant per-module knobs
  enabled_by_user_id    uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_code)
);

COMMENT ON TABLE core.tenant_module_access IS
  'Per-tenant module enablement. Master §8.2.1. Backs core.has_module_access().';

CREATE TRIGGER trg_core_tenant_module_access_updated_at
  BEFORE UPDATE ON core.tenant_module_access
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

CREATE INDEX tenant_module_access_active_idx
  ON core.tenant_module_access (tenant_id, module_code)
  WHERE status IN ('trial','active');

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — module catalog is world-readable; per-tenant access scoped.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE core.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_public_read ON core.modules
  FOR SELECT TO authenticated USING (true);

ALTER TABLE core.tenant_module_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_module_access_tenant_read ON core.tenant_module_access
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

GRANT SELECT ON core.modules                    TO authenticated;
GRANT SELECT ON core.tenant_module_access       TO authenticated;
GRANT ALL    ON core.modules                    TO service_role;
GRANT ALL    ON core.tenant_module_access       TO service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- core.has_module_access(tenant_id, module_code [, action])
--
-- The canonical helper future RLS policies call. Master §2.3.
-- For Phase 1, the `action` parameter is accepted but ignored — gating is
-- coarse: tenant either has the module or doesn't. Phase 6+ extends with
-- per-action (read/write/admin) granularity if needed.
--
-- TRUE when:
--   - status='active', OR
--   - status='trial' AND trial_ends_at > now()
--   - core.modules.module_code DOES NOT exist (defensive — fail-open for
--     unknown module codes so old code doesn't break when a new module is
--     gated but not yet seeded; counterargument tracked in §9 of the
--     comms-infrastructure.md decisions for future review)
-- FALSE when:
--   - tenant has no row, AND core.modules.default_enabled = false
--   - status='suspended' OR 'cancelled'
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION core.has_module_access(
  p_tenant_id    uuid,
  p_module_code  text,
  p_action       text DEFAULT 'read'
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  SELECT
    CASE
      -- Unknown module → fail-open (don't block legacy code paths)
      WHEN NOT EXISTS (SELECT 1 FROM core.modules WHERE module_code = p_module_code)
        THEN true
      -- Has an explicit row — check status
      WHEN EXISTS (
        SELECT 1
        FROM core.tenant_module_access tma
        WHERE tma.tenant_id   = p_tenant_id
          AND tma.module_code = p_module_code
          AND (
            tma.status = 'active'
            OR (tma.status = 'trial' AND (tma.trial_ends_at IS NULL OR tma.trial_ends_at > now()))
          )
      ) THEN true
      -- No row — fall through to module's default
      ELSE COALESCE(
        (SELECT default_enabled FROM core.modules WHERE module_code = p_module_code),
        false
      )
    END;
$$;

COMMENT ON FUNCTION core.has_module_access IS
  'Returns TRUE if the tenant has the module accessible. Master §2.3 canonical RLS helper. p_action accepted for future granularity but currently ignored.';

GRANT EXECUTE ON FUNCTION core.has_module_access(uuid, text, text)
  TO service_role, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- core.user_has_domain_access(user_id, domain_code)
--
-- Helper for the legacy `requiredDomainCode` route guard (until Slice E
-- Part 2 frontend cutover swaps the call site). Equivalent to today's
-- `useUserDomains()` hook query, but server-side + SECURITY DEFINER so RLS
-- doesn't strip rows.
--
-- TRUE when:
--   - user has an active assignment to the domain WITHIN their current tenant, AND
--   - the tenant itself has the domain assigned and active
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION core.user_has_domain_access(
  p_user_id      uuid,
  p_domain_code  text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
  WITH user_tenant AS (
    SELECT public.get_user_tenant_id(p_user_id) AS tenant_id
  ),
  domain AS (
    SELECT id FROM core.domains
    WHERE code = p_domain_code
      AND is_active = true
    LIMIT 1
  )
  SELECT EXISTS (
    SELECT 1
    FROM core.user_domain_assignments uda
    JOIN domain d ON d.id = uda.domain_id
    JOIN user_tenant ut ON ut.tenant_id = uda.tenant_id
    JOIN core.tenant_domain_assignments tda
      ON tda.tenant_id = ut.tenant_id AND tda.domain_id = d.id
    WHERE uda.user_id   = p_user_id
      AND uda.is_active = true
      AND tda.is_active = true
  );
$$;

COMMENT ON FUNCTION core.user_has_domain_access IS
  'Returns TRUE if the user has access to the named domain within their current tenant AND the tenant itself has the domain enabled. Used by ProtectedRoute requiredDomainCode= prop after Slice E Part 2 cutover.';

GRANT EXECUTE ON FUNCTION core.user_has_domain_access(uuid, text)
  TO service_role, authenticated;
