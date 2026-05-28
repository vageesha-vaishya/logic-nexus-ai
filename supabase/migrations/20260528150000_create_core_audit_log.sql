-- Phase 1 Slice B — core.audit_log (partitioned, polymorphic, append-only)
-- Per master design doc §3.5 + core.md §3.5 + master §7.4 Phase 1
--
-- The single unified audit table for the entire platform. Replaces the 17
-- fragmented audit tables identified in master §1B.8(1):
--
--   platform.audit_log              ← canonical source; shape inspires this one
--   mro_audit.records, .trails      ← amro audit pair
--   public.audit_log, .audit_logs   ← legacy duplicates
--   public.admin_override_audit
--   public.ai_audit_logs
--   public.amro_stock_audit_timeline
--   public.amro_work_order_audit_log
--   public.domain_audit_log
--   public.email_audit_log
--   public.engine_seed_audit_runs
--   public.mapping_audit_logs
--   public.mgl_quotation_audit_logs
--   public.quotation_audit_log
--   public.quotation_version_audit_logs
--   public.quote_audits
--   public.uim_amro_sync_audit
--
-- Migration strategy (per master §7.2 no-break rule #1):
--   Phase 1 NOW: create core.audit_log + helper + the table-level RLS
--   Phase 1 next: one trigger-shadow-write migration PER source table
--                 (16 follow-up migrations; each isolated, low risk)
--   Phase 6+: cut over each module's writes from source table to core.audit_log
--   Phase 11: drop all 17 source tables after 30-day no-direct-read window
--
-- Reproduces master §3.5 schema with the polymorphic schema.entity subject
-- convention from master §2.4.

CREATE TABLE core.audit_log (
  id                  bigserial,
  tenant_id           uuid                NOT NULL,
  occurred_at         timestamptz         NOT NULL DEFAULT now(),

  -- Who did this. NULL for system-emitted events (cron jobs, triggers,
  -- background processors). actor_kind disambiguates.
  actor_user_id       uuid,
  actor_kind          text                NOT NULL DEFAULT 'user'
                      CHECK (actor_kind IN ('user','service','integration','system','trigger')),

  -- WHAT entity is this audit about. subject_type follows master §2.4
  -- convention: schema-qualified, singular, lowercase. Examples:
  --   'core.party', 'sales.lead', 'sales.opportunity', 'quotation.quote',
  --   'logistics.shipment', 'finance.invoice', 'compliance.screening',
  --   'comms.suppression', 'amro.work_order', 'amro.aircraft', 'uim.item'
  subject_type        text                NOT NULL,
  subject_id          uuid                NOT NULL,

  -- What happened. Verb in past tense for consistency with event_type
  -- convention. Examples: 'created', 'updated', 'deleted', 'status_changed',
  -- 'approved', 'rejected', 'unsubscribed', 'merged', 'soft_deleted'.
  action              text                NOT NULL,

  -- Diff blob. {before:..., after:...} for UPDATE; {after:...} for INSERT;
  -- {before:...} for DELETE; arbitrary shape otherwise.
  diff                jsonb,

  -- Per-event context. {ip, user_agent, request_id, correlation_id, ...}.
  -- correlation_id propagates from the originating saga per master §5.9.
  metadata            jsonb               NOT NULL DEFAULT '{}',

  -- Per-source-table reference. When a row is shadow-written from a legacy
  -- audit table, store the source row's PK so we can reconcile. Once the
  -- source table is dropped, this field becomes historical.
  shadow_source_table text,
  shadow_source_id    text,                                          -- text not uuid because some legacy PKs are bigint

  -- For regulatory retention overrides (master §8.6.5). Examples:
  --   'compliance_evidence_7y', 'finance_invoice_7y', 'general_2y'
  retention_class     text                NOT NULL DEFAULT 'general_2y',

  PRIMARY KEY (tenant_id, occurred_at, id)
) PARTITION BY RANGE (occurred_at);

COMMENT ON TABLE core.audit_log IS
  'Unified platform-wide audit log. Replaces 17 fragmented audit tables identified in master §1B.8(1). Polymorphic via subject_type per master §2.4. Partitioned monthly. APPEND-ONLY — no UPDATE/DELETE allowed except by retention-policy admin tooling. Master §3.5 + core.md §3.5.';

COMMENT ON COLUMN core.audit_log.subject_type IS
  'Schema-qualified entity per master §2.4: ''sales.lead'', ''quotation.quote'', ''amro.work_order'', etc.';

COMMENT ON COLUMN core.audit_log.diff IS
  'Change diff. {before, after} for updates; {after} for inserts; {before} for deletes; arbitrary for other actions.';

COMMENT ON COLUMN core.audit_log.shadow_source_table IS
  'When this row was shadow-written from a legacy audit table, names that source (e.g. ''platform.audit_log''). NULL for native core.audit_log writes.';

-- Monthly partitions. Cover backfill window (May 2026 onward) + buffer.
-- A roll-over job (separate migration) creates new partitions on schedule.
CREATE TABLE core.audit_log_y2026m05 PARTITION OF core.audit_log
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE core.audit_log_y2026m06 PARTITION OF core.audit_log
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE core.audit_log_y2026m07 PARTITION OF core.audit_log
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE core.audit_log_y2026m08 PARTITION OF core.audit_log
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE core.audit_log_y2026m09 PARTITION OF core.audit_log
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE core.audit_log_y2026m10 PARTITION OF core.audit_log
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

-- ── Indexes (per master §3.5 audit query patterns) ─────────────────────────

-- Per-subject browse: "show me everything that happened to lead X"
CREATE INDEX audit_log_subject_idx
  ON core.audit_log (subject_type, subject_id, occurred_at DESC);

-- Per-actor browse: "what did user Y do this week"
CREATE INDEX audit_log_actor_idx
  ON core.audit_log (actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;

-- Tenant + action: "all approvals in tenant T last quarter"
CREATE INDEX audit_log_tenant_action_idx
  ON core.audit_log (tenant_id, action, occurred_at DESC);

-- Saga reconstruction via correlation_id (master §5.9)
CREATE INDEX audit_log_correlation_idx
  ON core.audit_log ((metadata->>'correlation_id'))
  WHERE metadata ? 'correlation_id';

-- Cross-reference to source table during shadow-write window
CREATE INDEX audit_log_shadow_source_idx
  ON core.audit_log (shadow_source_table, shadow_source_id)
  WHERE shadow_source_table IS NOT NULL;

-- ── RLS — APPEND-ONLY by design ────────────────────────────────────────────

ALTER TABLE core.audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log_y2026m05     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log_y2026m06     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log_y2026m07     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log_y2026m08     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log_y2026m09     ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log_y2026m10     ENABLE ROW LEVEL SECURITY;

-- tenant_admin / platform_admin can read their tenant's audit log
CREATE POLICY audit_log_tenant_admin_select ON core.audit_log
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND (
      public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
    )
  );

-- compliance_officer reads anywhere within their tenant — needed for
-- regulator-evidence pulls.
CREATE POLICY audit_log_compliance_officer_select ON core.audit_log
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND public.has_role((SELECT auth.uid()), 'compliance_officer'::public.app_role)
  );

