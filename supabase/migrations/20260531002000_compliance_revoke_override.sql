-- Phase 6 Step 45 — compliance.revoke_override RPC.
--
-- Completes the override_decision enum we shipped in Step 33. The
-- CHECK on compliance.audit_decisions already permits
-- 'revoke_override' but no RPC writes it. This fn is the inverse of
-- compliance.override_screening (Step 34):
--
--   officer made a mistake clearing → re-block the customer.
--
-- State machine:
--   pending     ──screen_subject──→ passed | flagged | failed
--   failed|flagged ──override_screening──→ overridden
--   overridden  ──revoke_override──→ previous_status (failed|flagged)
--
-- Only 'overridden' can be revoked; anything else raises
-- SCREENING_NOT_REVOKABLE (compare-and-set, never silent).
--
-- previous_status comes from screening.metadata.previous_status,
-- which Step 34's override_screening stored exactly for this case.
-- If somehow missing (manual writes outside the RPC), default to
-- 'failed' as the safest re-block.
--
-- expires_at is reset to now() + 90d — treats revoke as a fresh
-- screening decision for retention purposes. The original pre-
-- override expires_at wasn't preserved (would need a column we
-- didn't add); restarting the timer is the simpler + safer default.
--
-- Audit: writes both compliance.audit_decisions + core.audit_log in
-- the same txn, same pattern as override_screening. metadata links
-- back to the original override audit_decision_id for full chain.

CREATE OR REPLACE FUNCTION compliance.revoke_override(
  p_screening_id uuid,
  p_user_id      uuid,
  p_reason       text
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
  v_tenant_id              uuid;
  v_current_status         text;
  v_target_status          text;
  v_subject_type           text;
  v_subject_id             uuid;
  v_original_override_id   uuid;
  v_screening_metadata     jsonb;
  v_audit_id               uuid;
  v_audit_log_id           bigint;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'REVOKE_USER_REQUIRED: p_user_id is mandatory — the audit chain needs a non-null actor.'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'REVOKE_REASON_REQUIRED: p_reason must be a non-empty string — auditors need to know why.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT s.tenant_id, s.status, s.subject_type, s.subject_id, s.metadata
  INTO v_tenant_id, v_current_status, v_subject_type, v_subject_id, v_screening_metadata
  FROM compliance.screenings s
  WHERE s.id = p_screening_id
  FOR UPDATE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'SCREENING_NOT_FOUND: no compliance.screenings row with id=%', p_screening_id
      USING ERRCODE = 'P0001';
  END IF;

  IF v_current_status <> 'overridden' THEN
    RAISE EXCEPTION 'SCREENING_NOT_REVOKABLE: screening % is in status=% (only overridden can be revoked). Use override_screening to clear a failed/flagged screening.',
      p_screening_id, v_current_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Restore to the pre-override status; default 'failed' if metadata
  -- was tampered with or somehow missing. previous_status is stored
  -- by override_screening at line ~85 of its UPDATE.
  v_target_status        := COALESCE(v_screening_metadata->>'previous_status', 'failed');
  v_original_override_id := (v_screening_metadata->>'audit_decision_id')::uuid;

  -- 1. audit_decisions row
  INSERT INTO compliance.audit_decisions (
    tenant_id, screening_id, previous_status, new_status,
    override_decision, reason, decided_by_user_id,
    metadata
  )
  VALUES (
    v_tenant_id, p_screening_id, 'overridden', v_target_status,
    'revoke_override', trim(p_reason), p_user_id,
    jsonb_build_object(
      'subject_type',           v_subject_type,
      'subject_id',             v_subject_id,
      'original_override_id',   v_original_override_id
    )
  )
  RETURNING id INTO v_audit_id;

  -- 2. core.audit_log row
  INSERT INTO core.audit_log (
    tenant_id, actor_user_id, actor_kind, subject_type, subject_id,
    action, diff, metadata, retention_class
  )
  VALUES (
    v_tenant_id, p_user_id, 'user',
    'compliance.screening', p_screening_id,
    'compliance.screening.override_revoked',
    jsonb_build_object(
      'status',   jsonb_build_object('from', 'overridden',    'to', v_target_status),
      'decision', jsonb_build_object('from', 'override_pass', 'to', NULL)
    ),
    jsonb_build_object(
      'reason',                trim(p_reason),
      'audit_decision_id',     v_audit_id,
      'original_override_id',  v_original_override_id,
      'subject_type',          v_subject_type,
      'subject_id',            v_subject_id
    ),
    'compliance_7y'
  )
  RETURNING id INTO v_audit_log_id;

  -- 3. Restore the screening row. expires_at = now() + 90d (fresh
  -- retention timer, matching screen_subject's default). decision
  -- reset to NULL (the prior decision was 'override_pass' which is
  -- now superseded; a fresh decision would be set by re-screening).
  UPDATE compliance.screenings s
  SET status              = v_target_status,
      decision            = NULL,
      decided_by_user_id  = p_user_id,
      decided_at          = now(),
      decision_notes      = trim(p_reason),
      expires_at          = now() + interval '90 days',
      metadata            = s.metadata || jsonb_build_object(
                              'override_revoked_at',         now(),
                              'override_revoked_by_user_id', p_user_id,
                              'revoke_audit_decision_id',    v_audit_id,
                              'revoke_audit_log_id',         v_audit_log_id
                            )
  WHERE s.id = p_screening_id;

  RETURN QUERY
    SELECT p_screening_id, 'overridden'::text, v_target_status, v_audit_id;
END;
$$;

COMMENT ON FUNCTION compliance.revoke_override(uuid, uuid, text) IS
  'Phase 6 Step 45 — inverse of compliance.override_screening. Flips an overridden screening back to its previous_status (failed/flagged), with a fresh 90d expires_at. Writes audit_decisions (override_decision=revoke_override) + core.audit_log (action=compliance.screening.override_revoked) in one txn.';

GRANT EXECUTE ON FUNCTION compliance.revoke_override(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION compliance.revoke_override(uuid, uuid, text) TO service_role;
