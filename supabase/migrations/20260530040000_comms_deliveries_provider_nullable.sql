-- Phase 6 Step 5 — comms.deliveries.provider nullable until worker picks one.
--
-- The dispatcher creates the delivery row when fan-out happens (channel
-- + recipient_address are known); the actual provider isn't decided
-- until the delivery-worker hands off (could be resend / ses / smtp /
-- null based on COMMS_EMAIL_PROVIDER at send time).
--
-- Making provider nullable matches the lifecycle: status='pending' rows
-- have no provider yet; transition to sent/failed/suppressed populates
-- provider + provider_message_id atomically.

ALTER TABLE comms.deliveries ALTER COLUMN provider DROP NOT NULL;

COMMENT ON COLUMN comms.deliveries.provider IS
  'Phase 6 Step 5 — nullable until the delivery-worker selects + invokes a provider. Populated alongside provider_message_id at send time.';
