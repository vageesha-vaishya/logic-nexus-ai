-- Phase 6 Step 6 — core.notifications customer-facing recipient
-- Per docs/plans/2026-05-28-modules/comms.md §2.4 (kill of
-- public.vendor_notifications called for recipient_party_id) +
-- realistic prod data: all quotes today are standalone with billing_address
-- only — no contact_id, no core.parties bridge from public.contacts.
--
-- Two new columns + a relaxed CHECK constraint:
--   recipient_party_id  uuid   — points at core.parties (future-proof,
--                                traceable). Resolver TODO: party →
--                                primary email. No FK because party
--                                mirror schema may shift.
--   recipient_address   text   — the literal channel address (email,
--                                phone, push token). Lets the trigger
--                                resolve to a deliverable value at
--                                emit time when no party row exists
--                                (standalone customers).
--
-- New constraint: exactly one of these recipient kinds is set —
--   user | role | team | (party_id and/or address as a single customer group)
-- party_id + address can coexist (party for traceability, address for
-- delivery), counted as one group.

ALTER TABLE core.notifications ADD COLUMN IF NOT EXISTS recipient_party_id uuid;
ALTER TABLE core.notifications ADD COLUMN IF NOT EXISTS recipient_address text;

ALTER TABLE core.notifications DROP CONSTRAINT IF EXISTS one_recipient_kind;
ALTER TABLE core.notifications ADD CONSTRAINT one_recipient_kind CHECK (
  (recipient_user_id IS NOT NULL)::int +
  (recipient_role_id IS NOT NULL)::int +
  (recipient_team_id IS NOT NULL)::int +
  ((recipient_party_id IS NOT NULL OR recipient_address IS NOT NULL))::int
  = 1
);

CREATE INDEX IF NOT EXISTS notifications_recipient_party_idx
  ON core.notifications (tenant_id, recipient_party_id, created_at DESC)
  WHERE recipient_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_recipient_address_idx
  ON core.notifications (tenant_id, recipient_address, created_at DESC)
  WHERE recipient_address IS NOT NULL;

COMMENT ON COLUMN core.notifications.recipient_party_id IS
  'Phase 6 Step 6 — customer/vendor recipient via core.parties. Set together with recipient_address until a party→email bridge exists.';
COMMENT ON COLUMN core.notifications.recipient_address IS
  'Phase 6 Step 6 — literal channel address (email/phone/push token) for standalone sends or party fallback.';
