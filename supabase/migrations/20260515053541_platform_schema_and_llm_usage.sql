-- Reconstituted 2026-05-21 from Supabase prod (gzhxgoigflftharcmdqj/supabase_migrations.schema_migrations).
-- Applied directly to prod under version 20260515053541; the local file is being
-- added now to mirror prod truth. Do not re-apply.
--

-- ====================================================================
-- Platform schema bootstrap (minimum: just llm_usage for now).
-- Per design doc §11 T1.5 + ADR-022 (async-write pattern) + ADR-024 §5.
--
-- platform.llm_usage records every LLM Gateway call:
--   tenant_id, franchise_id, user_id, provider, model, prompt_version,
--   input_tokens, output_tokens, cached_input_tokens, cost_usd, latency_ms,
--   request_id, task_id, status.
--
-- Monthly-partitioned per ADR-022. Retention: 13 months (billing reconciliation + YoY).
-- ====================================================================

CREATE SCHEMA IF NOT EXISTS platform;
GRANT USAGE ON SCHEMA platform TO authenticated, anon, service_role;

CREATE TABLE platform.llm_usage (
  id                  bigserial,
  ts                  timestamptz NOT NULL DEFAULT now(),
  request_id          uuid,
  task_id             text NOT NULL,                 -- routing key (e.g., 'markets.daily_brief')
  prompt_version      text,                          -- versioned prompt id from registry (future)
  tenant_id           uuid REFERENCES public.tenants(id),
  franchise_id        uuid REFERENCES public.franchises(id),
  user_id             uuid REFERENCES auth.users(id),
  provider            text NOT NULL,                 -- 'anthropic' | 'openai' | 'gemini' | 'local-qwen' | ...
  model               text NOT NULL,                 -- e.g. 'claude-sonnet-4-5'
  input_tokens        integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  cached_input_tokens integer NOT NULL DEFAULT 0,
  cost_usd            numeric(12,6) NOT NULL DEFAULT 0,
  latency_ms          integer,
  status              text NOT NULL DEFAULT 'ok'     -- ok | error | rate_limited | timeout
                      CHECK (status IN ('ok','error','rate_limited','timeout','budget_exceeded')),
  error_code          text,
  error_message       text,
  metadata            jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

-- Initial partitions (covers backfill + current + next month buffer)
CREATE TABLE platform.llm_usage_y2026m04 PARTITION OF platform.llm_usage
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE platform.llm_usage_y2026m05 PARTITION OF platform.llm_usage
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE platform.llm_usage_y2026m06 PARTITION OF platform.llm_usage
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE INDEX llm_usage_tenant_ts_idx ON platform.llm_usage (tenant_id, ts DESC);
CREATE INDEX llm_usage_user_ts_idx   ON platform.llm_usage (user_id, ts DESC) WHERE user_id IS NOT NULL;
CREATE INDEX llm_usage_provider_ts_idx ON platform.llm_usage (provider, ts DESC);
CREATE INDEX llm_usage_task_ts_idx   ON platform.llm_usage (task_id, ts DESC);
CREATE INDEX llm_usage_request_idx   ON platform.llm_usage (request_id) WHERE request_id IS NOT NULL;

-- RLS: only service_role writes; users read own; tenant_admin reads tenant;
-- platform_admin reads all. v1 keeps this simple — single permissive policy
-- per (role, command) per ADR-026 §3 and the new RLS pattern.
ALTER TABLE platform.llm_usage           ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.llm_usage_y2026m04  ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.llm_usage_y2026m05  ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.llm_usage_y2026m06  ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated user sees their own rows (works for individual
-- users; tenant/platform admins can be extended later via a definer view).
CREATE POLICY llm_usage_owner_select ON platform.llm_usage
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Mirror on each partition for direct-partition queries
CREATE POLICY llm_usage_y2026m04_owner_select ON platform.llm_usage_y2026m04
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY llm_usage_y2026m05_owner_select ON platform.llm_usage_y2026m05
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY llm_usage_y2026m06_owner_select ON platform.llm_usage_y2026m06
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Grants: service_role does all writes; authenticated only reads
GRANT SELECT ON platform.llm_usage TO authenticated;
GRANT ALL    ON platform.llm_usage TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform
  GRANT ALL    ON TABLES TO service_role;