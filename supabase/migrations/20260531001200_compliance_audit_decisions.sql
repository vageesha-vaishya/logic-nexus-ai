-- Phase 6 Step 33 — compliance.audit_decisions table.
--
-- compliance.md §10 acceptance: "override flow writes to both
-- compliance.audit_decisions AND core.audit_log". This migration
-- creates the table; Step 34 wires the override RPC that writes
-- both side-by-side.
--
-- Why a dedicated table when core.audit_log already exists:
-- compliance overrides need a queryable, indexed record of every
-- decision change against a screening — the compliance-officer UI
-- renders "decision history" for a given screening, and SEC/GST
-- auditors ask "show me every override in the last quarter, who
-- approved, what was the reason, what evidence was attached".
-- core.audit_log is the cross-platform append-only stream; this
-- table is the compliance-domain query surface for that subset.
--
-- evidence_file_ids carries uuids of core.files rows the officer
-- attached when making the override decision (KYC document, board
-- resolution, sanctions counsel email). The 7-year retention rule
-- on screening evidence flows through here.
--
-- override_decision values:
--   'override_pass'    — failed/flagged screening manually cleared
--   'override_fail'    — passed/flagged screening manually marked failed
--   'revoke_override'  — undo a previous override (re-apply original)
-- Phase 6 ships override_pass + revoke_override only via the rpc;
-- override_fail is reserved for a later "compliance officer escalates
-- a quotation" flow that isn't in scope yet.

CREATE TABLE IF NOT EXISTS compliance.audit_decisions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  screening_id        uuid NOT NULL REFERENCES compliance.screenings(id) ON DELETE RESTRICT,
  previous_status     text NOT NULL,
  new_status          text NOT NULL,
  override_decision   text NOT NULL
                      CHECK (override_decision IN ('override_pass','override_fail','revoke_override')),
  reason              text NOT NULL,
  decided_by_user_id  uuid NOT NULL,
  decided_at          timestamptz NOT NULL DEFAULT now(),
  evidence_file_ids   uuid[],
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- Reason is mandatory + non-trivial — empty/whitespace = audit fraud.
  CONSTRAINT audit_decisions_reason_not_blank CHECK (length(trim(reason)) > 0)
);

COMMENT ON TABLE compliance.audit_decisions IS
  'Phase 6 Step 33 — every override or manual decision change against a compliance.screenings row. Paired with a core.audit_log entry written in the same txn by compliance.override_screening (Step 34). 7-year retention per compliance.md §9.5.';
COMMENT ON COLUMN compliance.audit_decisions.evidence_file_ids IS
  'uuids of core.files rows the officer attached as evidence (KYC docs, sanctions counsel email, board resolution). Retention class on those files is enforced via core.files.retention_class.';

-- Hot-path query: "show me decision history for this screening" — the
-- compliance-officer UI's per-screening drill-down.
CREATE INDEX audit_decisions_screening_idx
  ON compliance.audit_decisions (screening_id, decided_at DESC);

-- Cross-tenant "all overrides this month" auditor query.
CREATE INDEX audit_decisions_tenant_decided_idx
  ON compliance.audit_decisions (tenant_id, decided_at DESC);

ALTER TABLE compliance.audit_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_decisions_tenant_select ON compliance.audit_decisions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_compliance_audit_decisions_updated_at
  BEFORE UPDATE ON compliance.audit_decisions
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT ON compliance.audit_decisions TO authenticated;
GRANT ALL    ON compliance.audit_decisions TO service_role;
