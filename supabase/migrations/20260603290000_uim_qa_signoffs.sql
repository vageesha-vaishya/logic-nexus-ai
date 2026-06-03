-- Phase 7 UIM Step 4b.15 follow-up — DB-backed QA signoff persistence.
--
-- The 4b.15 in-memory store didn't survive process restarts. This
-- migration adds uim.qa_signoffs as the persistence target;
-- services/uim-api/src/services/qa-signoff-store.ts is rewritten to
-- read/write here instead of the in-process Map.
--
-- Append-only: the legacy createUimQaSignoffRecord() inserts a new
-- row each call (revocation is a new row with signoff_status='revoked',
-- not an UPDATE), so no touch trigger needed.

SET search_path = public;

BEGIN;

CREATE TABLE IF NOT EXISTS uim.qa_signoffs (
  signoff_id                 text        PRIMARY KEY,
  tenant_id                  uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id               uuid,
  signoff_status             text        NOT NULL CHECK (signoff_status IN ('signed_off','revoked')),
  signed_off_by              text        NOT NULL,
  signed_off_role            text        NOT NULL,
  signed_off_at              text        NOT NULL,
  reconciliation_verified    boolean     NOT NULL DEFAULT false,
  latency_target_met         boolean     NOT NULL DEFAULT false,
  data_dictionary_published  boolean     NOT NULL DEFAULT false,
  bi_cube_deployed           boolean     NOT NULL DEFAULT false,
  notes                      text        NOT NULL DEFAULT '',
  created_at                 timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE uim.qa_signoffs IS
  'Phase 7 UIM Step 4b.15 follow-up: persistence for the QA signoff append-only store. Append-only (no UPDATE); revocation is a new signoff_status=''revoked'' row.';

CREATE INDEX IF NOT EXISTS idx_uim_qa_signoffs_scope
  ON uim.qa_signoffs (tenant_id, franchise_id, signed_off_at DESC);

ALTER TABLE uim.qa_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY uim_qa_signoffs_tenant_read ON uim.qa_signoffs
  FOR SELECT USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

COMMIT;
