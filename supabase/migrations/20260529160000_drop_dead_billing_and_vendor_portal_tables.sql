-- Phase 5 cleanup — drop three dead tables that the master plan called
-- out for retirement:
--
--   - public.vendor_portal_activity  (0 rows, master plan §7.4 Phase 5 line 1273)
--   - public.billing_invoices        (0 rows, "duplicate" of public.invoices per §7.4 line 1275)
--   - public.billing_payments        (0 rows, "duplicate" of public.payments  per §7.4 line 1276)
--
-- All three are empty in prod. Verified no incoming FK constraints
-- (pg_constraint query) and no live code references in src/ or services/
-- (only src/integrations/supabase/types.ts will need a regen). The
-- master plan called the billing_* reconciliation "High risk, 2-week
-- parity script" — turns out moot because both tables never got
-- populated. Just drop them.
--
-- vendor_portal_activity was a 2026-02-04 addition (Phase 3 vendor
-- performance work) that never had real traffic.

DROP TABLE IF EXISTS public.vendor_portal_activity CASCADE;
DROP TABLE IF EXISTS public.billing_invoices       CASCADE;
DROP TABLE IF EXISTS public.billing_payments       CASCADE;
