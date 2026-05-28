-- Phase 1.3 — core.notifications (intent layer)
-- Per master design doc §6.0 + core.md §3.6
--
-- core.notifications holds the INTENT to notify a user/team/role about an
-- event. comms.deliveries (created in Phase 6) tracks the actual delivery
-- per channel. Modules emit intent; they never pick the channel themselves.
--
-- No producers yet. Phase 6 (comms-api) is the first consumer.

CREATE TABLE core.notifications (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid         NOT NULL,

  -- Polymorphic recipient: exactly one of these is non-null.
  recipient_user_id   uuid,                                       -- a specific user
  recipient_role_id   uuid,                                       -- any user with this role (fanned out by comms-api)
  recipient_team_id   uuid,                                       -- any member of this team

  -- Polymorphic subject — what the notification is ABOUT.
  -- subject_type uses the schema.entity convention per master §2.4:
  --   'sales.lead', 'quotation.quote', 'logistics.shipment', 'amro.work_order', etc.
  subject_type        text         NOT NULL,
  subject_id          uuid         NOT NULL,

  -- Intent classification. comms-api routes by this + recipient preferences.
  intent_kind         text         NOT NULL,                      -- e.g. 'lead.assigned', 'shipment.delayed', 'workorder.approved'
  severity            text         NOT NULL DEFAULT 'info'
                                   CHECK (severity IN ('info','warning','urgent','critical')),

  payload             jsonb        NOT NULL DEFAULT '{}',
  -- payload is rendered into channel-specific messages by comms-api templates.

  read_at             timestamptz,
  dismissed_at        timestamptz,
  expires_at          timestamptz,                                -- after this, notification is auto-dismissed

  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),

  -- Saga / observability
  correlation_id      uuid,                                       -- per master §5.9 — propagates from the root event

  -- Exactly one recipient kind must be set
  CONSTRAINT one_recipient_kind CHECK (
    (recipient_user_id IS NOT NULL)::int
    + (recipient_role_id IS NOT NULL)::int
    + (recipient_team_id IS NOT NULL)::int
    = 1
  )
);

COMMENT ON TABLE core.notifications IS
  'Notification INTENT layer. comms.deliveries tracks the actual per-channel delivery (Phase 6). Master §6.0 + core.md §3.6.';

COMMENT ON COLUMN core.notifications.subject_type IS
  'Schema-qualified entity name per master §2.4: ''sales.lead'', ''quotation.quote'', ''logistics.shipment'', ''amro.work_order'', etc.';

-- Indexes
CREATE INDEX notifications_recipient_user_unread_idx
  ON core.notifications (tenant_id, recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL AND read_at IS NULL;

CREATE INDEX notifications_recipient_role_unread_idx
  ON core.notifications (tenant_id, recipient_role_id, created_at DESC)
  WHERE recipient_role_id IS NOT NULL AND read_at IS NULL;

CREATE INDEX notifications_recipient_team_unread_idx
  ON core.notifications (tenant_id, recipient_team_id, created_at DESC)
  WHERE recipient_team_id IS NOT NULL AND read_at IS NULL;

CREATE INDEX notifications_subject_idx
  ON core.notifications (tenant_id, subject_type, subject_id);

CREATE INDEX notifications_correlation_idx
  ON core.notifications (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Cleanup: notifications past expires_at are routinely deleted
CREATE INDEX notifications_expired_idx
  ON core.notifications (expires_at)
  WHERE expires_at IS NOT NULL AND dismissed_at IS NULL;

-- touch_updated_at trigger
CREATE OR REPLACE FUNCTION core.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON core.notifications
  FOR EACH ROW EXECUTE FUNCTION core.touch_updated_at();

-- RLS — user reads own; tenant_admin reads all in tenant; service_role does all
ALTER TABLE core.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_recipient_select ON core.notifications
  FOR SELECT TO authenticated
  USING (
    -- Recipient by user_id directly
    recipient_user_id = (SELECT auth.uid())
    OR
    -- Recipient by role: any user with the role in this tenant can see it
    (
      recipient_role_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.tenant_id = core.notifications.tenant_id
          AND ur.id = recipient_role_id    -- if user_roles.id IS the role_id reference
      )
    )
  );

CREATE POLICY notifications_recipient_update ON core.notifications
  FOR UPDATE TO authenticated
  USING (
    recipient_user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    recipient_user_id = (SELECT auth.uid())
  );

CREATE POLICY notifications_tenant_admin_select ON core.notifications
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
    AND tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
  );

-- Grants
GRANT SELECT, UPDATE ON core.notifications TO authenticated;
GRANT ALL            ON core.notifications TO service_role;
