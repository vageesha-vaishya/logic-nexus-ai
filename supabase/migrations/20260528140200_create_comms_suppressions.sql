-- Phase 1 Slice C — comms.suppressions
-- Per master §7.4 Phase 1 Slice C extension + comms-infrastructure.md §4.6
--
-- THE table the send-gateway consults before every outbound message. Hard
-- bounces, complaints (spam reports), and unsubscribes write rows here;
-- existence of a matching row blocks sending.
--
-- Closes G-CR-3 from comms-infrastructure.md §3:
--   no global suppression list, no unsubscribe enforcement at send time.
--
-- CAN-SPAM / GDPR / DPDP / CASL compliance gate. The 2 confirmed Indian
-- design-partner pilots are under DPDP — this table is regulatory-required.

CREATE TABLE comms.suppressions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,

  -- The address to suppress. Normalised: lowercase emails; E.164 phones.
  address             text NOT NULL,

  channel_kind        text NOT NULL
                      CHECK (channel_kind IN ('email','sms','whatsapp','push','in_app')),

  -- Why is this address suppressed?
  reason              text NOT NULL
                      CHECK (reason IN (
                        'bounce_hard',        -- definitive bounce (mailbox doesn't exist, blocked)
                        'bounce_soft_repeat', -- 3+ soft bounces in 14 days → treat as hard
                        'complaint',          -- recipient marked as spam
                        'unsubscribe',        -- one-click unsubscribe (RFC 8058) or in-app opt-out
                        'manual',             -- admin added via UI
                        'invalid_format',     -- address fails regex / E.164 validation
                        'compliance_screen'   -- compliance flagged (e.g. denied party)
                      )),

  -- Provenance — what event caused this suppression?
  -- For provider-driven bounces/complaints, points at comms.delivery_events row.
  -- For unsubscribes, captures the unsubscribe-token + IP.
  source_event_id     uuid,
  source_metadata     jsonb NOT NULL DEFAULT '{}',

  -- Lifecycle
  added_at            timestamptz NOT NULL DEFAULT now(),
  added_by_user_id    uuid,                                          -- NULL for system-added
  added_by_kind       text NOT NULL DEFAULT 'system'                  -- 'system' | 'admin' | 'recipient_unsubscribe'
                      CHECK (added_by_kind IN ('system','admin','recipient_unsubscribe')),

  -- Soft bounces can be temporary; permanent suppressions leave expires_at NULL.
  expires_at          timestamptz,

  notes               text,

  -- One row per (tenant, channel, address) — prevents duplicates that would
  -- confuse the send-gateway lookup.
  UNIQUE (tenant_id, channel_kind, address)
);

COMMENT ON TABLE comms.suppressions IS
  'Per-tenant suppression list. send-gateway MUST query this before every outbound. Existence of a row = do not send. Per comms-infrastructure.md §4.6.';

COMMENT ON COLUMN comms.suppressions.address IS
  'Normalised: emails are lowercased; phones use E.164 (+CC...). Send-gateway must apply same normalisation to recipient before lookup.';

COMMENT ON COLUMN comms.suppressions.expires_at IS
  'NULL = permanent. Soft-bounce-repeat suppressions may expire after 30d to allow re-engagement attempts. Unsubscribes are permanent.';

-- The hot read path: send-gateway looks up by (tenant, channel, address)
-- before every outbound. UNIQUE constraint covers this naturally; an extra
-- partial index on non-expired rows keeps lookup tight even with millions of rows.
CREATE INDEX suppressions_active_lookup_idx
  ON comms.suppressions (tenant_id, channel_kind, address)
  WHERE expires_at IS NULL OR expires_at > now();

-- Browsing by reason for admin dashboards
CREATE INDEX suppressions_reason_idx
  ON comms.suppressions (tenant_id, reason, added_at DESC);

-- Cleanup index for expired-suppression sweeper
CREATE INDEX suppressions_expired_idx
  ON comms.suppressions (expires_at)
  WHERE expires_at IS NOT NULL;

-- RLS: tenant-isolated read; tenant_admin can manually add/remove;
-- service_role does the bulk writes (webhook auto-suppression).
ALTER TABLE comms.suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppressions_tenant_select ON comms.suppressions
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id((SELECT auth.uid())));

CREATE POLICY suppressions_admin_insert ON comms.suppressions
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
  );

CREATE POLICY suppressions_admin_delete ON comms.suppressions
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.get_user_tenant_id((SELECT auth.uid()))
    AND public.has_role((SELECT auth.uid()), 'tenant_admin'::public.app_role)
    -- Bonus safety: admins can only remove manual suppressions; system-added
    -- ones (bounces/complaints) require a separate "force unsuppress" flow.
    AND added_by_kind IN ('admin','recipient_unsubscribe')
  );

GRANT SELECT, INSERT, DELETE ON comms.suppressions TO authenticated;
GRANT ALL                    ON comms.suppressions TO service_role;

-- Helper function for the send-gateway. Cheap; uses the active-lookup index.
CREATE OR REPLACE FUNCTION comms.is_suppressed(
  p_tenant_id    uuid,
  p_channel_kind text,
  p_address      text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = comms, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM comms.suppressions
    WHERE tenant_id   = p_tenant_id
      AND channel_kind = p_channel_kind
      AND address      = lower(trim(p_address))
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

COMMENT ON FUNCTION comms.is_suppressed IS
  'Send-gateway calls this before every outbound. Returns TRUE if the address is currently suppressed for the channel.';

GRANT EXECUTE ON FUNCTION comms.is_suppressed TO service_role, authenticated;