-- Subject-owners read events about entities they own. Phase 1 stubs this
-- with a permissive tenant check; Phase 2+ will delegate to per-module
-- subject_visible_to_user() helpers.
-- (Deferred — for now, only admins read.)

-- NO INSERT/UPDATE/DELETE policies for authenticated — RLS denies by default.
-- Writes happen via the SECURITY DEFINER `core.write_audit()` helper below,
-- or directly by service_role (e.g. shadow-write triggers).

-- ── Grants ─────────────────────────────────────────────────────────────────

GRANT SELECT ON core.audit_log              TO authenticated;
GRANT ALL    ON core.audit_log              TO service_role;
GRANT ALL    ON core.audit_log_y2026m05     TO service_role;
GRANT ALL    ON core.audit_log_y2026m06     TO service_role;
GRANT ALL    ON core.audit_log_y2026m07     TO service_role;
GRANT ALL    ON core.audit_log_y2026m08     TO service_role;
GRANT ALL    ON core.audit_log_y2026m09     TO service_role;
GRANT ALL    ON core.audit_log_y2026m10     TO service_role;
GRANT USAGE  ON SEQUENCE core.audit_log_id_seq TO service_role;

-- ── core.write_audit() — the standard write helper ─────────────────────────
-- Modules call this instead of raw INSERT — keeps signature stable as
-- columns evolve, and centralises the "actor resolution from auth.uid()"
-- logic so application code doesn't need to repeat it.

