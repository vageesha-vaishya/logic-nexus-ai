-- Phase 6 Compliance — override flow with two-officer attestation.
--
-- Master plan §6.0 calls for an "override flow with double-audit".
-- The existing compliance.override_screening RPC already writes the
-- dual audit trail (compliance.audit_decisions + core.audit_log) so
-- the trail half is shipped. This slice adds the OTHER half — a
-- two-officer attestation requirement that prevents a single
-- compromised account from clearing a failed/flagged screening.
--
-- Design:
--   compliance.screenings gains `requires_co_sign boolean DEFAULT false`.
--   Set true for high-risk subject_types (e.g. logistics.booking on
--   sanctioned-country routes); leave false for low-risk routine flow
--   where the existing single-officer override is enough.
--
-- New flow when requires_co_sign=true:
--   1. Officer A calls attest_override → row in compliance.audit_decisions
--      with override_decision='override_requested'. Screening status
--      stays in failed/flagged so the gate stays closed.
--   2. Officer B (different uuid) calls attest_override → row with
--      override_decision='override_pass' + screening flips to overridden.
--   3. Same officer attempting both calls → SELF_ATTEST rejection.
--
-- Single-officer fast path preserved: when requires_co_sign=false,
-- attest_override delegates to override_screening (unchanged behavior).
-- This means existing callers continue to work without modification.

-- The existing audit_decisions CHECK constraint allows only
-- override_pass / override_fail / revoke_override. Two-officer flow
-- needs an additional value for the request row.
ALTER TABLE compliance.audit_decisions
  DROP CONSTRAINT IF EXISTS audit_decisions_override_decision_check;
ALTER TABLE compliance.audit_decisions
  ADD CONSTRAINT audit_decisions_override_decision_check
  CHECK (override_decision = ANY (ARRAY[
    'override_pass',
    'override_fail',
    'override_requested',
    'revoke_override'
  ]));

ALTER TABLE compliance.screenings
  ADD COLUMN IF NOT EXISTS requires_co_sign boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN compliance.screenings.requires_co_sign IS
  'Phase 6: when true, override requires two distinct officers — one to request, one to attest. When false (default), a single officer can override directly via override_screening.';

