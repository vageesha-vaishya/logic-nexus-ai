-- Phase 6 Step 54a — add 'exception' to public.shipment_status enum.
--
-- Required by comms.md §10's third cross-module event chain:
--   logistics.shipment.exception → multi-channel notify
--
-- The existing shipment_status enum covers the happy-path lifecycle
-- (draft → confirmed → in_transit → customs → out_for_delivery →
-- delivered) plus on_hold/returned/cancelled. None of those map
-- cleanly to "something unexpected went wrong" — customs hold,
-- damaged in transit, lost, port closure. 'exception' is the
-- catch-all status the spec asks for; downstream apps move shipments
-- INTO it when the carrier reports a problem, and the next slice's
-- trigger fires the multi-channel notification.
--
-- Split into its own migration because ALTER TYPE ... ADD VALUE
-- can't use the new value in the same transaction that creates it
-- (PG ≥12 rule). The trigger in 20260531003000 references 'exception'
-- and so must run as a separate apply.

ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'exception';

COMMENT ON TYPE public.shipment_status IS
  'Shipment lifecycle statuses. Phase 6 Step 54 added ''exception'' for unexpected-issue events that fan out to multi-channel customer notifications per comms.md §10.';
