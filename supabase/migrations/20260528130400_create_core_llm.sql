-- Phase 1.5 — core.llm_* (lift from platform.*)
-- Per master design doc §6.2–§6.5 + core.md §3.9
--
-- This migration creates the core.* mirrors of platform.llm_provider_configs
-- and platform.llm_usage, plus the new core.llm_invocations observability
-- table from master §6.5.
--
-- It does NOT lift data from platform.*. A follow-up migration backfills once
-- consumers cut over to writing to core.* (planned during Phase 1.6, after
-- @platform/llm-client is wired in Phase 9).
--
-- After all consumers cut over, platform.llm_* are dropped (master §7.4 Phase 1
-- end + §2.8: platform.* schema is dropped in target state).

-- ── core.llm_provider_configs ────────────────────────────────────────────────

CREATE TABLE core.llm_provider_configs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL,
  provider          text NOT NULL CHECK (provider IN ('anthropic','openai','gemini','openrouter','mistral','cohere','local-qwen','custom')),
  display_name      text NOT NULL,
  base_url          text,                                          -- null = provider default
  default_model     text NOT NULL,
  fallback_model    text,                                          -- new in core: see master §6.4 + prompt frontmatter
  vault_secret_name text NOT NULL,                                  -- name in vault.decrypted_secrets
  is_active         boolean NOT NULL DEFAULT true,
  is_default        boolean NOT NULL DEFAULT false,
  rate_limit_qps    int     NOT NULL DEFAULT 50,                    -- new in core: per-config QPS cap
  created_by_user_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  last_used_at      timestamptz,
  metadata          jsonb NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, provider, display_name)
);

COMMENT ON TABLE core.llm_provider_configs IS
  'Per-tenant LLM provider configurations. Master §6.2 / §6.4 / core.md §3.9. Lifted from platform.llm_provider_configs.';

CREATE UNIQUE INDEX llm_provider_configs_one_default_per_tenant
  ON core.llm_provider_configs (tenant_id)
  WHERE is_default = true;

CREATE INDEX llm_provider_configs_tenant_idx
  ON core.llm_provider_configs (tenant_id, is_active);

-- Enforce single-default-per-tenant via trigger (preserves platform.* behaviour)
CREATE OR REPLACE FUNCTION core.llm_configs_enforce_single_default()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, core
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE core.llm_provider_configs
       SET is_default = false
     WHERE tenant_id = NEW.tenant_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_llm_configs_enforce_default
  BEFORE INSERT OR UPDATE ON core.llm_provider_configs
  FOR EACH ROW EXECUTE FUNCTION core.llm_configs_enforce_single_default();

-- ── core.llm_usage (partitioned monthly) ─────────────────────────────────────

