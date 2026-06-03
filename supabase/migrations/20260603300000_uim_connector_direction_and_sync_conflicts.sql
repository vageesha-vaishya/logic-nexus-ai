-- Phase 7 UIM Step 7.1 — connector.direction + sync_conflicts schema.
--
-- Applied to prod 2026-06-03; this file is the canonical migration
-- record committed alongside the MCP apply.

SET search_path = public;

BEGIN;

-- ── 1. connector.direction enum on uim.integrations + mirror ────────
-- Master plan §9.5: every connector config carries direction.
ALTER TABLE platform.integrations
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'bidirectional'
  CHECK (direction IN ('inbound','outbound','bidirectional'));
COMMENT ON COLUMN platform.integrations.direction IS
  'Phase 7 UIM Step 7.1: connector data-flow direction.';

ALTER TABLE uim.integrations
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'bidirectional'
  CHECK (direction IN ('inbound','outbound','bidirectional'));

-- ── 2. uim.sync_conflicts table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS uim.sync_conflicts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id      uuid        REFERENCES uim.integrations(id) ON DELETE SET NULL,
  subject_table       text        NOT NULL,
  subject_record_id   text        NOT NULL,
  conflict_kind       text        NOT NULL CHECK (conflict_kind IN
                                  ('field_mismatch','duplicate_key','foreign_key_missing',
                                   'unsupported_change','race_condition','schema_drift')),
  local_payload       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  remote_payload      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  diff_summary        text,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  resolution          text        CHECK (resolution IS NULL OR resolution IN
                                  ('accept_local','accept_remote','merge','manual','deferred')),
  resolved_by         uuid,
  resolution_notes    text,
  source_event_id     uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE uim.sync_conflicts IS
  'Phase 7 UIM Step 7.1: durable record of every sync conflict surfaced by a connector. Resolution drives the field-mapping + cutover decisions.';

CREATE INDEX IF NOT EXISTS idx_uim_sync_conflicts_tenant
  ON uim.sync_conflicts (tenant_id);

CREATE INDEX IF NOT EXISTS idx_uim_sync_conflicts_unresolved
  ON uim.sync_conflicts (tenant_id, detected_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_uim_sync_conflicts_subject
  ON uim.sync_conflicts (tenant_id, subject_table, subject_record_id);

ALTER TABLE uim.sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY uim_sync_conflicts_tenant_read ON uim.sync_conflicts
  FOR SELECT USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION uim.tg_touch_sync_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS uim_sync_conflicts_touch ON uim.sync_conflicts;
CREATE TRIGGER uim_sync_conflicts_touch
  BEFORE UPDATE ON uim.sync_conflicts
  FOR EACH ROW
  EXECUTE FUNCTION uim.tg_touch_sync_conflicts();

COMMIT;
