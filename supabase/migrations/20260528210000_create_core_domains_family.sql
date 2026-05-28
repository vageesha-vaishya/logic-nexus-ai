-- Phase 1 Slice E Part 1 — core.domains family
-- Per master §2.7(6) + §7.4 Phase 1 + §8.2
--
-- Lifts the 6-table public.platform_domains family into core.*. This is
-- additive — public.* tables continue to receive writes (via the dual-write
-- triggers added in the companion migration). The frontend route-guard
-- rewrite (Slice E Part 2) cuts readers over once parity is verified.
--
-- Family in scope:
--   public.platform_domains             → core.domains
--   public.domain_config                → core.domain_config
--   public.domain_metadata              → core.domain_metadata
--   public.domain_relationships         → core.domain_relationships
--   public.user_domain_assignments      → core.user_domain_assignments
--   public.tenant_domain_assignments    → core.tenant_domain_assignments
--
-- The audit trail (public.domain_audit_log) already shadow-writes to
-- core.audit_log via migration 20260528160100; no additional work needed
-- for that table.

-- ──────────────────────────────────────────────────────────────────────────
-- core.domains  (the catalog: AMRO, MARKETS, LOGISTICS, etc.)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.domains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nullable to match public.platform_domains reality — prod has at least one
  -- row (key='healthcare') where code was never populated. Backfill below
  -- copies through as-is rather than coalescing so the dual-write trigger can
  -- keep parity intact. The route-guard cutover (Slice E Part 2) treats a
  -- NULL code as "not selectable from UI" and continues to gate on key.
  code                text UNIQUE,                                    -- 'AMRO', 'MARKETS', 'LOGISTICS' (matches requiredDomainCode)
  key                 text UNIQUE,                                    -- machine-friendly alias from later ALTER on platform_domains
  name                text NOT NULL,
  description         text,
  owner               text,
  status              text DEFAULT 'planned'
                      CHECK (status IN ('active','deprecated','beta','planned')),
  deployment_target   text,
  repository_url      text,
  swagger_endpoint    text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE core.domains IS
  'Platform domain catalogue. Replaces public.platform_domains. Used by ProtectedRoute requiredDomainCode= prop after Slice E Part 2 cutover. Per master §2.7(6).';

CREATE INDEX domains_code_active_idx
  ON core.domains (code)
  WHERE is_active = true;

CREATE INDEX domains_status_idx
  ON core.domains (status)
  WHERE status IN ('active','beta');

-- ──────────────────────────────────────────────────────────────────────────
-- core.domain_config  (per-environment settings)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.domain_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id     uuid REFERENCES core.domains(id) ON DELETE CASCADE,
  environment   text NOT NULL,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, environment)
);

CREATE INDEX domain_config_domain_idx
  ON core.domain_config (domain_id, environment);

-- ──────────────────────────────────────────────────────────────────────────
-- core.domain_metadata  (key-value extension)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.domain_metadata (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id    uuid REFERENCES core.domains(id) ON DELETE CASCADE,
  key          text NOT NULL,
  value        jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain_id, key)
);

CREATE INDEX domain_metadata_domain_key_idx
  ON core.domain_metadata (domain_id, key);

-- ──────────────────────────────────────────────────────────────────────────
-- core.domain_relationships  (upstream / downstream / peer graph)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.domain_relationships (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain_id    uuid REFERENCES core.domains(id) ON DELETE CASCADE,
  target_domain_id    uuid REFERENCES core.domains(id) ON DELETE CASCADE,
  relationship_type   text NOT NULL
                      CHECK (relationship_type IN ('upstream','downstream','peer')),
  description         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_domain_id, target_domain_id)
);

CREATE INDEX domain_relationships_source_idx
  ON core.domain_relationships (source_domain_id, relationship_type);

-- ──────────────────────────────────────────────────────────────────────────
-- core.user_domain_assignments  (per-user × per-tenant × per-domain access)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.user_domain_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,                                      -- FK to auth.users; not enforced here
  tenant_id     uuid NOT NULL,
  domain_id     uuid NOT NULL REFERENCES core.domains(id) ON DELETE CASCADE,
  assigned_by   uuid,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, domain_id)
);

CREATE INDEX user_domain_assignments_user_idx
  ON core.user_domain_assignments (user_id, tenant_id)
  WHERE is_active = true;

CREATE INDEX user_domain_assignments_domain_idx
  ON core.user_domain_assignments (domain_id, tenant_id)
  WHERE is_active = true;

-- ──────────────────────────────────────────────────────────────────────────
-- core.tenant_domain_assignments  (tenant-level enablement)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE core.tenant_domain_assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL,
  domain_id     uuid NOT NULL REFERENCES core.domains(id) ON DELETE CASCADE,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, domain_id)
);

CREATE INDEX tenant_domain_assignments_tenant_idx
  ON core.tenant_domain_assignments (tenant_id)
  WHERE is_active = true;

