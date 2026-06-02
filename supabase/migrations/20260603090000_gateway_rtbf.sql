-- LLM Gateway §9.5 — GDPR right-to-be-forgotten.
--
-- Audit-immutable rows in gateway.llm_invocations + gateway.outcomes stay
-- (no DELETE — preserves the audit trail's integrity). But their
-- PII-bearing columns get NULLed via a SECURITY DEFINER RPC that
-- transiently bypasses the append-only trigger using a session-local
-- GUC `gateway.allow_rtbf=on`. Per design §4.5 + §9.5.

-- ── 1. rtbf_log — one row per RTBF action.  Append-only.
CREATE TABLE gateway.rtbf_log (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL,
  subject_type                text NOT NULL,
  subject_id                  text NOT NULL,
  scrubbed_invocations_count  integer NOT NULL DEFAULT 0,
  scrubbed_outcomes_count     integer NOT NULL DEFAULT 0,
  actor_user_id               uuid,
  reason                      text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rtbf_log_subject_idx ON gateway.rtbf_log (tenant_id, subject_type, subject_id);
CREATE INDEX rtbf_log_created_idx ON gateway.rtbf_log (created_at DESC);

ALTER TABLE gateway.rtbf_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON gateway.rtbf_log TO service_role;
CREATE POLICY rtbf_log_tenant_select ON gateway.rtbf_log FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- ── 2. Extend the append-only triggers to honor `gateway.allow_rtbf=on`. ──
-- Allow UPDATE (only) when this session GUC is set. DELETE remains blocked.

CREATE OR REPLACE FUNCTION gateway.block_invocation_update_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('gateway.allow_rtbf', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'gateway.llm_invocations is append-only (operation=%)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE OR REPLACE FUNCTION gateway.block_outcome_update_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('gateway.allow_rtbf', true) = 'on' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'gateway.outcomes is append-only (operation=%)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

-- ── 3. scrub_subject_pii — the RPC the right-to-be-forgotten endpoint calls. ──
-- NULLs PII-bearing columns on every audit row referencing the subject,
-- writes an rtbf_log row, returns counts. Idempotent: a second call
-- with the same (tenant, subject) is a no-op (NULL'd columns stay NULL).
CREATE OR REPLACE FUNCTION gateway.scrub_subject_pii(
  p_tenant_id      uuid,
  p_subject_type   text,
  p_subject_id     text,
  p_actor_user_id  uuid DEFAULT NULL,
  p_reason         text DEFAULT NULL
)
RETURNS TABLE (
  scrubbed_invocations  integer,
  scrubbed_outcomes     integer,
  rtbf_log_id           uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, gateway
AS $$
DECLARE
  v_invocations int := 0;
  v_outcomes    int := 0;
  v_log_id      uuid;
BEGIN
  IF p_tenant_id IS NULL OR p_subject_type IS NULL OR p_subject_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id + subject_type + subject_id required';
  END IF;

  PERFORM set_config('gateway.allow_rtbf', 'on', true);
  BEGIN
    UPDATE gateway.llm_invocations
       SET subject_id              = NULL,
           subject_type            = NULL,
           variables_redacted_hash = NULL,
           response_hash           = NULL,
           warnings                = NULL
     WHERE tenant_id     = p_tenant_id
       AND subject_type  = p_subject_type
       AND subject_id    = p_subject_id;
    GET DIAGNOSTICS v_invocations = ROW_COUNT;

    -- Outcomes: scrub user_id + edited_output + notes; preserve kind +
    -- experiment context for analytics integrity (the variant choice
    -- itself isn't personally identifiable).
    -- subject_id is on outcomes only via the invocation join — but the
    -- user_id IS PII. If subject_kind='user' we also catch outcomes
    -- where user_id = p_subject_id::uuid.
    IF p_subject_type = 'user' THEN
      UPDATE gateway.outcomes
         SET user_id        = NULL,
             edited_output  = NULL,
             notes          = NULL
       WHERE tenant_id = p_tenant_id
         AND user_id = p_subject_id::uuid;
    ELSE
      -- party / other subject_type: scrub outcomes whose invocation was
      -- previously linked to this subject (those invocations now have
      -- subject_id=NULL, so we can't rejoin here; the caller-supplied
      -- subject is enough to find them via the prior_subject column we
      -- aren't tracking. For now, scrub-by-invocation is left to a
      -- follow-up slice that adds a subject column to outcomes).
      v_outcomes := 0;
    END IF;

    IF p_subject_type = 'user' THEN
      GET DIAGNOSTICS v_outcomes = ROW_COUNT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('gateway.allow_rtbf', 'off', true);
    RAISE;
  END;
  PERFORM set_config('gateway.allow_rtbf', 'off', true);

  INSERT INTO gateway.rtbf_log
    (tenant_id, subject_type, subject_id, scrubbed_invocations_count,
     scrubbed_outcomes_count, actor_user_id, reason)
  VALUES
    (p_tenant_id, p_subject_type, p_subject_id, v_invocations,
     v_outcomes, p_actor_user_id, p_reason)
  RETURNING id INTO v_log_id;

  RETURN QUERY SELECT v_invocations, v_outcomes, v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION gateway.scrub_subject_pii(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gateway.scrub_subject_pii(uuid, text, text, uuid, text) TO service_role;

COMMENT ON FUNCTION gateway.scrub_subject_pii IS
  'GDPR §17. NULLs PII columns on audit rows for a subject; preserves metadata. Idempotent. Uses gateway.allow_rtbf session GUC to bypass append-only triggers within the call.';
