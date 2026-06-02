-- LLM Gateway P1.3 — gateway.* schema foundation.
--
-- Per docs/plans/2026-06-02-unified-llm-gateway-design.md §1.2 + §3.4-3.6.
-- Five essential tables for resolver + audit:
--   gateway.provider_configs            (6-layer cascade entries)
--   gateway.tenant_provider_credentials (BYO-key vault refs)
--   gateway.provider_models             (catalog: cost, capabilities)
--   gateway.provider_residency_map      (egress policy)
--   gateway.llm_invocations             (append-only audit log)
--
-- Deferred to later phases (not in this migration):
--   gateway.prompts + gateway.prompt_versions  (P3)
--   gateway.llm_usage_daily                    (P5 — partitioned monthly)
--   gateway.budget_caps + gateway.quota_caps   (P2)
--   gateway.tenant_pii_policy                  (P2)
--   gateway.tenant_residency                   (P2)
--   gateway.tenant_billing_settings            (P5)
--   gateway.provider_billing_periods           (P5)
--
-- Design decision (open question #1 from §12): for now we host
-- gateway.* in the main logic-nexus-ai project rather than a dedicated
-- Supabase project. Cleaner isolation can come later — the schema
-- namespace gives us that escape hatch without app changes.

CREATE SCHEMA IF NOT EXISTS gateway;
GRANT USAGE ON SCHEMA gateway TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- gateway.tenant_provider_credentials (created first; FK target below)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE gateway.tenant_provider_credentials (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid,                                  -- NULL = platform-owned key
  provider_kind     text NOT NULL CHECK (provider_kind IN
                      ('anthropic','openai','google_gemini','mistral','ollama',
                       'vllm','azure_openai','echo','replay')),
  credential_kind   text NOT NULL DEFAULT 'api_key'
                      CHECK (credential_kind IN
                        ('api_key','bearer_token','azure_deployment','aws_iam','custom_header')),
  vault_secret_id   text NOT NULL,                          -- references vault.decrypted_secrets.name or id
  last_rotated_at   timestamptz,
  expires_at        timestamptz,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','rotating','revoked')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tenant_provider_credentials_tenant_idx
  ON gateway.tenant_provider_credentials (tenant_id, provider_kind)
  WHERE status = 'active';
ALTER TABLE gateway.tenant_provider_credentials ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway.tenant_provider_credentials TO service_role;

CREATE TRIGGER trg_gw_tpc_updated_at
  BEFORE UPDATE ON gateway.tenant_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- gateway.provider_configs (the 6-layer cascade)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE gateway.provider_configs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_kind               text NOT NULL CHECK (scope_kind IN
                             ('feature_pin','user','franchisee','tenant','domain','platform_default')),
  scope_id                 text NOT NULL,
  provider_kind            text NOT NULL CHECK (provider_kind IN
                             ('anthropic','openai','google_gemini','mistral','ollama',
                              'vllm','azure_openai','echo','replay')),
  model_id                 text NOT NULL,
  credentials_ref          uuid REFERENCES gateway.tenant_provider_credentials(id) ON DELETE SET NULL,
  endpoint_url             text,
  is_pin                   boolean NOT NULL DEFAULT false,
  fallback_provider_kind   text,
  fallback_model_id        text,
  billing_mode             text NOT NULL DEFAULT 'platform_paid'
                             CHECK (billing_mode IN ('platform_paid','tenant_paid')),
  required_capabilities    text[],
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_by_user_id       uuid,
  UNIQUE (scope_kind, scope_id),
  CONSTRAINT pin_only_on_feature_pin CHECK (is_pin = false OR scope_kind = 'feature_pin')
);
CREATE INDEX provider_configs_scope_idx ON gateway.provider_configs (scope_kind, scope_id);
ALTER TABLE gateway.provider_configs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway.provider_configs TO service_role;

CREATE TRIGGER trg_gw_pc_updated_at
  BEFORE UPDATE ON gateway.provider_configs
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- gateway.provider_models (catalog: cost, capabilities, deprecation)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE gateway.provider_models (
  provider_kind                  text NOT NULL,
  model_id                       text NOT NULL,
  context_window                 integer,
  input_cost_per_million_tokens  numeric(10,4),
  output_cost_per_million_tokens numeric(10,4),
  capabilities                   text[] NOT NULL DEFAULT ARRAY[]::text[],
  default_region                 text,
  deprecated_at                  timestamptz,
  replacement_model_id           text,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_kind, model_id)
);
ALTER TABLE gateway.provider_models ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway.provider_models TO service_role;

