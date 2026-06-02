-- LLM Gateway P3.4 — outcome capture + experiment context on audit log.
-- Per design §6.6 + §5.6.

-- ── 1. Extend gateway.llm_invocations with proper experiment columns. ──
-- The P3.3 slice carried experiment context only in `warnings` text[],
-- which is fine for human eyes but awkward for joins. Promote to first-class.
ALTER TABLE gateway.llm_invocations
  ADD COLUMN IF NOT EXISTS experiment_id        uuid,
  ADD COLUMN IF NOT EXISTS variant_label        text,
  ADD COLUMN IF NOT EXISTS prompt_version_id    uuid;

ALTER TABLE gateway.llm_invocations
  ADD CONSTRAINT variant_label_known
    CHECK (variant_label IS NULL OR variant_label IN ('a', 'b'));

CREATE INDEX IF NOT EXISTS llm_invocations_experiment_idx
  ON gateway.llm_invocations (experiment_id, variant_label) WHERE experiment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS llm_invocations_prompt_version_idx
  ON gateway.llm_invocations (prompt_version_id) WHERE prompt_version_id IS NOT NULL;

-- ── 2. gateway.outcomes — one row per recordOutcome call. ──
CREATE TABLE gateway.outcomes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_id       uuid NOT NULL,                  -- gateway.llm_invocations.id; no FK because
                                                       -- that table is append-only and we don't want
                                                       -- a foreign-key drag on inserts there
  tenant_id           uuid NOT NULL,
  prompt_key          text,                            -- denormalized for fast tenant filters
  prompt_version_id   uuid,                            -- which version served the call
  experiment_id       uuid,                            -- nullable: present when an experiment was active
  variant_label       text CHECK (variant_label IS NULL OR variant_label IN ('a','b')),
  kind                text NOT NULL CHECK (kind IN
                        ('accepted','accepted_after_edit','rejected','overridden','ignored')),
  user_id             uuid,                            -- the human who recorded the outcome
  edited_output       jsonb,                           -- present for accepted_after_edit + overridden
  notes               text,
  source              text NOT NULL DEFAULT 'sdk'
                        CHECK (source IN ('sdk','admin_ui','cron','test')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outcomes_invocation_idx ON gateway.outcomes (invocation_id);
CREATE INDEX outcomes_experiment_kind_idx
  ON gateway.outcomes (experiment_id, kind) WHERE experiment_id IS NOT NULL;
CREATE INDEX outcomes_tenant_created_idx ON gateway.outcomes (tenant_id, created_at DESC);

ALTER TABLE gateway.outcomes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON gateway.outcomes TO service_role;

-- Tenant admins see their own outcomes only.
CREATE POLICY outcomes_tenant_select
  ON gateway.outcomes FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- ── 3. Append-only guard on outcomes too. ──
-- Same pattern as gateway.llm_invocations: outcomes are an audit trail,
-- so UPDATE + DELETE are blocked. Right-to-be-forgotten goes through
-- a SECURITY DEFINER RPC that NULLs PII columns; metadata is preserved.
CREATE OR REPLACE FUNCTION gateway.block_outcome_update_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'gateway.outcomes is append-only (operation=%)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER trg_block_outcome_update_delete
  BEFORE UPDATE OR DELETE ON gateway.outcomes
  FOR EACH ROW EXECUTE FUNCTION gateway.block_outcome_update_delete();
