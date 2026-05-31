-- Phase 6 Step 50 — compliance.v_screening_decisions drilldown view.
--
-- Completes the officer read-model trio:
--   compliance.v_blocked_parties        → "what needs review?" (inbox)
--   core.v_saga_state                   → "what happened to party X?"
--   compliance.v_screening_decisions    → "what's the decision chain
--                                          on screening Y?" ← this
--
-- One row per compliance.audit_decisions entry, chronologically
-- ordered (decided_at ASC for natural timeline reading). Self-
-- contained for the UI's per-screening drilldown panel: joins the
-- decision itself + the originating screening's current state +
-- evidence file count. Officer opens a screening row in the inbox,
-- this view powers the "decision history" tab without extra
-- queries.
--
-- The screening's CURRENT status is exposed alongside each
-- historical decision so the UI can render "you are here" markers
-- ('override' → status='overridden', 'revoke_override' → back to
-- the previous_status).
--
-- Tenant scoping: SECURITY INVOKER inherits RLS from compliance.
-- audit_decisions (tenant-scoped SELECT for authenticated per
-- migration 20260531001200). compliance.screenings shares the same
-- predicate, so the JOIN doesn't widen visibility.

CREATE OR REPLACE VIEW compliance.v_screening_decisions AS
SELECT
  ad.tenant_id,
  ad.screening_id,
  -- Current screening state for "you are here" rendering
  s.status            AS screening_current_status,
  s.subject_type      AS screening_subject_type,
  s.subject_id        AS screening_subject_id,
  -- The decision itself
  ad.id               AS audit_decision_id,
  ad.override_decision,
  ad.previous_status,
  ad.new_status,
  ad.reason,
  ad.decided_by_user_id,
  ad.decided_at,
  COALESCE(array_length(ad.evidence_file_ids, 1), 0) AS evidence_file_count,
  ad.evidence_file_ids,
  ad.metadata
FROM compliance.audit_decisions ad
JOIN compliance.screenings s ON s.id = ad.screening_id;

COMMENT ON VIEW compliance.v_screening_decisions IS
  'Phase 6 Step 50 — per-screening decision chain. One row per compliance.audit_decisions entry, joined to the originating screening''s current state. Caller filters by screening_id and ORDER BY decided_at ASC for a chronological timeline. SECURITY INVOKER — RLS on audit_decisions + screenings filters per-tenant.';

GRANT SELECT ON compliance.v_screening_decisions TO authenticated;
GRANT SELECT ON compliance.v_screening_decisions TO service_role;
