-- Phase 7 UIM Step 1 — uim.integration_* canonical mirror tables.
--
-- Per master plan §7.4 Phase 7: "Create uim.integration.* sub-namespace;
-- migrate platform.integration_* here". This is the additive
-- scaffolding slice — mirror tables created, existing 9 rows of
-- platform.integrations backfilled. Dual-write triggers + drift
-- check helper come in a follow-up slice (Step 2), matching the
-- Phase 5/6 Step 1 pattern.
--
-- Tables mirrored (column shape preserved via LIKE INCLUDING ALL):
--   platform.integrations            (9 rows on prod 2026-06-03)
--   platform.integration_credentials (0 rows)
--   platform.integration_log         (0 rows)
--   platform.integration_dlq         (0 rows)
--   platform.webhook_subscriptions   (0 rows)
--
-- Total backfill on prod: 9 rows. Reversible.

-- 1) Schema already exists from the earlier uim.* tables shipped
--    (item_master, stock_*, etc.). Nothing to create here.

-- 2) Mirror tables. LIKE INCLUDING ALL preserves column types,
--    defaults, NOT NULL flags, and constraints. Note: it does NOT
--    copy FK constraints — we'll add the platform → uim FK rewires
--    in the Step 9-equivalent slice that drops the legacy tables.

CREATE TABLE IF NOT EXISTS uim.integrations
  (LIKE platform.integrations INCLUDING ALL);
COMMENT ON TABLE uim.integrations IS
  'Phase 7 UIM Step 1 — canonical mirror of platform.integrations. Sourced via additive backfill 2026-06-03; dual-write triggers ship in Step 2.';

CREATE TABLE IF NOT EXISTS uim.integration_credentials
  (LIKE platform.integration_credentials INCLUDING ALL);
COMMENT ON TABLE uim.integration_credentials IS
  'Phase 7 UIM Step 1 — canonical mirror of platform.integration_credentials.';

CREATE TABLE IF NOT EXISTS uim.integration_log
  (LIKE platform.integration_log INCLUDING ALL);
COMMENT ON TABLE uim.integration_log IS
  'Phase 7 UIM Step 1 — canonical mirror of platform.integration_log.';

CREATE TABLE IF NOT EXISTS uim.integration_dlq
  (LIKE platform.integration_dlq INCLUDING ALL);
COMMENT ON TABLE uim.integration_dlq IS
  'Phase 7 UIM Step 1 — canonical mirror of platform.integration_dlq.';

CREATE TABLE IF NOT EXISTS uim.webhook_subscriptions
  (LIKE platform.webhook_subscriptions INCLUDING ALL);
COMMENT ON TABLE uim.webhook_subscriptions IS
  'Phase 7 UIM Step 1 — canonical mirror of platform.webhook_subscriptions.';

-- 3) RLS — match what the originating platform.* tables have.
--    All platform tables are service-role-only today; mirror that.
ALTER TABLE uim.integrations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE uim.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE uim.integration_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE uim.integration_dlq         ENABLE ROW LEVEL SECURITY;
ALTER TABLE uim.webhook_subscriptions   ENABLE ROW LEVEL SECURITY;

-- Read access for authenticated users follows the tenant_id column
-- on each table that carries one. Tables without tenant_id
-- (integration_credentials, integration_dlq, integration_log entries
-- with NULL tenant_id) stay service-role-only.
CREATE POLICY uim_integrations_tenant_select ON uim.integrations
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE POLICY uim_integration_log_tenant_select ON uim.integration_log
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE POLICY uim_webhook_subscriptions_tenant_select ON uim.webhook_subscriptions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

-- Service role bypasses RLS but we GRANT explicitly for clarity.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON uim.integrations, uim.integration_credentials, uim.integration_log,
     uim.integration_dlq, uim.webhook_subscriptions
  TO service_role;

-- 4) Backfill. Plain INSERT…SELECT — LIKE preserved every column
--    so this is column-for-column.
INSERT INTO uim.integrations
  SELECT * FROM platform.integrations
  ON CONFLICT (id) DO NOTHING;

INSERT INTO uim.integration_credentials
  SELECT * FROM platform.integration_credentials
  ON CONFLICT (id) DO NOTHING;

INSERT INTO uim.integration_log
  SELECT * FROM platform.integration_log
  ON CONFLICT (id) DO NOTHING;

INSERT INTO uim.integration_dlq
  SELECT * FROM platform.integration_dlq
  ON CONFLICT (id) DO NOTHING;

INSERT INTO uim.webhook_subscriptions
  SELECT * FROM platform.webhook_subscriptions
  ON CONFLICT (id) DO NOTHING;

-- 5) Sanity assertions — each row count must match its source.
DO $sanity$
DECLARE
  v_deltas text := '';
  v_count int;
BEGIN
  SELECT (SELECT count(*) FROM uim.integrations) - (SELECT count(*) FROM platform.integrations) INTO v_count;
  IF v_count <> 0 THEN v_deltas := v_deltas || 'integrations=' || v_count || ' '; END IF;
  SELECT (SELECT count(*) FROM uim.integration_credentials) - (SELECT count(*) FROM platform.integration_credentials) INTO v_count;
  IF v_count <> 0 THEN v_deltas := v_deltas || 'integration_credentials=' || v_count || ' '; END IF;
  SELECT (SELECT count(*) FROM uim.integration_log) - (SELECT count(*) FROM platform.integration_log) INTO v_count;
  IF v_count <> 0 THEN v_deltas := v_deltas || 'integration_log=' || v_count || ' '; END IF;
  SELECT (SELECT count(*) FROM uim.integration_dlq) - (SELECT count(*) FROM platform.integration_dlq) INTO v_count;
  IF v_count <> 0 THEN v_deltas := v_deltas || 'integration_dlq=' || v_count || ' '; END IF;
  SELECT (SELECT count(*) FROM uim.webhook_subscriptions) - (SELECT count(*) FROM platform.webhook_subscriptions) INTO v_count;
  IF v_count <> 0 THEN v_deltas := v_deltas || 'webhook_subscriptions=' || v_count || ' '; END IF;
  IF v_deltas <> '' THEN
    RAISE EXCEPTION 'uim mirror backfill delta: %', v_deltas;
  END IF;
  RAISE NOTICE 'uim integration mirror OK — all 5 tables row-count-equal to platform.*';
END
$sanity$;