-- ──────────────────────────────────────────────────────────────────────────
-- touch_updated_at triggers
-- (core.touch_updated_at function already exists from 20260528130200)
-- ──────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_core_domains_updated_at
  BEFORE UPDATE ON core.domains
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER trg_core_domain_config_updated_at
  BEFORE UPDATE ON core.domain_config
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER trg_core_domain_metadata_updated_at
  BEFORE UPDATE ON core.domain_metadata
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER trg_core_user_domain_assignments_updated_at
  BEFORE UPDATE ON core.user_domain_assignments
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
CREATE TRIGGER trg_core_tenant_domain_assignments_updated_at
  BEFORE UPDATE ON core.tenant_domain_assignments
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — Domain catalog rows are world-readable (everyone needs to see what
-- domains exist for navigation/menu rendering); assignments are scoped.
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE core.domains                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.domain_config                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.domain_metadata               ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.domain_relationships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.user_domain_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.tenant_domain_assignments     ENABLE ROW LEVEL SECURITY;

-- Catalog tables — readable by all authenticated (same as legacy platform_domains)
CREATE POLICY domains_public_read ON core.domains
  FOR SELECT TO authenticated USING (true);
CREATE POLICY domain_config_public_read ON core.domain_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY domain_metadata_public_read ON core.domain_metadata
  FOR SELECT TO authenticated USING (true);
CREATE POLICY domain_relationships_public_read ON core.domain_relationships
  FOR SELECT TO authenticated USING (true);

-- Assignment tables — user reads own; tenant_admin reads tenant
CREATE POLICY user_domain_assignments_self_read ON core.user_domain_assignments
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_domain_assignments_tenant_admin ON core.user_domain_assignments
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND (
      public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
    )
  );

CREATE POLICY tenant_domain_assignments_tenant_read ON core.tenant_domain_assignments
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- Writes are service_role-only (admin tooling routes through service paths)

-- ──────────────────────────────────────────────────────────────────────────
-- Grants
-- ──────────────────────────────────────────────────────────────────────────

GRANT SELECT ON core.domains                       TO authenticated;
GRANT SELECT ON core.domain_config                 TO authenticated;
GRANT SELECT ON core.domain_metadata               TO authenticated;
GRANT SELECT ON core.domain_relationships          TO authenticated;
GRANT SELECT ON core.user_domain_assignments       TO authenticated;
GRANT SELECT ON core.tenant_domain_assignments     TO authenticated;
GRANT ALL    ON core.domains                       TO service_role;
GRANT ALL    ON core.domain_config                 TO service_role;
GRANT ALL    ON core.domain_metadata               TO service_role;
GRANT ALL    ON core.domain_relationships          TO service_role;
GRANT ALL    ON core.user_domain_assignments       TO service_role;
GRANT ALL    ON core.tenant_domain_assignments     TO service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- One-time backfill from public.* into core.*
-- (Re-runnable: uses ON CONFLICT DO NOTHING so re-applying the migration
--  on a partially-populated core schema is safe.)
-- ──────────────────────────────────────────────────────────────────────────

-- Domains catalog: preserve IDs so existing assignments keep referencing.
INSERT INTO core.domains (
  id, code, key, name, description, owner, status,
  deployment_target, repository_url, swagger_endpoint,
  is_active, created_at, updated_at
)
SELECT
  id, code, key, name, description, owner,
  COALESCE(status, 'planned'),
  deployment_target, repository_url, swagger_endpoint,
  COALESCE(is_active, true),
  COALESCE(created_at, now()),
  COALESCE(updated_at, now())
FROM public.platform_domains
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.domain_config (id, domain_id, environment, config, created_at, updated_at)
SELECT id, domain_id, environment, COALESCE(config, '{}'::jsonb),
       COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM public.domain_config
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.domain_metadata (id, domain_id, key, value, created_at, updated_at)
SELECT id, domain_id, key, value,
       COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM public.domain_metadata
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.domain_relationships (id, source_domain_id, target_domain_id, relationship_type, description, created_at)
SELECT id, source_domain_id, target_domain_id, relationship_type, description,
       COALESCE(created_at, now())
FROM public.domain_relationships
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.user_domain_assignments (id, user_id, tenant_id, domain_id, assigned_by, is_active, created_at, updated_at)
SELECT id, user_id, tenant_id, domain_id, assigned_by, COALESCE(is_active, true),
       COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM public.user_domain_assignments
ON CONFLICT (id) DO NOTHING;

INSERT INTO core.tenant_domain_assignments (id, tenant_id, domain_id, is_active, created_by, created_at, updated_at)
SELECT id, tenant_id, domain_id, COALESCE(is_active, true), created_by,
       COALESCE(created_at, now()), COALESCE(updated_at, now())
FROM public.tenant_domain_assignments
ON CONFLICT (id) DO NOTHING;
