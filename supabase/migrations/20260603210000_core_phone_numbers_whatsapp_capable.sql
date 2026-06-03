-- Phase 6 Comms — WhatsApp opt-in marker on core.phone_numbers.
--
-- The resolver already returns email + SMS recipients for any party
-- that has phone_links → phone_numbers wired. Adding a third recipient
-- (channel='whatsapp') for every such phone would be aggressive —
-- a phone number isn't always registered on WhatsApp, and even when
-- it is, the customer may not have opted in to WhatsApp notifications.
--
-- This column lets operators flag the phones they've confirmed are
-- WhatsApp-capable + opted-in. The resolver checks this flag before
-- creating a WhatsApp delivery row. Default is false so adding the
-- column never changes existing behavior.
--
-- Future ergonomics:
--   - A "Send WhatsApp updates" checkbox on the party-detail
--     UI flips this column.
--   - A tenant-level "auto-enable WhatsApp for all primary mobiles"
--     option triggers a one-time backfill UPDATE.
--   - Twilio Lookup API (the v2 line-type-intelligence field) can be
--     polled periodically to suggest values; never set silently.

ALTER TABLE core.phone_numbers
  ADD COLUMN IF NOT EXISTS whatsapp_capable boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN core.phone_numbers.whatsapp_capable IS
  'Phase 6 Comms: when true, the recipient-resolver adds a channel=whatsapp delivery alongside the SMS one. Set per-phone by operators; defaults to false so adding the column is non-disruptive.';

-- Partial index supports the resolver lookup "is this phone WhatsApp-
-- capable?" without scanning every phone_numbers row. Most rows are
-- expected to stay false so the partial keeps the index tiny.
CREATE INDEX IF NOT EXISTS idx_phone_numbers_whatsapp_capable
  ON core.phone_numbers (id)
  WHERE whatsapp_capable = true;
