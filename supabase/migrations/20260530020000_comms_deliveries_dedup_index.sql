-- Phase 6 Comms Step 3 — comms.deliveries dedup index
--
-- The notification-dispatcher in services/comms-api/ fans out core.notifications
-- intent rows into per-channel comms.deliveries rows. Without a dedup index,
-- a poller re-tick would create duplicate deliveries. UNIQUE on
-- (tenant_id, notification_id, channel_kind) lets the dispatcher INSERT
-- with ON CONFLICT DO NOTHING and re-poll safely.
--
-- The constraint is partial — notification_id can be NULL for non-intent-
-- triggered deliveries (e.g. direct send via comms.sendEmail()). The
-- partial WHERE keeps those out of the unique scope.

CREATE UNIQUE INDEX IF NOT EXISTS comms_deliveries_intent_dedup_idx
  ON comms.deliveries (tenant_id, notification_id, channel_kind)
  WHERE notification_id IS NOT NULL;

COMMENT ON INDEX comms.comms_deliveries_intent_dedup_idx IS
  'Phase 6 Comms Step 3 — guarantees one delivery per intent per channel; dispatcher uses ON CONFLICT DO NOTHING for re-poll idempotency.';
