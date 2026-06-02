-- Phase 6 Compliance Step 3 — gate_check SQL function.
--
-- Per master plan §5.7 (compliance gating flow). Initiating modules
-- (quotation, logistics, finance) call this before committing a send /
-- create / release state transition so they can refuse to commit when
-- the latest screening for the subject is failed or flagged-without-
-- override.
--
-- Returns one of:
--   'pass'             — most recent screening passed (or override active)
--   'flagged'          — most recent screening flagged with no override
--   'failed'           — most recent screening failed with no override
--   'no_screening_yet' — no screening row exists for this subject
--
-- An active override (compliance.screenings.decision='overridden' +
-- decided_at IS NOT NULL + expires_at IS NULL or > now) downgrades a
-- failed/flagged verdict to 'pass'. The two-phase override flow lives
-- in the compliance-api override + revoke RPCs.
--
-- Idempotent + read-only — safe to call from triggers and HTTP routes.

CREATE OR REPLACE FUNCTION compliance.gate_check(
  p_tenant_id    uuid,
  p_subject_type text,
  p_subject_id   uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = compliance, public
AS $$
DECLARE
  v_screening compliance.screenings%ROWTYPE;
  v_now       timestamptz := now();
BEGIN
  IF p_tenant_id IS NULL OR p_subject_type IS NULL OR p_subject_id IS NULL THEN
    RAISE EXCEPTION 'gate_check: tenant_id + subject_type + subject_id all required';
  END IF;

  -- Latest screening for the subject. We deliberately pick the most-
  -- recent (performed_at DESC) so an override that follows a failure
  -- supersedes the failure.
  SELECT *
    INTO v_screening
    FROM compliance.screenings
   WHERE tenant_id    = p_tenant_id
     AND subject_type = p_subject_type
     AND subject_id   = p_subject_id
   ORDER BY performed_at DESC NULLS LAST, created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'no_screening_yet';
  END IF;

  -- Override path: any prior failed/flagged is masked once an officer
  -- decides 'overridden' on a screening whose expires_at is null or in
  -- the future. The override-row IS the latest screening (decided_at
  -- is set in the row we just fetched).
  IF v_screening.decision = 'overridden'
     AND v_screening.decided_at IS NOT NULL
     AND (v_screening.expires_at IS NULL OR v_screening.expires_at > v_now)
  THEN
    RETURN 'pass';
  END IF;

  -- Plain status mapping.
  RETURN CASE v_screening.status
    WHEN 'passed'  THEN 'pass'
    WHEN 'flagged' THEN 'flagged'
    WHEN 'failed'  THEN 'failed'
    -- pending / under_review / cancelled / null all read as no-yet
    -- so the caller can decide whether to wait or proceed.
    ELSE 'no_screening_yet'
  END;
END;
$$;

COMMENT ON FUNCTION compliance.gate_check(uuid, text, uuid) IS
  'Phase 6 Compliance Step 3: returns the gate verdict for the latest screening on a subject. Used by initiating modules before committing send/create/release state transitions.';

GRANT EXECUTE ON FUNCTION compliance.gate_check(uuid, text, uuid) TO authenticated, service_role;
