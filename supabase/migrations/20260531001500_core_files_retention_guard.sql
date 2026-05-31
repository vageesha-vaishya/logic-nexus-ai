-- Phase 6 Step 38 — core.files retention CHECK + delete-guard trigger.
--
-- Half of the compliance.md §10 evidence-retention acceptance item:
--
--   > Retention policy enforced on screening evidence files (7-year
--   > minimum).
--
-- The Step 34 override RPC accepts evidence_file_ids uuid[] but
-- nothing stops a user (or a buggy cleanup job) from DELETing those
-- files the next day. This migration locks down the file side; Step
-- 39 wires the trigger that auto-bumps an evidence file's retention
-- class to 'compliance_7y' whenever it's referenced from
-- compliance.audit_decisions.
--
-- Two pieces:
--   1. CHECK on retention_class so typos can't sneak in.
--      'general_30d' (default) | 'general_2y' | 'compliance_7y'.
--      core.files is empty in prod today (0 rows) so the CHECK is
--      additive — no data to retro-fit.
--   2. BEFORE DELETE OR UPDATE OF deleted_at trigger. Blocks the
--      removal when retention_class IN ('general_2y','compliance_7y')
--      AND the retention period hasn't elapsed. 'general_30d' is
--      explicitly NOT enforced — those are scratch uploads that
--      should be cleanable day-of.
--
-- The helper fn core.file_retention_expires_at lets observability +
-- the daily prune cron (future slice) share one source of truth for
-- "is this file still under retention?".
--
-- Cleanup escape hatch: the trigger watches DELETE and UPDATE OF
-- deleted_at specifically; UPDATE OF retention_class is allowed,
-- so an admin can downgrade a misfiled compliance_7y back to
-- general_30d before deletion (the audit trail of that downgrade
-- lives in core.audit_log — admin tooling responsibility, not
-- enforced here).

-- ══════════════════════════════════════════════════════════════════════
-- 1. retention_class CHECK
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE core.files
  DROP CONSTRAINT IF EXISTS files_retention_class_check;
ALTER TABLE core.files
  ADD CONSTRAINT files_retention_class_check
  CHECK (retention_class = ANY (ARRAY['general_30d','general_2y','compliance_7y']));

-- ══════════════════════════════════════════════════════════════════════
-- 2. expires_at helper
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.file_retention_expires_at(
  p_uploaded_at     timestamptz,
  p_retention_class text
) RETURNS timestamptz
LANGUAGE sql IMMUTABLE
SET search_path = core, pg_catalog
AS $$
  SELECT CASE p_retention_class
    WHEN 'general_30d'   THEN p_uploaded_at + interval '30 days'
    WHEN 'general_2y'    THEN p_uploaded_at + interval '2 years'
    WHEN 'compliance_7y' THEN p_uploaded_at + interval '7 years'
    ELSE p_uploaded_at + interval '30 days'  -- defensive fallback
  END;
$$;

COMMENT ON FUNCTION core.file_retention_expires_at(timestamptz, text) IS
  'Phase 6 Step 38 — single source of truth for "when can this file be removed?". Used by the delete-guard trigger and observability queries.';

REVOKE EXECUTE ON FUNCTION core.file_retention_expires_at(timestamptz, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION core.file_retention_expires_at(timestamptz, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION core.file_retention_expires_at(timestamptz, text) TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Delete-guard trigger
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.enforce_file_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_target_class text;
  v_uploaded_at  timestamptz;
  v_expires_at   timestamptz;
BEGIN
  -- Watch DELETE always; for UPDATE only when deleted_at flips
  -- from NULL → not-null (the soft-delete transition).
  IF TG_OP = 'UPDATE'
     AND (NEW.deleted_at IS NULL OR OLD.deleted_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  v_target_class := OLD.retention_class;
  v_uploaded_at  := OLD.uploaded_at;
  v_expires_at   := core.file_retention_expires_at(v_uploaded_at, v_target_class);

  -- general_30d is not enforced — scratch uploads can be deleted
  -- day-of without ceremony.
  IF v_target_class NOT IN ('general_2y', 'compliance_7y') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF v_expires_at > now() THEN
    RAISE EXCEPTION
      'FILE_RETENTION_NOT_MET: file % (retention_class=%) cannot be removed before %; uploaded_at=%, now=%.',
      OLD.id, v_target_class, v_expires_at, v_uploaded_at, now()
      USING ERRCODE = 'P0001',
            HINT = 'Retention class can be downgraded by an admin before deletion if the file was misclassified — that change leaves an audit trail in core.audit_log.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

COMMENT ON FUNCTION core.enforce_file_retention() IS
  'Phase 6 Step 38 — BEFORE DELETE OR UPDATE OF deleted_at on core.files. RAISES P0001 FILE_RETENTION_NOT_MET if retention period hasn''t elapsed for non-general_30d classes.';

DROP TRIGGER IF EXISTS trg_files_enforce_retention ON core.files;
CREATE TRIGGER trg_files_enforce_retention
  BEFORE DELETE OR UPDATE OF deleted_at ON core.files
  FOR EACH ROW EXECUTE FUNCTION core.enforce_file_retention();
