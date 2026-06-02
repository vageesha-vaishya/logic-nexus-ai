-- LLM Gateway P3.3 — A/B promotion infrastructure.
-- Per design §5.6. One active experiment per prompt_key; routes
-- split traffic between two prompt_versions of that key. Auto-promote
-- via statistical-significance check is P3.4 (needs outcome telemetry
-- first); this slice ships the storage + per-call picker.

CREATE TABLE gateway.prompt_experiments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key               text NOT NULL REFERENCES gateway.prompts(key) ON DELETE RESTRICT,
  variant_a_version_id     uuid NOT NULL REFERENCES gateway.prompt_versions(id) ON DELETE RESTRICT,
  variant_b_version_id     uuid NOT NULL REFERENCES gateway.prompt_versions(id) ON DELETE RESTRICT,
  traffic_split            numeric(3,2) NOT NULL DEFAULT 0.50
                             CHECK (traffic_split >= 0 AND traffic_split <= 1),
                           -- fraction of traffic routed to variant_b
                           -- 0.0  = paused / all variant_a
                           -- 0.5  = even split
                           -- 1.0  = all variant_b (functionally a promotion)
  status                   text NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','paused','completed','rolled_back')),
  started_at               timestamptz NOT NULL DEFAULT now(),
  ended_at                 timestamptz,
  target_invocations       integer,         -- target sample size before auto-promote
  target_signal            text             -- 'accept_rate','cost_usd','latency_ms','quality_score'
                             CHECK (target_signal IS NULL OR target_signal IN
                                    ('accept_rate','cost_usd','latency_ms','quality_score')),
  winner_version_id        uuid REFERENCES gateway.prompt_versions(id),
  notes                    text,
  created_by_user_id       uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- A and B must be different (no self-experiment)
  CONSTRAINT variants_differ CHECK (variant_a_version_id <> variant_b_version_id)
);

-- Only one active experiment per prompt_key. Partial unique index
-- enforces this without blocking paused/completed history.
CREATE UNIQUE INDEX prompt_experiments_one_active_per_key
  ON gateway.prompt_experiments (prompt_key) WHERE status = 'active';
CREATE INDEX prompt_experiments_status_idx ON gateway.prompt_experiments (status, prompt_key);

ALTER TABLE gateway.prompt_experiments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON gateway.prompt_experiments TO service_role;

CREATE TRIGGER trg_gw_pe_updated_at BEFORE UPDATE ON gateway.prompt_experiments
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
