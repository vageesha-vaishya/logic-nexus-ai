-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515161737; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ══════════════════════════════════════════════════════════════════════════
-- T1: Platform Schema Bootstrap
-- ══════════════════════════════════════════════════════════════════════════
-- DB-VERIFICATION: platform-schema-bootstrap-v1
-- DB-ARCH-APPROVAL: vimal-2026-05-15

-- ── 0. Extensions ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA extensions;

-- ── 1. Augment public.franchises — multi-level hierarchy ────────────────────
ALTER TABLE public.franchises
  ADD COLUMN IF NOT EXISTS parent_franchise_id UUID
    REFERENCES public.franchises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS path extensions.ltree;

CREATE INDEX IF NOT EXISTS idx_franchises_path_gist
  ON public.franchises USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_franchises_parent
  ON public.franchises (parent_franchise_id)
  WHERE parent_franchise_id IS NOT NULL;

-- ── 2. Augment public.user_roles — ABAC additions ───────────────────────────
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS domain      TEXT,
  ADD COLUMN IF NOT EXISTS scope_paths extensions.ltree[],
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conditions  JSONB,
  ADD COLUMN IF NOT EXISTS granted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_roles.domain IS
  'Required only for platform_domain_admin (e.g. ''markets''). NULL for all other roles.';
COMMENT ON COLUMN public.user_roles.scope_paths IS
  'LTREE paths of franchise subtrees spanned by this role grant. NULL = full scope.';
COMMENT ON COLUMN public.user_roles.expires_at IS
  'Optional expiry for time-bounded access grants. NULL = permanent.';

