-- Phase 6 Comms Step 1 — comms.* canonical email + messaging + notification tables
-- Per docs/plans/2026-05-28-platform-modules-redesign.md §7.4 Phase 6
--
-- The comms.* schema already exists from Phase 1 Slice C with 3 live
-- delivery-infrastructure tables (deliveries, delivery_events,
-- suppressions). This slice adds 12 mirror tables that cover the
-- email/messaging/notification surface from public.*.
--
-- Tables mirrored (row counts at backfill):
--   - comms.emails                     (33 rows, 70 cols) — the big one
--   - comms.email_accounts             (6 rows, 29 cols) — vault-backed creds (Phase 1 Slice C)
--   - comms.email_audit_log            (68 rows, 11 cols)
--   - comms.email_sync_logs            (451 rows, 8 cols) — RLS via email_accounts JOIN
--   - comms.email_templates            (6 rows, 15 cols)
--   - comms.email_filters              (0 rows, 12 cols)
--   - comms.email_account_delegations  (0 rows, 11 cols) — RLS via email_accounts JOIN
--   - comms.messages                   (4 rows, 25 cols)
--   - comms.message_attachments        (0 rows, 6 cols) — RLS via messages JOIN
--   - comms.notifications              (0 rows, 9 cols) — user-scoped (NOT tenant)
--   - comms.scheduled_emails           (0 rows, 23 cols)
--   - comms.webhook_outbox             (17 rows, 18 cols)
--
-- Master plan calls out vendor_notifications + other fragmented tables
-- for drop — handled in a separate cleanup slice.
-- email_sequences/sequence_steps/enrollments/logs are their own
-- sequencing subsystem; deferred.
-- email_tracking_events folds into comms.delivery_events (already
-- exists); won't be mirrored separately.

