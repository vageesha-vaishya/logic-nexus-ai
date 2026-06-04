-- Directive Applicability S8 — queue-depth notification trigger.
--
-- Per docs/plans/2026-06-04-directive-applicability-surface-design.md
-- slice S8. When the awaiting_review queue depth crosses a tenant-
-- configured threshold, emit ONE core.notifications row tagged for
-- the configured reviewer role. Downstream comms-api dispatcher
-- fans out to email / in-app inbox per recipient preferences.
--
-- Idempotency: emits only when count transitions from (threshold-1)
-- to threshold. If the queue drops below threshold and rises again,
-- a fresh notification fires. No re-emit while count remains
-- at-or-above threshold.

-- ── 1. Per-tenant config table ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS amro.applicability_queue_alert_config (
  tenant_id           uuid PRIMARY KEY,
  enabled             boolean NOT NULL DEFAULT false,
  threshold           int NOT NULL DEFAULT 20 CHECK (threshold > 0),
  recipient_role_id   uuid,
  recipient_user_id   uuid,
  recipient_team_id   uuid,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_recipient_kind CHECK (
    (recipient_user_id IS NOT NULL)::int
    + (recipient_role_id IS NOT NULL)::int
    + (recipient_team_id IS NOT NULL)::int
    = CASE WHEN enabled THEN 1 ELSE 0 END
  )
);

COMMENT ON TABLE amro.applicability_queue_alert_config IS
  'Per-tenant config for the directive applicability review queue '
  'depth notification. Disabled by default — tenants opt in by '
  'setting enabled=true + EXACTLY ONE of recipient_role_id, '
  '_user_id, or _team_id (matches core.notifications constraint).';

ALTER TABLE amro.applicability_queue_alert_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY queue_alert_config_tenant_isolation
  ON amro.applicability_queue_alert_config FOR ALL
  USING (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid))
  WITH CHECK (tenant_id = (SELECT (auth.jwt() ->> 'tenant_id')::uuid));

CREATE POLICY queue_alert_config_service_bypass
  ON amro.applicability_queue_alert_config FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON amro.applicability_queue_alert_config TO authenticated;
GRANT ALL ON amro.applicability_queue_alert_config TO service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION amro.tg_queue_alert_config_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS queue_alert_config_set_updated_at
  ON amro.applicability_queue_alert_config;
CREATE TRIGGER queue_alert_config_set_updated_at
  BEFORE UPDATE ON amro.applicability_queue_alert_config
  FOR EACH ROW EXECUTE FUNCTION amro.tg_queue_alert_config_set_updated_at();

-- ── 2. Notification emit function ───────────────────────────────────

CREATE OR REPLACE FUNCTION amro.emit_applicability_queue_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = amro, public, core, pg_catalog AS $$
DECLARE
  v_cfg          amro.applicability_queue_alert_config%ROWTYPE;
  v_count        int;
  v_saga_id      uuid := gen_random_uuid();
  v_payload      jsonb;
