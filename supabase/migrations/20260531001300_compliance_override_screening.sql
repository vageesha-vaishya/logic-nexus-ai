-- Phase 6 Step 34 — compliance.override_screening RPC.
--
-- Closes the compliance.md §10 acceptance criterion: a compliance
-- officer can mark a failed (or flagged) screening as cleared, and
-- the override:
--   1. updates the screening row (status='overridden', decision=
--      'override_pass', decided_by_user_id, decided_at, expires_at=NULL)
--   2. writes a compliance.audit_decisions row capturing the
--      previous_status, new_status, reason, and evidence file ids
--   3. writes a core.audit_log row in the SAME txn so the
--      cross-platform audit stream and the domain table stay
--      consistent
--   4. naturally unblocks compliance.is_party_blocked (which filters
--      status='failed' only — 'overridden' is excluded)
--
-- After override the next quote.sent for that customer succeeds: the
-- BEFORE-UPDATE gate in Step 23 calls is_party_blocked which returns
-- false; the quote transitions normally and Step 5's AFTER-UPDATE
-- emit trigger fires the customer notification.
--
-- Idempotency: only screenings with status IN ('failed','flagged')
-- can be overridden. Re-calling on an already-overridden screening
-- RAISEs SCREENING_NOT_OVERRIDABLE so duplicate operations are
-- explicitly surfaced (compare-and-set semantics; never silent).
--
-- Authorization: SECURITY DEFINER + EXECUTE granted to authenticated.
-- The caller's role should enforce who can override (the master plan
-- §6 role layer — compliance_officer / platform_admin). At the SQL
-- level there's no role check — this is policy, not data integrity.
-- Officer UI gates the button; the RPC trusts the caller.

CREATE OR REPLACE FUNCTION compliance.override_screening(
  p_screening_id      uuid,
  p_user_id           uuid,
  p_reason            text,
  p_evidence_file_ids uuid[] DEFAULT NULL
) RETURNS TABLE (
  screening_id       uuid,
  old_status         text,
  new_status         text,
  audit_decision_id  uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = compliance, core, public, pg_catalog
AS $$
DECLARE
  v_tenant_id    uuid;
  v_old_status   text;
  v_subject_type text;
  v_subject_id   uuid;
  v_audit_id     uuid;
  v_audit_log_id bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'OVERRIDE_USER_REQUIRED: p_user_id is mandatory — the audit chain needs a non-null actor.'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED: p_reason must be a non-empty string — auditors need to know why.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Load current state. Lock the row so a concurrent override can't
  -- race us into a double-write.
  SELECT s.tenant_id, s.status, s.subject_type, s.subject_id
  INTO v_tenant_id, v_old_status, v_subject_type, v_subject_id
  FROM compliance.screenings s
  WHERE s.id = p_screening_id
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'SCREENING_NOT_FOUND: no compliance.screenings row with id=%', p_screening_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_old_status NOT IN ('failed', 'flagged') THEN
    RAISE EXCEPTION 'SCREENING_NOT_OVERRIDABLE: screening % is in status=% (only failed/flagged can be overridden). Use revoke_override if you intend to undo a prior override.',
      p_screening_id, v_old_status
      USING ERRCODE = 'P0001';
  END IF;

  -- 1. audit_decisions row (domain query surface)
  INSERT INTO compliance.audit_decisions (
    tenant_id, screening_id, previous_status, new_status,
    override_decision, reason, decided_by_user_id, evidence_file_ids,
    metadata
  )
  VALUES (
    v_tenant_id, p_screening_id, v_old_status, 'overridden',
    'override_pass', trim(p_reason), p_user_id, p_evidence_file_ids,
    jsonb_build_object('subject_type', v_subject_type, 'subject_id', v_subject_id)
  )
  RETURNING id INTO v_audit_id;

  -- 2. core.audit_log row (cross-platform append-only stream)
  INSERT INTO core.audit_log (
    tenant_id, actor_user_id, actor_kind, subject_type, subject_id,
    action, diff, metadata, retention_class
  )
  VALUES (
    v_tenant_id, p_user_id, 'user',
    'compliance.screening', p_screening_id,
    'compliance.screening.overridden',
    jsonb_build_object(
      'status',   jsonb_build_object('from', v_old_status, 'to', 'overridden'),
      'decision', jsonb_build_object('from', 'fail',      'to', 'override_pass')
    ),
    jsonb_build_object(
      'reason',              trim(p_reason),
      'audit_decision_id',   v_audit_id,
      'evidence_file_count', COALESCE(array_length(p_evidence_file_ids, 1), 0),
      'subject_type',        v_subject_type,
      'subject_id',          v_subject_id
    ),
    -- compliance.md §9.5: 7-year retention for screening evidence.
    -- core.audit_log has no CHECK on retention_class — string value
    -- documents intent; the retention enforcer keys off it.
    'compliance_7y'
  )
  RETURNING id INTO v_audit_log_id;

  -- 3. Update the screening row. expires_at=NULL — overrides are
  -- permanent (until manually revoked); no time-out re-block.
  UPDATE compliance.screenings s
  SET status              = 'overridden',
      decision            = 'override_pass',
      decided_by_user_id  = p_user_id,
      decided_at          = now(),
      decision_notes      = trim(p_reason),
      evidence_file_ids   = COALESCE(p_evidence_file_ids, s.evidence_file_ids),
      expires_at          = NULL,
      metadata            = s.metadata || jsonb_build_object(
                              'overridden_at',         now(),
                              'overridden_by_user_id', p_user_id,
                              'audit_decision_id',     v_audit_id,
                              'audit_log_id',          v_audit_log_id,
                              'previous_status',       v_old_status
                            )
  WHERE s.id = p_screening_id;

  RETURN QUERY
    SELECT p_screening_id, v_old_status, 'overridden'::text, v_audit_id;
END;
$$;

COMMENT ON FUNCTION compliance.override_screening(uuid, uuid, text, uuid[]) IS
  'Phase 6 Step 34 — compliance officer clears a failed/flagged screening. Writes compliance.audit_decisions + core.audit_log in the same txn; flips screening status to overridden so is_party_blocked returns false and quote.sent unblocks. Compare-and-set: re-call on already-overridden screening raises SCREENING_NOT_OVERRIDABLE.';

-- EXECUTE granted to authenticated — the officer UI calls this
-- directly via PostgREST. Role-level "who can override" is enforced
-- by the application gate on the button, not by the RPC.
GRANT EXECUTE ON FUNCTION compliance.override_screening(uuid, uuid, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION compliance.override_screening(uuid, uuid, text, uuid[]) TO service_role;
