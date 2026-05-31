-- Phase 6 Step 39 — auto-bump file retention on audit_decisions evidence.
--
-- Other half of compliance.md §10 evidence-retention acceptance.
-- Step 38 made compliance_7y enforceable; this trigger makes it
-- automatic.
--
-- AFTER INSERT OR UPDATE OF evidence_file_ids on compliance.
-- audit_decisions. For every uuid in NEW.evidence_file_ids[], bump
-- the matching core.files.retention_class to 'compliance_7y' if it
-- isn't already at or above that class. We never DOWNGRADE — a
-- file already at 'compliance_7y' (e.g. via a prior override) stays
-- there; a future retention class with longer retention (if/when
-- added) would also not be touched here.
--
-- SECURITY DEFINER so the trigger can UPDATE core.files regardless
-- of the calling user's RLS — the audit_decisions write came from
-- compliance.override_screening (or a future revoke_override / manual
-- decision recorder) which already enforced authorization at the
-- RPC layer; the file bump is the consequence, not a separate
-- decision.
--
-- Idempotency: re-firing on UPDATE OF evidence_file_ids with the
-- same array is a no-op (the WHERE retention_class <> 'compliance_7y'
-- filter makes the second UPDATE match zero rows). Appending new
-- file ids picks up only the new ones.

CREATE OR REPLACE FUNCTION compliance.bump_evidence_file_retention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = compliance, core, pg_catalog
AS $$
DECLARE
  v_bumped_count integer;
BEGIN
  IF NEW.evidence_file_ids IS NULL
     OR array_length(NEW.evidence_file_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  WITH bumped AS (
    UPDATE core.files f
    SET retention_class = 'compliance_7y'
    WHERE f.id = ANY (NEW.evidence_file_ids)
      AND f.retention_class <> 'compliance_7y'
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_bumped_count FROM bumped;

  -- No RAISE — the consumer (override_screening RPC) doesn't care
  -- about the bump count; the audit_decisions row itself is the
  -- audit. Surface via pg log for observability.
  IF v_bumped_count > 0 THEN
    RAISE NOTICE 'bump_evidence_file_retention: bumped % file(s) to compliance_7y for audit_decision=%',
      v_bumped_count, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION compliance.bump_evidence_file_retention() IS
  'Phase 6 Step 39 — when a compliance.audit_decisions row carries evidence_file_ids, bump those files'' core.files.retention_class to compliance_7y so the Step 38 delete-guard blocks premature removal.';

DROP TRIGGER IF EXISTS trg_audit_decisions_bump_evidence_retention
  ON compliance.audit_decisions;
CREATE TRIGGER trg_audit_decisions_bump_evidence_retention
  AFTER INSERT OR UPDATE OF evidence_file_ids ON compliance.audit_decisions
  FOR EACH ROW EXECUTE FUNCTION compliance.bump_evidence_file_retention();
