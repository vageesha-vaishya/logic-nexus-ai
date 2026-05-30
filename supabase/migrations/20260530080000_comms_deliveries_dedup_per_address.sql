-- Phase 6 Step 9 — comms.deliveries dedup keyed per address.
--
-- The Step 3 unique index keyed on (tenant_id, notification_id,
-- channel_kind) was correct for the user-recipient case (one intent →
-- one delivery per channel) but blocks role/team fan-out: when an
-- intent expands to multiple recipients, each address needs its own
-- delivery row.
--
-- Extending the unique to include recipient_address keeps the re-poll
-- idempotency guarantee (same recipient can't be double-inserted for
-- the same intent) while allowing fan-out.

DROP INDEX IF EXISTS comms.comms_deliveries_intent_dedup_idx;

CREATE UNIQUE INDEX comms_deliveries_intent_dedup_idx
  ON comms.deliveries (tenant_id, notification_id, channel_kind, recipient_address)
  WHERE notification_id IS NOT NULL;

COMMENT ON INDEX comms.comms_deliveries_intent_dedup_idx IS
  'Phase 6 Step 9 — one delivery per (intent, channel, address). Allows role/team fan-out while keeping re-poll idempotency.';