-- attest_override is the canonical entrypoint. Frontends should call
-- this regardless of requires_co_sign; the fn picks the right path.
CREATE OR REPLACE FUNCTION compliance.attest_override(
  p_screening_id    uuid,
  p_user_id         uuid,
  p_reason          text,
  p_evidence_file_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  screening_id  uuid,
  state         text,        -- 'pending_attestation' | 'attested' | 'overridden_single_officer'
  audit_decision_id uuid,
  prior_decision_id uuid     -- the request row when state='attested', else NULL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'compliance', 'core', 'public', 'pg_catalog'
AS $function$
DECLARE
  v_tenant_id          uuid;
  v_status             text;
  v_requires_co_sign   boolean;
  v_subject_type       text;
  v_subject_id         uuid;
  v_prior_request_id   uuid;
  v_prior_requester    uuid;
  v_new_audit_id       uuid;
  v_core_audit_log_id  bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'OVERRIDE_USER_REQUIRED: p_user_id is mandatory'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'OVERRIDE_REASON_REQUIRED: p_reason must be a non-empty string'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.tenant_id, s.status, s.requires_co_sign, s.subject_type, s.subject_id
  INTO v_tenant_id, v_status, v_requires_co_sign, v_subject_type, v_subject_id
  FROM compliance.screenings s
  WHERE s.id = p_screening_id
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'SCREENING_NOT_FOUND: no compliance.screenings row with id=%', p_screening_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_status NOT IN ('failed', 'flagged') THEN
    RAISE EXCEPTION 'SCREENING_NOT_OVERRIDABLE: screening % is in status=% (only failed/flagged can be overridden).',
      p_screening_id, v_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Single-officer fast path: delegate to the existing fn. This
  -- preserves the immediate-flip behavior + the audit trail it writes.
  IF v_requires_co_sign = false THEN
    SELECT a.audit_decision_id INTO v_new_audit_id
    FROM compliance.override_screening(p_screening_id, p_user_id, p_reason, p_evidence_file_ids) a;
    screening_id := p_screening_id;
    state := 'overridden_single_officer';
    audit_decision_id := v_new_audit_id;
    prior_decision_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Two-officer path. Look for an open request.
  SELECT ad.id, ad.decided_by_user_id
  INTO v_prior_request_id, v_prior_requester
  FROM compliance.audit_decisions ad
  WHERE ad.screening_id = p_screening_id
    AND ad.override_decision = 'override_requested'
  ORDER BY ad.decided_at DESC
  LIMIT 1;

  IF v_prior_request_id IS NULL THEN
    -- This call is the REQUEST. Record it; status stays in
    -- failed/flagged so the gate keeps blocking downstream actions.
    INSERT INTO compliance.audit_decisions (
      tenant_id, screening_id, previous_status, new_status,
      override_decision, reason, decided_by_user_id, evidence_file_ids,
      metadata
    )
    VALUES (
      v_tenant_id, p_screening_id, v_status, v_status,
      'override_requested', trim(p_reason), p_user_id, p_evidence_file_ids,
      jsonb_build_object('subject_type', v_subject_type, 'subject_id', v_subject_id)
    )
    RETURNING id INTO v_new_audit_id;

    INSERT INTO core.audit_log (
      tenant_id, actor_user_id, actor_kind, subject_type, subject_id,
      action, diff, metadata, retention_class
    )
    VALUES (
      v_tenant_id, p_user_id, 'user',
      'compliance.screening', p_screening_id,
      'compliance.screening.override_requested',
      jsonb_build_object('override_decision',
                         jsonb_build_object('from', NULL, 'to', 'override_requested')),
      jsonb_build_object(
        'reason',              trim(p_reason),
        'audit_decision_id',   v_new_audit_id,
        'evidence_file_count', COALESCE(array_length(p_evidence_file_ids, 1), 0)
      ),
      'compliance_7y'
    );

    screening_id := p_screening_id;
    state := 'pending_attestation';
    audit_decision_id := v_new_audit_id;
    prior_decision_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Open request exists. The attestor must differ from the requester.
  IF v_prior_requester = p_user_id THEN
    RAISE EXCEPTION 'SELF_ATTEST_FORBIDDEN: officer % requested this override and cannot also attest it. A different officer must approve.',
      p_user_id
      USING ERRCODE = 'P0001';
  END IF;

  -- This call is the ATTESTATION. Record the override_pass row + flip
  -- the screening + write the core.audit_log entry with the same shape
  -- as override_screening's single-officer trail (so downstream
  -- consumers see one canonical 'overridden' event).
  INSERT INTO compliance.audit_decisions (
    tenant_id, screening_id, previous_status, new_status,
    override_decision, reason, decided_by_user_id, evidence_file_ids,
    metadata
  )
  VALUES (
    v_tenant_id, p_screening_id, v_status, 'overridden',
    'override_pass', trim(p_reason), p_user_id, p_evidence_file_ids,
    jsonb_build_object(
      'subject_type',       v_subject_type,
      'subject_id',         v_subject_id,
      'co_signed_request',  v_prior_request_id,
      'co_signed_by',       v_prior_requester
    )
  )
  RETURNING id INTO v_new_audit_id;

  INSERT INTO core.audit_log (
    tenant_id, actor_user_id, actor_kind, subject_type, subject_id,
    action, diff, metadata, retention_class
  )
  VALUES (
    v_tenant_id, p_user_id, 'user',
    'compliance.screening', p_screening_id,
    'compliance.screening.overridden',
    jsonb_build_object(
      'status',   jsonb_build_object('from', v_status, 'to', 'overridden'),
      'decision', jsonb_build_object('from', 'fail',   'to', 'override_pass')
    ),
    jsonb_build_object(
      'reason',              trim(p_reason),
      'audit_decision_id',   v_new_audit_id,
      'evidence_file_count', COALESCE(array_length(p_evidence_file_ids, 1), 0),
      'subject_type',        v_subject_type,
      'subject_id',          v_subject_id,
      'co_signed_request',   v_prior_request_id,
      'co_signed_by',        v_prior_requester
    ),
    'compliance_7y'
  )
  RETURNING id INTO v_core_audit_log_id;

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
                              'co_signed_request',     v_prior_request_id,
                              'co_signed_by',          v_prior_requester,
                              'audit_decision_id',     v_new_audit_id,
                              'audit_log_id',          v_core_audit_log_id,
                              'previous_status',       v_status
                            )
  WHERE s.id = p_screening_id;

  screening_id := p_screening_id;
  state := 'attested';
  audit_decision_id := v_new_audit_id;
  prior_decision_id := v_prior_request_id;
  RETURN NEXT;
END;
$function$;

GRANT EXECUTE ON FUNCTION compliance.attest_override(uuid, uuid, text, uuid[])
  TO authenticated, service_role;

COMMENT ON FUNCTION compliance.attest_override(uuid, uuid, text, uuid[]) IS
  'Phase 6 Compliance: canonical override entrypoint. Picks single-officer fast-path (when screening.requires_co_sign=false) or two-officer request → attest flow. Same officer cannot do both calls.';