CREATE OR REPLACE FUNCTION core.write_audit(
  p_subject_type     text,
  p_subject_id       uuid,
  p_action           text,
  p_diff             jsonb DEFAULT NULL,
  p_metadata         jsonb DEFAULT '{}',
  p_tenant_id        uuid  DEFAULT NULL,
  p_actor_user_id    uuid  DEFAULT NULL,
  p_actor_kind       text  DEFAULT 'user',
  p_retention_class  text  DEFAULT 'general_2y',
  p_occurred_at      timestamptz DEFAULT now()
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = core, pg_catalog
AS $$
DECLARE
  v_tenant_id     uuid := p_tenant_id;
  v_actor_user_id uuid := p_actor_user_id;
  v_id            bigint;
BEGIN
  -- Resolve tenant + actor from JWT if caller didn't supply them.
  IF v_tenant_id IS NULL THEN
    BEGIN
      v_tenant_id := public.get_user_tenant_id(auth.uid());
    EXCEPTION WHEN OTHERS THEN
      v_tenant_id := NULL;
    END;
  END IF;
  IF v_actor_user_id IS NULL AND p_actor_kind = 'user' THEN
    BEGIN
      v_actor_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
      v_actor_user_id := NULL;
    END;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'core.write_audit: tenant_id is required (could not be resolved from JWT)';
  END IF;

  INSERT INTO core.audit_log
    (tenant_id, occurred_at, actor_user_id, actor_kind,
     subject_type, subject_id, action, diff, metadata, retention_class)
  VALUES
    (v_tenant_id, p_occurred_at, v_actor_user_id, p_actor_kind,
     p_subject_type, p_subject_id, p_action, p_diff, p_metadata, p_retention_class)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION core.write_audit IS
  'Standard helper for emitting audit-log entries. Resolves tenant + actor from JWT when not supplied. Per master §3.5 + core.md §3.5.';

GRANT EXECUTE ON FUNCTION core.write_audit TO service_role, authenticated;

-- ── Append-only enforcement via trigger ─────────────────────────────────────
-- RLS already blocks authenticated UPDATE/DELETE. This trigger blocks even
-- service_role accidental updates. The only legal mutation is INSERT or
-- DELETE-via-partition-drop (the retention sweeper). Direct row UPDATE/DELETE
-- is rejected with a clear error.

CREATE OR REPLACE FUNCTION core.audit_log_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'core.audit_log is append-only — UPDATE/DELETE forbidden. Use partition drop for retention pruning.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE OR DELETE ON core.audit_log
  FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_mutation();

-- Mirror the no-mutation trigger on each partition (PostgreSQL parent triggers
-- fire for partition-targeted operations, but defence-in-depth).
CREATE TRIGGER trg_audit_log_y2026m05_no_update BEFORE UPDATE OR DELETE ON core.audit_log_y2026m05 FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_mutation();
CREATE TRIGGER trg_audit_log_y2026m06_no_update BEFORE UPDATE OR DELETE ON core.audit_log_y2026m06 FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_mutation();
CREATE TRIGGER trg_audit_log_y2026m07_no_update BEFORE UPDATE OR DELETE ON core.audit_log_y2026m07 FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_mutation();
CREATE TRIGGER trg_audit_log_y2026m08_no_update BEFORE UPDATE OR DELETE ON core.audit_log_y2026m08 FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_mutation();
CREATE TRIGGER trg_audit_log_y2026m09_no_update BEFORE UPDATE OR DELETE ON core.audit_log_y2026m09 FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_mutation();
CREATE TRIGGER trg_audit_log_y2026m10_no_update BEFORE UPDATE OR DELETE ON core.audit_log_y2026m10 FOR EACH ROW EXECUTE FUNCTION core.audit_log_block_mutation();
