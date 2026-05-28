-- Phase 1 Slice C — comms.deliveries + comms.delivery_events
-- Per master §7.4 Phase 1 Slice C extension + comms-infrastructure.md §4.3
--
-- Minimal-for-now versions that receive Resend webhook payloads. The full
-- comms.deliveries schema from comms.md §3 lands when services/comms-api/ is
-- built in Phase 6; this version has the columns the webhook receiver needs
-- right now to close G-CR-2 (no bounce / complaint ingestion).
--
-- Two tables (one aggregate, one event log):
--   comms.deliveries        — one row per outbound message; latest status
--   comms.delivery_events   — one row per provider event; full history

-- ── comms.deliveries (aggregate / latest-status per delivery) ──────────────

CREATE TABLE comms.deliveries (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL,

  -- Link to the originating notification intent (per master §6.0 split).
  -- NULL for one-off sends not driven by core.notifications.
  notification_id          uuid,                                    -- FK to core.notifications added once Phase 1 Slice A lands fully

  channel_kind             text NOT NULL
                           CHECK (channel_kind IN ('email','sms','whatsapp','push','in_app')),

  -- Provider identity. Phase 6 will route through @platform/comms provider
  -- adapters; until then, the value is recorded directly from the send path.
  provider                 text NOT NULL,                            -- 'resend' | 'smtp' | 'twilio' | 'meta_wa' | 'fcm' | ...

  -- Provider's identifier for the message. e.g. Resend's `id` from POST /emails response.
  provider_message_id      text,

  recipient_address        text NOT NULL,                            -- normalised: lowercased email, E.164 phone

  -- Aggregated status. Updated by each delivery_events row in order of occurred_at.
  status                   text NOT NULL DEFAULT 'pending'
                           CHECK (status IN (
                             'pending',         -- queued for send
                             'sent',            -- handed to provider
                             'delivered',       -- provider confirms inbox accepted
                             'opened',          -- recipient opened (best-effort signal)
                             'clicked',         -- recipient clicked a link
                             'bounced',         -- failed at provider; see bounce_kind
                             'complained',      -- recipient marked as spam
                             'failed',          -- non-bounce failure (provider rejected, network error)
                             'suppressed'       -- blocked by suppression list before send
                           )),

  -- Detailed bounce info (when status='bounced')
  bounce_kind              text                                       -- 'hard' | 'soft' | 'permanent' | 'transient'
                           CHECK (bounce_kind IN ('hard','soft','permanent','transient') OR bounce_kind IS NULL),

  -- Lifecycle timestamps. NULL until the corresponding event arrives.
  sent_at                  timestamptz,
  delivered_at             timestamptz,
  bounced_at               timestamptz,
  complained_at            timestamptz,
  opened_at                timestamptz,                               -- first open
  clicked_at               timestamptz,                               -- first click
  failed_at                timestamptz,

  error_text               text,                                      -- provider-supplied failure reason

  -- Subject for joining back to business context (Phase 6 extends this)
  subject_type             text,                                      -- schema.entity per master §2.4
  subject_id               uuid,

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE comms.deliveries IS
  'One row per outbound message. Aggregated latest status from comms.delivery_events. Phase 1 Slice C minimum-viable shape; Phase 6 extends with full comms.md §3 schema.';

CREATE INDEX deliveries_tenant_recent_idx
  ON comms.deliveries (tenant_id, created_at DESC);

CREATE INDEX deliveries_provider_message_idx
  ON comms.deliveries (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX deliveries_recipient_idx
  ON comms.deliveries (tenant_id, channel_kind, recipient_address);

CREATE INDEX deliveries_subject_idx
  ON comms.deliveries (subject_type, subject_id, created_at DESC)
  WHERE subject_type IS NOT NULL;

CREATE INDEX deliveries_failed_idx
  ON comms.deliveries (tenant_id, status, created_at DESC)
  WHERE status IN ('bounced','complained','failed');

-- touch_updated_at trigger (helper already created in 20260528130200_create_core_notifications.sql)
CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON comms.deliveries
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- ── comms.delivery_events (per-event log) ──────────────────────────────────

CREATE TABLE comms.delivery_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL,
  delivery_id          uuid REFERENCES comms.deliveries(id) ON DELETE CASCADE,

  event_type           text NOT NULL,                                 -- raw provider event type, e.g. 'email.sent','email.bounced'
  occurred_at          timestamptz NOT NULL,                          -- provider's reported timestamp
  ingested_at          timestamptz NOT NULL DEFAULT now(),

  -- Idempotency identifier from the provider (Resend gives `id` on its webhook).
  -- UNIQUE here protects against duplicate webhook deliveries reaching us.
  provider_event_id    text,

  -- For bounces: 'hard' vs 'soft' / detailed bounce code if available.
  bounce_kind          text,
  bounce_reason        text,                                          -- 'mailbox_does_not_exist','quota_exceeded',...

  -- For clicks: URL that was clicked.
  clicked_url          text,

  -- Geo/UA for opens / clicks
  ip_address           text,
  user_agent           text,

  -- Raw provider payload for audit / replay
  payload              jsonb NOT NULL DEFAULT '{}',

  UNIQUE (provider_event_id)                                           -- webhook dedup
);

COMMENT ON TABLE comms.delivery_events IS
  'Per-event log per delivery. Webhook receiver writes one row per provider event. comms.deliveries.status is updated from these. UNIQUE(provider_event_id) protects against duplicate webhook deliveries.';

CREATE INDEX delivery_events_delivery_occurred_idx
  ON comms.delivery_events (delivery_id, occurred_at DESC);

CREATE INDEX delivery_events_event_type_idx
  ON comms.delivery_events (tenant_id, event_type, occurred_at DESC);

-- RLS — tenant_admin reads everything in tenant; recipient cannot see
-- their own delivery rows directly (this is operational, not user-facing).
ALTER TABLE comms.deliveries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comms.delivery_events   ENABLE ROW LEVEL SECURITY;

CREATE POLICY deliveries_tenant_admin_select ON comms.deliveries
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND (
      public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
    )
  );

