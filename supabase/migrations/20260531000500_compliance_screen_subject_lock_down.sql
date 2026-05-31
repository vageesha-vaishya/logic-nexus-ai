-- Phase 6 Step 24 — lock down compliance.screen_subject EXECUTE.
--
-- Step 22a's GRANT was additive (TO service_role) but didn't REVOKE
-- the default PUBLIC EXECUTE that Postgres grants new functions. Net
-- effect: the function was reachable from `authenticated` and `anon`
-- via PostgREST's /rest/v1/rpc/screen_subject endpoint.
--
-- Unlike compliance.is_party_blocked (which is intentionally public —
-- gate-read for app code), screen_subject is the gating-consumer's
-- decision engine. It runs pg_trgm queries against
-- restricted_party_lists with elevated privileges and writes
-- screenings rows; only the service_role-backed consumer should call
-- it. REVOKE here makes the GRANT in Step 22a actually restrictive.
--
-- (Trigger fns emit_lead_created + enforce_quote_sent_compliance_gate
-- have the same pre-existing PUBLIC EXECUTE pattern as the Phase 5
-- emit_opportunity_won / emit_shipment_delivered trigger fns; left as-
-- is to match. They're invoked by triggers, not by RPC — calling them
-- without trigger context errors out.)

REVOKE EXECUTE ON FUNCTION compliance.screen_subject(
  uuid, text, uuid, uuid, text, uuid, text, text, numeric, numeric, integer
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION compliance.screen_subject(
  uuid, text, uuid, uuid, text, uuid, text, text, numeric, numeric, integer
) FROM anon;
REVOKE EXECUTE ON FUNCTION compliance.screen_subject(
  uuid, text, uuid, uuid, text, uuid, text, text, numeric, numeric, integer
) FROM authenticated;
-- service_role grant re-asserted explicitly to make the intent obvious
-- if someone reviews this migration in isolation.
GRANT EXECUTE ON FUNCTION compliance.screen_subject(
  uuid, text, uuid, uuid, text, uuid, text, text, numeric, numeric, integer
) TO service_role;