CREATE TABLE core.llm_usage (
  id                  bigserial,
  ts                  timestamptz NOT NULL DEFAULT now(),
  request_id          uuid,
  invocation_id       uuid,                                          -- FK to core.llm_invocations (added once that table exists below)
  task_id             text NOT NULL,                                  -- '<module>.<feature>' routing key
  prompt_key          text,                                           -- versioned prompt registry key (master §6.3)
  prompt_version      int,
  tenant_id           uuid,
  franchise_id        uuid,
  user_id             uuid,
  provider            text NOT NULL,
  model               text NOT NULL,
  input_tokens        integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  cached_input_tokens integer NOT NULL DEFAULT 0,
  cost_usd            numeric(12,6) NOT NULL DEFAULT 0,
  latency_ms          integer,
  cache_hit           boolean NOT NULL DEFAULT false,                 -- new in core: observability for cache effectiveness
  status              text NOT NULL DEFAULT 'ok'
                      CHECK (status IN ('ok','error','rate_limited','timeout','budget_exceeded')),
  error_code          text,
  error_message       text,
  metadata            jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

COMMENT ON TABLE core.llm_usage IS
  'Per-call LLM cost + token accounting. Master §6.5 + §6.11. Lifted from platform.llm_usage with added cache_hit + invocation_id + prompt_key/version columns.';

-- Initial partitions (current and forward; backfill from platform.* uses
-- prior-month partitions added by a separate migration once cut-over is planned)
CREATE TABLE core.llm_usage_y2026m05 PARTITION OF core.llm_usage
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE core.llm_usage_y2026m06 PARTITION OF core.llm_usage
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE core.llm_usage_y2026m07 PARTITION OF core.llm_usage
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE core.llm_usage_y2026m08 PARTITION OF core.llm_usage
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX llm_usage_tenant_ts_idx     ON core.llm_usage (tenant_id, ts DESC);
CREATE INDEX llm_usage_user_ts_idx       ON core.llm_usage (user_id, ts DESC) WHERE user_id IS NOT NULL;
CREATE INDEX llm_usage_task_ts_idx       ON core.llm_usage (task_id, ts DESC);
CREATE INDEX llm_usage_invocation_idx    ON core.llm_usage (invocation_id) WHERE invocation_id IS NOT NULL;

-- ── core.llm_invocations (the per-call observability log — NEW) ──────────────
-- Per master §6.5. The foundation of the self-improvement loop:
-- captures input variables, resolved prompt, output, downstream outcome.

CREATE TABLE core.llm_invocations (
  id                  uuid NOT NULL,
  tenant_id           uuid NOT NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  module              text NOT NULL,
  feature             text NOT NULL,
  prompt_key          text NOT NULL,
  prompt_version      int  NOT NULL,
  experiment_id       uuid,
  experiment_arm      text CHECK (experiment_arm IN ('control','variant') OR experiment_arm IS NULL),
  subject_type        text,                                            -- schema.entity per master §2.4
  subject_id          uuid,
  variables           jsonb NOT NULL DEFAULT '{}',
  resolved_prompt     text NOT NULL,                                    -- final text sent to provider (post-redaction)
  model_used          text NOT NULL,
  output_raw          text,
  output_parsed       jsonb,
  cache_hit           boolean NOT NULL DEFAULT false,
  prompt_tokens       int,
  completion_tokens   int,
  total_tokens        int,
  cost_usd            numeric(12,6),
  latency_ms          int,
  outcome_recorded_at timestamptz,
  outcome             jsonb,                                            -- {kind:'accepted'|'rejected'|'overridden'|'ignored', user_id?, edited_output?, notes?}
  warnings            text[],
  error               text,
  PRIMARY KEY (tenant_id, occurred_at, id)
) PARTITION BY RANGE (occurred_at);

COMMENT ON TABLE core.llm_invocations IS
  'Per-call LLM observability log. Captures variables, resolved prompt, output, and downstream outcome. Foundation of the Improver Agent loop (master §6.5 / §6.7).';

CREATE TABLE core.llm_invocations_y2026m05 PARTITION OF core.llm_invocations
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE core.llm_invocations_y2026m06 PARTITION OF core.llm_invocations
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE core.llm_invocations_y2026m07 PARTITION OF core.llm_invocations
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE core.llm_invocations_y2026m08 PARTITION OF core.llm_invocations
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE INDEX llm_invocations_prompt_idx
  ON core.llm_invocations (prompt_key, prompt_version, occurred_at DESC);
CREATE INDEX llm_invocations_subject_idx
  ON core.llm_invocations (subject_type, subject_id, occurred_at DESC)
  WHERE subject_type IS NOT NULL;
CREATE INDEX llm_invocations_tenant_feature_idx
  ON core.llm_invocations (tenant_id, module, feature, occurred_at DESC);
CREATE INDEX llm_invocations_experiment_idx
  ON core.llm_invocations (experiment_id, experiment_arm)
  WHERE experiment_id IS NOT NULL;
CREATE INDEX llm_invocations_no_outcome_idx
  ON core.llm_invocations (tenant_id, prompt_key, occurred_at)
  WHERE outcome_recorded_at IS NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE core.llm_provider_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_usage              ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_usage_y2026m05     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_usage_y2026m06     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_usage_y2026m07     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_usage_y2026m08     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_invocations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_invocations_y2026m05   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_invocations_y2026m06   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_invocations_y2026m07   ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.llm_invocations_y2026m08   ENABLE ROW LEVEL SECURITY;

-- llm_provider_configs: tenant_admin / franchise_admin / platform_admin
CREATE POLICY llm_configs_tenant_admin_all ON core.llm_provider_configs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = core.llm_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin'::public.app_role,
                        'franchise_admin'::public.app_role,
                        'platform_admin'::public.app_role)
    )
    OR public.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.tenant_id = core.llm_provider_configs.tenant_id
        AND ur.role IN ('tenant_admin'::public.app_role,
                        'franchise_admin'::public.app_role,
                        'platform_admin'::public.app_role)
    )
    OR public.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
  );

-- llm_usage: owner reads own; service_role writes/reads all
CREATE POLICY llm_usage_owner_select ON core.llm_usage
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY llm_usage_y2026m05_owner_select ON core.llm_usage_y2026m05
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY llm_usage_y2026m06_owner_select ON core.llm_usage_y2026m06
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY llm_usage_y2026m07_owner_select ON core.llm_usage_y2026m07
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY llm_usage_y2026m08_owner_select ON core.llm_usage_y2026m08
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- llm_invocations: tenant_admin reads tenant rows; subject-owner reads own (via
-- delegated visibility once subject-helpers exist — for Phase 1, tenant-admin
-- only). service_role does all.
CREATE POLICY llm_invocations_tenant_admin_select ON core.llm_invocations
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );

-- Mirror on each invocations partition
CREATE POLICY llm_invocations_y2026m05_tenant_admin ON core.llm_invocations_y2026m05
  FOR SELECT TO authenticated USING (
    public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );
CREATE POLICY llm_invocations_y2026m06_tenant_admin ON core.llm_invocations_y2026m06
  FOR SELECT TO authenticated USING (
    public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );
CREATE POLICY llm_invocations_y2026m07_tenant_admin ON core.llm_invocations_y2026m07
  FOR SELECT TO authenticated USING (
    public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );
CREATE POLICY llm_invocations_y2026m08_tenant_admin ON core.llm_invocations_y2026m08
  FOR SELECT TO authenticated USING (
    public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON core.llm_provider_configs TO authenticated;
GRANT SELECT                          ON core.llm_usage           TO authenticated;
GRANT SELECT                          ON core.llm_invocations     TO authenticated;
GRANT ALL ON core.llm_provider_configs   TO service_role;
GRANT ALL ON core.llm_usage              TO service_role;
GRANT ALL ON core.llm_usage_y2026m05     TO service_role;
GRANT ALL ON core.llm_usage_y2026m06     TO service_role;
GRANT ALL ON core.llm_usage_y2026m07     TO service_role;
GRANT ALL ON core.llm_usage_y2026m08     TO service_role;
GRANT ALL ON core.llm_invocations            TO service_role;
GRANT ALL ON core.llm_invocations_y2026m05   TO service_role;
GRANT ALL ON core.llm_invocations_y2026m06   TO service_role;
GRANT ALL ON core.llm_invocations_y2026m07   TO service_role;
GRANT ALL ON core.llm_invocations_y2026m08   TO service_role;
GRANT USAGE ON SEQUENCE core.llm_usage_id_seq TO service_role;