CREATE POLICY delivery_events_tenant_admin_select ON comms.delivery_events
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND (
      public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role)
    )
  );

GRANT SELECT ON comms.deliveries         TO authenticated;
GRANT SELECT ON comms.delivery_events    TO authenticated;
GRANT ALL    ON comms.deliveries         TO service_role;
GRANT ALL    ON comms.delivery_events    TO service_role;

-- ── apply_delivery_event() — helper to update deliveries from an event ───
-- Webhook receivers call this within a transaction after inserting the
-- delivery_events row. Centralises the state-machine logic.

CREATE OR REPLACE FUNCTION comms.apply_delivery_event(
  p_delivery_id    uuid,
  p_event_type     text,
  p_occurred_at    timestamptz,
  p_bounce_kind    text DEFAULT NULL,
  p_error_text     text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = comms, pg_catalog
AS $$
BEGIN
  -- Update aggregate status based on event type. Order of fields matters —
  -- e.g. an 'opened' event after 'delivered' updates opened_at without
  -- regressing status if 'bounced' already arrived.
  UPDATE comms.deliveries
  SET
    status        = CASE
                      -- Terminal-status events are sticky
                      WHEN status IN ('bounced','complained','failed','suppressed') THEN status
                      WHEN p_event_type = 'email.sent'           THEN 'sent'
                      WHEN p_event_type = 'email.delivered'      THEN 'delivered'
                      WHEN p_event_type = 'email.bounced'        THEN 'bounced'
                      WHEN p_event_type = 'email.complained'     THEN 'complained'
                      WHEN p_event_type = 'email.opened'         THEN COALESCE(NULLIF(status,'sent'), 'opened')
                      WHEN p_event_type = 'email.clicked'        THEN COALESCE(NULLIF(status,'sent'), 'clicked')
                      WHEN p_event_type = 'email.delivery_delayed' THEN status     -- doesn't change status
                      WHEN p_event_type = 'email.failed'         THEN 'failed'
                      ELSE status
                    END,
    bounce_kind   = COALESCE(p_bounce_kind, bounce_kind),
    sent_at       = CASE WHEN p_event_type = 'email.sent'      AND sent_at      IS NULL THEN p_occurred_at ELSE sent_at      END,
    delivered_at  = CASE WHEN p_event_type = 'email.delivered' AND delivered_at IS NULL THEN p_occurred_at ELSE delivered_at END,
    bounced_at    = CASE WHEN p_event_type = 'email.bounced'   AND bounced_at   IS NULL THEN p_occurred_at ELSE bounced_at   END,
    complained_at = CASE WHEN p_event_type = 'email.complained' AND complained_at IS NULL THEN p_occurred_at ELSE complained_at END,
    opened_at     = CASE WHEN p_event_type = 'email.opened'    AND opened_at    IS NULL THEN p_occurred_at ELSE opened_at    END,
    clicked_at    = CASE WHEN p_event_type = 'email.clicked'   AND clicked_at   IS NULL THEN p_occurred_at ELSE clicked_at   END,
    failed_at     = CASE WHEN p_event_type = 'email.failed'    AND failed_at    IS NULL THEN p_occurred_at ELSE failed_at    END,
    error_text    = COALESCE(p_error_text, error_text),
    updated_at    = now()
  WHERE id = p_delivery_id;
END;
$$;

GRANT EXECUTE ON FUNCTION comms.apply_delivery_event TO service_role;