BEGIN
  -- Only on awaiting_review inserts. Status transitions to other
  -- enum values don't grow the queue.
  IF NEW.status IS DISTINCT FROM 'awaiting_review' THEN
    RETURN NEW;
  END IF;

  -- Look up tenant config.
  SELECT * INTO v_cfg
  FROM amro.applicability_queue_alert_config
  WHERE tenant_id = NEW.tenant_id;

  IF NOT FOUND OR NOT v_cfg.enabled THEN
    RETURN NEW;
  END IF;

  -- Count current awaiting_review verdicts for this tenant (includes
  -- the just-inserted NEW row, since AFTER INSERT).
  SELECT count(*) INTO v_count
  FROM amro.directive_applicability
  WHERE tenant_id = NEW.tenant_id
    AND status = 'awaiting_review';

  -- Only fire on the transition INTO threshold. If count > threshold,
  -- we've already alerted; don't spam.
  IF v_count <> v_cfg.threshold THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'queue_depth',        v_count,
    'threshold',          v_cfg.threshold,
    'tenant_id',          NEW.tenant_id,
    'review_queue_url',   '/dashboard/amro/directives/applicability/queue',
    'subject',            'Directive applicability review queue at ' || v_count || ' items',
    'html',
      '<p>The directive applicability review queue has reached <strong>'
      || v_count || '</strong> verdicts awaiting review (your alert threshold is '
      || v_cfg.threshold || ').</p>'
      || '<p><a href="/dashboard/amro/directives/applicability/queue">Open the review queue</a></p>'
  );

  INSERT INTO core.notifications (
    tenant_id,
    recipient_user_id,
    recipient_role_id,
    recipient_team_id,
    subject_type,
    subject_id,
    intent_kind,
    severity,
    payload,
    correlation_id
  ) VALUES (
    NEW.tenant_id,
    v_cfg.recipient_user_id,
    v_cfg.recipient_role_id,
    v_cfg.recipient_team_id,
    'amro.directive_applicability_queue',
    NEW.tenant_id,  -- queue is tenant-scoped; tenant id is the "subject"
    'amro.applicability_queue.threshold_crossed',
    'warning',
    v_payload,
    v_saga_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING
    'emit_applicability_queue_alert (tenant=%, verdict=%) failed: %',
    NEW.tenant_id, NEW.id, SQLERRM;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION amro.emit_applicability_queue_alert IS
  'AFTER INSERT trigger on amro.directive_applicability. When tenant '
  'has alerts enabled AND queue depth = configured threshold (strict '
  'equality — fires only on the transition into threshold, not on every '
  'subsequent insert), emits one core.notifications row routed to the '
  'configured reviewer recipient. EXCEPTION fallback ensures saga '
  'producer never blocks the source-of-truth insert.';

-- ── 3. Attach trigger ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS tg_emit_applicability_queue_alert
  ON amro.directive_applicability;
CREATE TRIGGER tg_emit_applicability_queue_alert
  AFTER INSERT ON amro.directive_applicability
  FOR EACH ROW
  EXECUTE FUNCTION amro.emit_applicability_queue_alert();

-- ── 4. Helper: idempotent config upsert ─────────────────────────────
-- Convenience function for admin UI: enable + set threshold + set
-- recipient in one call.

CREATE OR REPLACE FUNCTION amro.configure_applicability_queue_alerts(
  p_tenant_id          uuid,
  p_enabled            boolean,
  p_threshold          int DEFAULT 20,
  p_recipient_role_id  uuid DEFAULT NULL,
  p_recipient_user_id  uuid DEFAULT NULL,
  p_recipient_team_id  uuid DEFAULT NULL,
  p_notes              text DEFAULT NULL
)
RETURNS amro.applicability_queue_alert_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = amro, public AS $$
DECLARE
  v_row amro.applicability_queue_alert_config;
BEGIN
  -- When enabling, require exactly one recipient.
  IF p_enabled THEN
    IF (p_recipient_role_id IS NOT NULL)::int
       + (p_recipient_user_id IS NOT NULL)::int
       + (p_recipient_team_id IS NOT NULL)::int <> 1 THEN
      RAISE EXCEPTION 'when enabled=true, exactly one of recipient_role_id, recipient_user_id, recipient_team_id must be set';
    END IF;
  END IF;

  INSERT INTO amro.applicability_queue_alert_config (
    tenant_id, enabled, threshold,
    recipient_role_id, recipient_user_id, recipient_team_id,
    notes
  ) VALUES (
    p_tenant_id, p_enabled, p_threshold,
    p_recipient_role_id, p_recipient_user_id, p_recipient_team_id,
    p_notes
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET enabled            = EXCLUDED.enabled,
        threshold          = EXCLUDED.threshold,
        recipient_role_id  = EXCLUDED.recipient_role_id,
        recipient_user_id  = EXCLUDED.recipient_user_id,
        recipient_team_id  = EXCLUDED.recipient_team_id,
        notes              = EXCLUDED.notes,
        updated_at         = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END $$;

COMMENT ON FUNCTION amro.configure_applicability_queue_alerts IS
  'Upsert config in one call. Enforces the EXACTLY-ONE-recipient '
  'invariant client-side when enabled=true. Returns the resulting '
  'config row.';

GRANT EXECUTE ON FUNCTION amro.configure_applicability_queue_alerts(
  uuid, boolean, int, uuid, uuid, uuid, text
) TO authenticated, service_role;