-- ── 3. platform.audit_log ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.audit_log (
  id            BIGSERIAL   PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id    UUID,
  domain        TEXT        NOT NULL,
  op            TEXT        NOT NULL,
  op_ms         INT,
  tenant_id     UUID,
  franchise_id  UUID,
  user_id       UUID,
  acted_by      UUID,
  resource_type TEXT,
  resource_id   TEXT,
  action        TEXT        NOT NULL,
  before        JSONB,
  after         JSONB,
  ip            TEXT,
  user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts
  ON platform.audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_ts
  ON platform.audit_log (tenant_id, ts DESC)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_user_ts
  ON platform.audit_log (user_id, ts DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_resource
  ON platform.audit_log (resource_type, resource_id)
  WHERE resource_type IS NOT NULL;

ALTER TABLE platform.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_own_select ON platform.audit_log
  FOR SELECT USING (user_id = auth.uid() OR acted_by = auth.uid());

-- ── 4. platform.access_log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.access_log (
  id            BIGSERIAL   PRIMARY KEY,
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id    UUID,
  domain        TEXT,
  op            TEXT,
  tenant_id     UUID,
  franchise_id  UUID,
  user_id       UUID,
  resource_type TEXT,
  resource_id   TEXT,
  decision      TEXT        NOT NULL CHECK (decision IN ('allow','deny')),
  reason        TEXT,
  ms            INT
);

CREATE INDEX IF NOT EXISTS idx_access_log_ts
  ON platform.access_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_tenant_ts
  ON platform.access_log (tenant_id, ts DESC)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_log_user_ts
  ON platform.access_log (user_id, ts DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE platform.access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_log_own_select ON platform.access_log
  FOR SELECT USING (user_id = auth.uid());

-- ── 5. platform.idempotency_keys ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.idempotency_keys (
  key        TEXT        PRIMARY KEY,
  response   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires
  ON platform.idempotency_keys (expires_at);

-- ── 6. platform.integrations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.integrations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind              TEXT        NOT NULL
    CHECK (kind IN (
      'broker','market_data','llm','payment','email','sms','push',
      'webhook','sso','storage','analytics','other'
    )),
  name              TEXT        NOT NULL,
  vendor            TEXT        NOT NULL,
  tenant_id         UUID        REFERENCES public.tenants(id)    ON DELETE CASCADE,
  franchise_id      UUID        REFERENCES public.franchises(id) ON DELETE SET NULL,
  scope_json        JSONB       NOT NULL DEFAULT '{}',
  vendor_risk_class TEXT        NOT NULL DEFAULT 'low'
    CHECK (vendor_risk_class IN ('critical','high','medium','low')),
  owner_user_id     UUID        REFERENCES auth.users(id)        ON DELETE SET NULL,
  lifecycle_state   TEXT        NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('draft','active','suspended','terminated')),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant
  ON platform.integrations (tenant_id)
  WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_integrations_kind_vendor
  ON platform.integrations (kind, vendor);

ALTER TABLE platform.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY integrations_platform_admin_all ON platform.integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );
CREATE POLICY integrations_tenant_select ON platform.integrations
  FOR SELECT USING (
    tenant_id IS NULL
    OR tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND tenant_id IS NOT NULL
    )
  );

-- ── 7. platform.integration_credentials ────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.integration_credentials (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    UUID        NOT NULL
    REFERENCES platform.integrations(id) ON DELETE CASCADE,
  credential_type   TEXT        NOT NULL
    CHECK (credential_type IN (
      'api_key','oauth_token','oauth_refresh','hmac_secret',
      'client_cert','basic_auth','custom'
    )),
  vault_secret_name TEXT        NOT NULL,
  rotation_policy   JSONB,
  expires_at        TIMESTAMPTZ,
  last_rotated_at   TIMESTAMPTZ,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_creds_integration
  ON platform.integration_credentials (integration_id);

ALTER TABLE platform.integration_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_creds_platform_admin_only ON platform.integration_credentials
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ── 8. platform.integration_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.integration_log (
  id             BIGSERIAL   PRIMARY KEY,
  ts             TIMESTAMPTZ NOT NULL DEFAULT now(),
  direction      TEXT        NOT NULL CHECK (direction IN ('inbound','outbound')),
  integration_id UUID        REFERENCES platform.integrations(id) ON DELETE SET NULL,
  tenant_id      UUID,
  franchise_id   UUID,
  user_id        UUID,
  request_id     UUID,
  method         TEXT,
  url_path       TEXT,
  status         INT,
  latency_ms     INT,
  bytes_in       INT,
  bytes_out      INT,
  body_redacted  JSONB
);

CREATE INDEX IF NOT EXISTS idx_integration_log_ts
  ON platform.integration_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_integration_log_integration_ts
  ON platform.integration_log (integration_id, ts DESC)
  WHERE integration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_integration_log_tenant_ts
  ON platform.integration_log (tenant_id, ts DESC)
  WHERE tenant_id IS NOT NULL;

ALTER TABLE platform.integration_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_log_platform_admin_all ON platform.integration_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ── 9. platform.webhook_subscriptions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.webhook_subscriptions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id    UUID        REFERENCES platform.integrations(id)            ON DELETE CASCADE,
  tenant_id         UUID        REFERENCES public.tenants(id)                   ON DELETE CASCADE,
  target_url        TEXT        NOT NULL,
  event_filter      JSONB       NOT NULL DEFAULT '{}',
  signing_secret_id UUID
    REFERENCES platform.integration_credentials(id) ON DELETE SET NULL,
  retry_policy      JSONB       NOT NULL
    DEFAULT '{"max_attempts": 5, "backoff_multiplier": 2, "initial_delay_s": 30}',
  last_delivery_ts  TIMESTAMPTZ,
  status            TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','failed'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_tenant
  ON platform.webhook_subscriptions (tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE platform.webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhook_subs_tenant_rw ON platform.webhook_subscriptions
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM public.user_roles
      WHERE user_id = auth.uid() AND tenant_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ── 10. platform.integration_dlq ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.integration_dlq (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  UUID        REFERENCES platform.integrations(id) ON DELETE SET NULL,
  payload         JSONB       NOT NULL,
  error           TEXT,
  attempts        INT         NOT NULL DEFAULT 0,
  first_failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_failed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_dlq_integration
  ON platform.integration_dlq (integration_id, last_failed_at DESC)
  WHERE integration_id IS NOT NULL;

ALTER TABLE platform.integration_dlq ENABLE ROW LEVEL SECURITY;

CREATE POLICY integration_dlq_platform_admin_all ON platform.integration_dlq
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );

-- ── 11. platform.service_accounts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform.service_accounts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        REFERENCES public.tenants(id)    ON DELETE CASCADE,
  franchise_id  UUID        REFERENCES public.franchises(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  scope         TEXT[]      NOT NULL DEFAULT '{}',
  key_hash      TEXT        NOT NULL,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_by    UUID        REFERENCES auth.users(id)        ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_accounts_tenant
  ON platform.service_accounts (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_accounts_key_hash
  ON platform.service_accounts (key_hash);

ALTER TABLE platform.service_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_accounts_platform_admin_all ON platform.service_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );
CREATE POLICY service_accounts_tenant_admin_rw ON platform.service_accounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'tenant_admin'
        AND ur.tenant_id = service_accounts.tenant_id
    )
  );

-- ── 12. RLS helper functions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION platform.is_platform_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid
      AND role = 'platform_admin'
      AND tenant_id    IS NULL
      AND franchise_id IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION platform.get_user_tenant_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT tenant_id
  FROM public.user_roles
  WHERE user_id = uid
    AND tenant_id IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY assigned_at DESC NULLS LAST
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION platform.get_user_franchise_id(uid UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT franchise_id
  FROM public.user_roles
  WHERE user_id = uid
    AND franchise_id IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY assigned_at DESC NULLS LAST
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION platform.is_within_tenant_subtree(uid UUID, p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, auth, platform
AS $$
  SELECT
    platform.is_platform_admin(uid)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = uid
        AND tenant_id = p_tenant_id
        AND (expires_at IS NULL OR expires_at > now())
    )
$$;

CREATE OR REPLACE FUNCTION platform.user_can_access_franchise(uid UUID, target_franchise_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = extensions, public, auth, platform
AS $$
  SELECT
    platform.is_platform_admin(uid)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.franchises f ON f.id = target_franchise_id
      WHERE ur.user_id = uid
        AND ur.role = 'tenant_admin'
        AND ur.tenant_id = f.tenant_id
        AND (ur.expires_at IS NULL OR ur.expires_at > now())
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = uid
        AND franchise_id = target_franchise_id
        AND (expires_at IS NULL OR expires_at > now())
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.franchises uf ON uf.id = ur.franchise_id
      JOIN public.franchises tf ON tf.id = target_franchise_id
      WHERE ur.user_id = uid
        AND uf.path IS NOT NULL
        AND tf.path IS NOT NULL
        AND tf.path <@ uf.path
        AND (ur.expires_at IS NULL OR ur.expires_at > now())
    )
$$;

CREATE OR REPLACE FUNCTION platform.user_has_scope(uid UUID, required_scope TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = extensions, public, auth, platform
AS $$
  SELECT
    platform.is_platform_admin(uid)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = uid
        AND (expires_at IS NULL OR expires_at > now())
        AND (
          scope_paths IS NULL
          OR (required_scope::extensions.ltree <@ ANY(scope_paths))
        )
    )
$$;

-- ── 13. updated_at trigger for integrations ──────────────────────────────────
CREATE OR REPLACE FUNCTION platform.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS integrations_set_updated_at ON platform.integrations;
CREATE TRIGGER integrations_set_updated_at
  BEFORE UPDATE ON platform.integrations
  FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

-- ── 14. Seed current 3rd-party services into integration registry ────────────
INSERT INTO platform.integrations
  (kind, name, vendor, tenant_id, franchise_id, vendor_risk_class, lifecycle_state, scope_json)
VALUES
  ('llm',        'Anthropic Claude',  'anthropic',  NULL, NULL, 'high',    'active', '{"domains":["all"]}'),
  ('llm',        'OpenAI GPT',        'openai',      NULL, NULL, 'high',    'active', '{"domains":["all"]}'),
  ('llm',        'Google Gemini',     'google',      NULL, NULL, 'high',    'active', '{"domains":["all"]}'),
  ('market_data','AMFI NAV Feed',     'amfiindia',   NULL, NULL, 'medium',  'active', '{"domains":["markets"]}'),
  ('market_data','NSE Bhav Copy',     'nseindia',    NULL, NULL, 'medium',  'active', '{"domains":["markets"]}'),
  ('market_data','MCX Bhav Copy',     'mcxindia',    NULL, NULL, 'medium',  'active', '{"domains":["markets"]}'),
  ('market_data','Frankfurter FX',    'frankfurter', NULL, NULL, 'low',     'active', '{"domains":["markets"]}'),
  ('market_data','Yahoo Finance',     'yahoo',       NULL, NULL, 'low',     'active', '{"domains":["markets"]}'),
  ('analytics',  'Supabase',          'supabase',    NULL, NULL, 'critical','active', '{"domains":["all"]}')
ON CONFLICT DO NOTHING;

-- ── 15. GRANTs ───────────────────────────────────────────────────────────────
GRANT USAGE  ON SCHEMA platform                     TO authenticated;
GRANT SELECT ON platform.audit_log                  TO authenticated;
GRANT SELECT ON platform.access_log                 TO authenticated;
GRANT SELECT ON platform.integrations               TO authenticated;
GRANT SELECT ON platform.webhook_subscriptions      TO authenticated;
GRANT EXECUTE ON FUNCTION platform.is_platform_admin(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION platform.get_user_tenant_id(UUID)              TO authenticated;
GRANT EXECUTE ON FUNCTION platform.get_user_franchise_id(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION platform.is_within_tenant_subtree(UUID, UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION platform.user_can_access_franchise(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION platform.user_has_scope(UUID, TEXT)            TO authenticated;