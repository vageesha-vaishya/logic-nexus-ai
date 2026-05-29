-- Phase 4 Sales Step 5 — sales.scoring_* (resurrection of dead public lead_score_* tables)
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 4
--
-- public.lead_score_config (0 rows), public.lead_scoring_rules (0 rows),
-- public.lead_score_logs (0 rows) were all empty. The original tables
-- had several modelling bugs:
--   - lead_score_config.tenant_id was nullable (should be NOT NULL)
--   - lead_score_logs.lead_id had no FK (orphan rows possible)
--   - lead_score_logs lacked tenant_id (tenant-scoped RLS impossible)
--   - No RLS on any of them
--
-- This migration resurrects them under sales.scoring_* with those bugs
-- fixed. No backfill required (source tables empty). No dual-write to
-- the old tables — the old ones stay around as orphans until the
-- parked Phase 2 Step 9 sweep, but writers should target sales.scoring_*
-- from day one.

-- ══════════════════════════════════════════════════════════════════════
-- 1. sales.scoring_configs — per-tenant weights configuration
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE sales.scoring_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  -- weights_json layout matches the default from the original
  -- public.lead_score_config: keys for demographic, behavioral,
  -- logistics, and decay buckets. Default mirrors the legacy default so
  -- new tenants get a reasonable starter config.
  weights_json    jsonb NOT NULL DEFAULT '{
    "decay":        {"weekly_percentage": 10},
    "logistics":    {"urgent_shipment": 15, "high_value_cargo": 20},
    "behavioral":   {"page_view": 2, "email_opened": 5, "link_clicked": 10, "form_submission": 20},
    "demographic":  {"title_vp": 15, "title_cxo": 20, "title_manager": 10}
  }'::jsonb,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sales.scoring_configs IS
  'Phase 4 Sales Step 5 — per-tenant lead-scoring weights configuration. Resurrection of dead public.lead_score_config with tenant_id NOT NULL.';

-- Exactly one active config per tenant. Partial unique index lets you
-- archive old configs (set is_active=false) without violating the
-- constraint.
CREATE UNIQUE INDEX scoring_configs_tenant_active_unique
  ON sales.scoring_configs (tenant_id) WHERE is_active;

ALTER TABLE sales.scoring_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoring_configs_tenant_select ON sales.scoring_configs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY scoring_configs_tenant_insert ON sales.scoring_configs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY scoring_configs_tenant_update ON sales.scoring_configs
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_scoring_configs_updated_at
  BEFORE UPDATE ON sales.scoring_configs
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON sales.scoring_configs TO authenticated;
GRANT ALL ON sales.scoring_configs TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. sales.scoring_rules — criteria-based scoring rules
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE sales.scoring_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  -- criteria_type: bucket (e.g. 'demographic', 'behavioral', 'logistics')
  -- criteria_value: specific key within bucket (e.g. 'title_vp', 'email_opened')
  -- Together they identify which rule fires.
  criteria_type   text NOT NULL,
  criteria_value  text NOT NULL,
  score_points    integer NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- A rule is the (tenant, criteria_type, criteria_value) triple. Edits
  -- update score_points in place; soft-delete sets is_active=false.
  UNIQUE (tenant_id, criteria_type, criteria_value)
);

COMMENT ON TABLE sales.scoring_rules IS
  'Phase 4 Sales Step 5 — criteria-based scoring rules. Resurrection of dead public.lead_scoring_rules with proper RLS.';

CREATE INDEX scoring_rules_tenant_active_idx ON sales.scoring_rules (tenant_id, criteria_type) WHERE is_active;

ALTER TABLE sales.scoring_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoring_rules_tenant_select ON sales.scoring_rules
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY scoring_rules_tenant_insert ON sales.scoring_rules
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY scoring_rules_tenant_update ON sales.scoring_rules
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())))
  WITH CHECK (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE POLICY scoring_rules_tenant_delete ON sales.scoring_rules
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE TRIGGER trg_scoring_rules_updated_at
  BEFORE UPDATE ON sales.scoring_rules
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON sales.scoring_rules TO authenticated;
GRANT ALL ON sales.scoring_rules TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 3. sales.scoring_logs — score-change audit log
-- ══════════════════════════════════════════════════════════════════════
--
-- Adds tenant_id (was missing on original) + lead_id FK (was missing).
-- lead_id targets sales.leads, NOT public.leads, since sales.leads is
-- the new canonical home post-Step-1. The dual-write trigger keeps
-- sales.leads current as live writes still land on public.leads, so
-- the FK target is always present.

CREATE TABLE sales.scoring_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  lead_id         uuid NOT NULL REFERENCES sales.leads(id) ON DELETE CASCADE,
  old_score       integer,
  new_score       integer,
  change_reason   text,
  -- triggered_by: who or what caused the change. 'rule' for criteria
  -- match, 'manual' for human edit, 'ai' for the scoring model, etc.
  -- text rather than enum so new sources don't require migrations.
  triggered_by    text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE sales.scoring_logs IS
  'Phase 4 Sales Step 5 — score-change audit log. Resurrection of dead public.lead_score_logs with tenant_id + lead_id FK + triggered_by + metadata.';

CREATE INDEX scoring_logs_lead_created_idx   ON sales.scoring_logs (lead_id, created_at DESC);
CREATE INDEX scoring_logs_tenant_created_idx ON sales.scoring_logs (tenant_id, created_at DESC);

ALTER TABLE sales.scoring_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY scoring_logs_tenant_select ON sales.scoring_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
-- Inserts come from service_role (worker / RPC), not from end users —
-- no INSERT policy for authenticated.

GRANT SELECT ON sales.scoring_logs TO authenticated;
GRANT ALL ON sales.scoring_logs TO service_role;
