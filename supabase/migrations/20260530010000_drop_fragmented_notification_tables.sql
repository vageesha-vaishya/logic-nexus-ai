-- Phase 6 Comms Step 2 — drop fragmented notification tables
-- Per docs/plans/2026-05-28-modules/comms.md §2.4 + §8 phase 13
--
-- Both tables verified 0 rows in prod (2026-05-30):
--   public.vendor_notifications  — dedup log for check-expiring-documents.
--                                  Edge fn rewritten to drop dedup write (date-
--                                  exact-match query is per-day idempotent;
--                                  proper idempotency moves to comms.deliveries
--                                  in Phase 6 cross-channel work).
--   public.notifications         — fragmented in-app sink. Frontend hook
--                                  useNotifications already reads from
--                                  markets.notifications; public.notifications
--                                  was a stale orphan. process-lead-assignments
--                                  edge fn rewritten to insert into
--                                  markets.notifications (the live sink).
--
-- markets.notifications is preserved — Phase 6 will convert it to a view over
-- core.notifications filtered by subject_type LIKE 'markets.%'.

BEGIN;

DROP TABLE IF EXISTS public.vendor_notifications;
DROP TABLE IF EXISTS public.notifications;

COMMIT;