CREATE TRIGGER trg_gw_pm_updated_at
  BEFORE UPDATE ON gateway.provider_models
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- gateway.provider_residency_map (egress policy)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE gateway.provider_residency_map (
  provider_kind      text PRIMARY KEY,
  allowed_regions    text[] NOT NULL,
  notes              text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE gateway.provider_residency_map ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON gateway.provider_residency_map TO service_role;

CREATE TRIGGER trg_gw_prm_updated_at
  BEFORE UPDATE ON gateway.provider_residency_map
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- gateway.llm_invocations (append-only audit log)
-- ══════════════════════════════════════════════════════════════════════
CREATE TABLE gateway.llm_invocations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL,
  request_id                  text NOT NULL,                -- X-Correlation-Id
  prompt_key                  text NOT NULL,
  module                      text NOT NULL,
  feature                     text NOT NULL,
  subject_type                text,
  subject_id                  text,
  resolved_scope_kind         text NOT NULL,
  resolved_scope_id           text NOT NULL,
  provider_kind               text NOT NULL,
  model_id                    text NOT NULL,
  billing_mode                text NOT NULL,
  fallback_used               boolean NOT NULL DEFAULT false,
  cache_hit                   boolean NOT NULL DEFAULT false,
  variables_redacted_hash     text,                          -- SHA-256 of redacted vars (P2)
  response_hash               text,                          -- SHA-256 of response body (P2)
  prompt_tokens               integer NOT NULL DEFAULT 0,
  completion_tokens           integer NOT NULL DEFAULT 0,
  total_tokens                integer NOT NULL DEFAULT 0,
  provider_cost_usd           numeric(12,6) NOT NULL DEFAULT 0,
  billed_cost_usd             numeric(12,6) NOT NULL DEFAULT 0,
  latency_ms                  integer NOT NULL,
  warnings                    text[],
  retention_class             text NOT NULL DEFAULT 'general_2y'
                                CHECK (retention_class IN ('general_2y','compliance_7y','minimal_30d')),
  parent_invocation_id        uuid,                          -- for agent chains (§9.4)
  trace_id                    text,                          -- OpenTelemetry trace propagation (§10.2)
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX llm_invocations_tenant_created_idx
  ON gateway.llm_invocations (tenant_id, created_at DESC);
CREATE INDEX llm_invocations_prompt_key_idx
  ON gateway.llm_invocations (prompt_key, created_at DESC);
CREATE INDEX llm_invocations_parent_idx
  ON gateway.llm_invocations (parent_invocation_id) WHERE parent_invocation_id IS NOT NULL;
ALTER TABLE gateway.llm_invocations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON gateway.llm_invocations TO service_role;
-- Tenant admins read their own invocations only.
CREATE POLICY llm_invocations_tenant_select
  ON gateway.llm_invocations FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- ── Append-only guard ──
-- UPDATE and DELETE blocked. Right-to-be-forgotten (§9.5) NULLs PII
-- columns via a SECURITY DEFINER RPC, never touches metadata.
CREATE OR REPLACE FUNCTION gateway.block_invocation_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'gateway.llm_invocations is append-only (operation=%)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER trg_block_update_delete
  BEFORE UPDATE OR DELETE ON gateway.llm_invocations
  FOR EACH ROW EXECUTE FUNCTION gateway.block_invocation_update_delete();

-- ══════════════════════════════════════════════════════════════════════
-- Seed: default models + residency for the providers we ship right now
-- ══════════════════════════════════════════════════════════════════════
INSERT INTO gateway.provider_models (provider_kind, model_id, capabilities, context_window,
                                     input_cost_per_million_tokens, output_cost_per_million_tokens)
VALUES
  ('echo',      'echo-v1',         ARRAY['json_mode'],                          1000000,  0,    0),
  ('replay',    'replay-v1',       ARRAY['json_mode','tools','vision'],         1000000,  0,    0),
  ('anthropic', 'claude-opus-4-7', ARRAY['tools','vision','json_mode'],         200000,  15,   75),
  ('anthropic', 'claude-sonnet-4-6', ARRAY['tools','vision','json_mode'],       200000,   3,   15),
  ('anthropic', 'claude-haiku-4-5-20251001', ARRAY['tools','vision','json_mode'], 200000, 0.8,  4)
ON CONFLICT (provider_kind, model_id) DO NOTHING;

INSERT INTO gateway.provider_residency_map (provider_kind, allowed_regions, notes)
VALUES
  ('echo',      ARRAY['us-east','us-west','eu-central','in-south'], 'local mock; everywhere'),
  ('replay',    ARRAY['us-east','us-west','eu-central','in-south'], 'fixture-based; everywhere'),
  ('anthropic', ARRAY['us-east','us-west','eu-central'],            'Anthropic supports US + EU regions'),
  ('openai',    ARRAY['us-east','us-west','eu-central'],            'OpenAI supports US + EU regions'),
  ('google_gemini', ARRAY['us-east','us-west','eu-central','asia-east'], 'Vertex AI broad coverage'),
  ('mistral',   ARRAY['eu-central','us-east'],                      'Mistral EU-first'),
  ('ollama',    ARRAY['us-east','us-west','eu-central','in-south'], 'self-hosted; tenant-defined'),
  ('vllm',      ARRAY['us-east','us-west','eu-central','in-south'], 'self-hosted; tenant-defined'),
  ('azure_openai', ARRAY['us-east','us-west','eu-central','asia-east'], 'Azure broad coverage')
ON CONFLICT (provider_kind) DO NOTHING;

-- Bootstrap one platform_default config so gateway always resolves.
INSERT INTO gateway.provider_configs (scope_kind, scope_id, provider_kind, model_id, is_pin, billing_mode)
VALUES ('platform_default', '*', 'echo', 'echo-v1', false, 'platform_paid')
ON CONFLICT (scope_kind, scope_id) DO NOTHING;