-- ══════════════════════════════════════════════════════════════════════
-- Tier A — direct tenant_id (9 tables)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE comms.emails (LIKE public.emails INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.emails ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.emails IS 'Phase 6 Comms Step 1 — mirror of public.emails.';
CREATE INDEX comms_emails_tenant_idx ON comms.emails (tenant_id);
ALTER TABLE comms.emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_emails_tenant_select ON comms.emails FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_comms_emails_updated_at BEFORE UPDATE ON comms.emails FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.emails TO authenticated;
GRANT ALL ON comms.emails TO service_role;

CREATE TABLE comms.email_accounts (LIKE public.email_accounts INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.email_accounts ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.email_accounts IS 'Phase 6 Comms Step 1 — mirror of public.email_accounts (vault-backed creds since Phase 1 Slice C).';
CREATE INDEX comms_email_accounts_tenant_idx ON comms.email_accounts (tenant_id);
ALTER TABLE comms.email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_email_accounts_tenant_select ON comms.email_accounts FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_comms_email_accounts_updated_at BEFORE UPDATE ON comms.email_accounts FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.email_accounts TO authenticated;
GRANT ALL ON comms.email_accounts TO service_role;

CREATE TABLE comms.email_audit_log (LIKE public.email_audit_log INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.email_audit_log ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.email_audit_log IS 'Phase 6 Comms Step 1 — mirror of public.email_audit_log.';
CREATE INDEX comms_email_audit_log_tenant_idx ON comms.email_audit_log (tenant_id);
ALTER TABLE comms.email_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_email_audit_log_tenant_select ON comms.email_audit_log FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
GRANT SELECT ON comms.email_audit_log TO authenticated;
GRANT ALL ON comms.email_audit_log TO service_role;

CREATE TABLE comms.email_filters (LIKE public.email_filters INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.email_filters ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.email_filters IS 'Phase 6 Comms Step 1 — mirror of public.email_filters.';
CREATE INDEX comms_email_filters_tenant_idx ON comms.email_filters (tenant_id);
ALTER TABLE comms.email_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_email_filters_tenant_select ON comms.email_filters FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_comms_email_filters_updated_at BEFORE UPDATE ON comms.email_filters FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.email_filters TO authenticated;
GRANT ALL ON comms.email_filters TO service_role;

CREATE TABLE comms.email_templates (LIKE public.email_templates INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.email_templates ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.email_templates IS 'Phase 6 Comms Step 1 — mirror of public.email_templates.';
CREATE INDEX comms_email_templates_tenant_idx ON comms.email_templates (tenant_id);
ALTER TABLE comms.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_email_templates_tenant_select ON comms.email_templates FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_comms_email_templates_updated_at BEFORE UPDATE ON comms.email_templates FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.email_templates TO authenticated;
GRANT ALL ON comms.email_templates TO service_role;

CREATE TABLE comms.messages (LIKE public.messages INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.messages ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.messages IS 'Phase 6 Comms Step 1 — mirror of public.messages.';
CREATE INDEX comms_messages_tenant_idx ON comms.messages (tenant_id);
ALTER TABLE comms.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_messages_tenant_select ON comms.messages FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_comms_messages_updated_at BEFORE UPDATE ON comms.messages FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.messages TO authenticated;
GRANT ALL ON comms.messages TO service_role;

CREATE TABLE comms.scheduled_emails (LIKE public.scheduled_emails INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.scheduled_emails ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.scheduled_emails IS 'Phase 6 Comms Step 1 — mirror of public.scheduled_emails.';
CREATE INDEX comms_scheduled_emails_tenant_idx ON comms.scheduled_emails (tenant_id);
ALTER TABLE comms.scheduled_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_scheduled_emails_tenant_select ON comms.scheduled_emails FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_comms_scheduled_emails_updated_at BEFORE UPDATE ON comms.scheduled_emails FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.scheduled_emails TO authenticated;
GRANT ALL ON comms.scheduled_emails TO service_role;

CREATE TABLE comms.webhook_outbox (LIKE public.webhook_outbox INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.webhook_outbox ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.webhook_outbox IS 'Phase 6 Comms Step 1 — mirror of public.webhook_outbox.';
CREATE INDEX comms_webhook_outbox_tenant_idx ON comms.webhook_outbox (tenant_id);
ALTER TABLE comms.webhook_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_webhook_outbox_tenant_select ON comms.webhook_outbox FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));
CREATE TRIGGER trg_comms_webhook_outbox_updated_at BEFORE UPDATE ON comms.webhook_outbox FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.webhook_outbox TO authenticated;
GRANT ALL ON comms.webhook_outbox TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- Tier B — JOIN-based RLS (no tenant_id on source)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE comms.email_sync_logs (LIKE public.email_sync_logs INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.email_sync_logs ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.email_sync_logs IS 'Phase 6 Comms Step 1 — mirror of public.email_sync_logs. RLS via email_accounts JOIN.';
CREATE INDEX comms_email_sync_logs_account_idx ON comms.email_sync_logs (account_id);
ALTER TABLE comms.email_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_email_sync_logs_tenant_select ON comms.email_sync_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM comms.email_accounts a
    WHERE a.id = comms.email_sync_logs.account_id
      AND a.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));
GRANT SELECT ON comms.email_sync_logs TO authenticated;
GRANT ALL ON comms.email_sync_logs TO service_role;

CREATE TABLE comms.email_account_delegations (LIKE public.email_account_delegations INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.email_account_delegations ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.email_account_delegations IS 'Phase 6 Comms Step 1 — mirror of public.email_account_delegations. RLS via email_accounts JOIN.';
CREATE INDEX comms_email_account_delegations_account_idx ON comms.email_account_delegations (account_id);
ALTER TABLE comms.email_account_delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_email_account_delegations_tenant_select ON comms.email_account_delegations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM comms.email_accounts a
    WHERE a.id = comms.email_account_delegations.account_id
      AND a.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));
CREATE TRIGGER trg_comms_email_account_delegations_updated_at BEFORE UPDATE ON comms.email_account_delegations FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();
GRANT SELECT ON comms.email_account_delegations TO authenticated;
GRANT ALL ON comms.email_account_delegations TO service_role;

CREATE TABLE comms.message_attachments (LIKE public.message_attachments INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.message_attachments ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.message_attachments IS 'Phase 6 Comms Step 1 — mirror of public.message_attachments. RLS via messages JOIN.';
CREATE INDEX comms_message_attachments_message_idx ON comms.message_attachments (message_id);
ALTER TABLE comms.message_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_message_attachments_tenant_select ON comms.message_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM comms.messages m
    WHERE m.id = comms.message_attachments.message_id
      AND m.tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  ));
GRANT SELECT ON comms.message_attachments TO authenticated;
GRANT ALL ON comms.message_attachments TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- Tier C — user-scoped (notifications are per-user, not per-tenant)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE comms.notifications (LIKE public.notifications INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
ALTER TABLE comms.notifications ADD PRIMARY KEY (id);
COMMENT ON TABLE comms.notifications IS 'Phase 6 Comms Step 1 — mirror of public.notifications. RLS user-scoped.';
CREATE INDEX comms_notifications_user_idx ON comms.notifications (user_id);
ALTER TABLE comms.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY comms_notifications_user_select ON comms.notifications
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
GRANT SELECT ON comms.notifications TO authenticated;
GRANT ALL ON comms.notifications TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- Backfill
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO comms.emails                     SELECT * FROM public.emails                     ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.email_accounts             SELECT * FROM public.email_accounts             ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.email_audit_log            SELECT * FROM public.email_audit_log            ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.email_filters              SELECT * FROM public.email_filters              ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.email_templates            SELECT * FROM public.email_templates            ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.messages                   SELECT * FROM public.messages                   ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.scheduled_emails           SELECT * FROM public.scheduled_emails           ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.webhook_outbox             SELECT * FROM public.webhook_outbox             ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.email_sync_logs            SELECT * FROM public.email_sync_logs            ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.email_account_delegations  SELECT * FROM public.email_account_delegations  ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.message_attachments        SELECT * FROM public.message_attachments        ON CONFLICT (id) DO NOTHING;
INSERT INTO comms.notifications              SELECT * FROM public.notifications              ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- Dual-write triggers (generated programmatically — 12 tables)
-- ══════════════════════════════════════════════════════════════════════

DO $do$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'emails','email_accounts','email_audit_log','email_filters','email_templates',
    'messages','scheduled_emails','webhook_outbox',
    'email_sync_logs','email_account_delegations','message_attachments','notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format($f$
      CREATE OR REPLACE FUNCTION comms.dual_write_from_%I()
      RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = comms, pg_catalog AS $TRG$
      BEGIN
        IF TG_OP = 'DELETE' THEN DELETE FROM comms.%I WHERE id = OLD.id;
        ELSIF TG_OP = 'INSERT' THEN INSERT INTO comms.%I SELECT NEW.* ON CONFLICT (id) DO NOTHING;
        ELSIF TG_OP = 'UPDATE' THEN DELETE FROM comms.%I WHERE id = NEW.id; INSERT INTO comms.%I SELECT NEW.*;
        END IF;
        RETURN COALESCE(NEW, OLD);
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'dual_write_from_%I (op=%%, id=%%) failed: %%', TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM;
        RETURN COALESCE(NEW, OLD);
      END; $TRG$;
    $f$, tbl, tbl, tbl, tbl, tbl, tbl);
    EXECUTE format($f$
      CREATE TRIGGER trg_%I_dual_write_to_comms
        AFTER INSERT OR UPDATE OR DELETE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION comms.dual_write_from_%I();
    $f$, tbl, tbl, tbl);
  END LOOP;
END $do$;

-- ══════════════════════════════════════════════════════════════════════
-- Drift monitor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION comms.base_drift_check()
RETURNS TABLE (metric text, delta bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = comms, public, pg_catalog AS $$
  SELECT 'emails_minus_comms', (SELECT count(*) FROM public.emails) - (SELECT count(*) FROM comms.emails)
  UNION ALL SELECT 'email_accounts_minus_comms', (SELECT count(*) FROM public.email_accounts) - (SELECT count(*) FROM comms.email_accounts)
  UNION ALL SELECT 'email_audit_log_minus_comms', (SELECT count(*) FROM public.email_audit_log) - (SELECT count(*) FROM comms.email_audit_log)
  UNION ALL SELECT 'email_filters_minus_comms', (SELECT count(*) FROM public.email_filters) - (SELECT count(*) FROM comms.email_filters)
  UNION ALL SELECT 'email_templates_minus_comms', (SELECT count(*) FROM public.email_templates) - (SELECT count(*) FROM comms.email_templates)
  UNION ALL SELECT 'messages_minus_comms', (SELECT count(*) FROM public.messages) - (SELECT count(*) FROM comms.messages)
  UNION ALL SELECT 'scheduled_emails_minus_comms', (SELECT count(*) FROM public.scheduled_emails) - (SELECT count(*) FROM comms.scheduled_emails)
  UNION ALL SELECT 'webhook_outbox_minus_comms', (SELECT count(*) FROM public.webhook_outbox) - (SELECT count(*) FROM comms.webhook_outbox)
  UNION ALL SELECT 'email_sync_logs_minus_comms', (SELECT count(*) FROM public.email_sync_logs) - (SELECT count(*) FROM comms.email_sync_logs)
  UNION ALL SELECT 'email_account_delegations_minus_comms', (SELECT count(*) FROM public.email_account_delegations) - (SELECT count(*) FROM comms.email_account_delegations)
  UNION ALL SELECT 'message_attachments_minus_comms', (SELECT count(*) FROM public.message_attachments) - (SELECT count(*) FROM comms.message_attachments)
  UNION ALL SELECT 'notifications_minus_comms', (SELECT count(*) FROM public.notifications) - (SELECT count(*) FROM comms.notifications);
$$;
COMMENT ON FUNCTION comms.base_drift_check IS 'Phase 6 Comms Step 1 drift monitor. All 12 deltas should remain 0.';
GRANT EXECUTE ON FUNCTION comms.base_drift_check TO service_role;
