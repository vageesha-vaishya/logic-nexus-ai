-- Phase 6 Step 21 — compliance.is_party_blocked gate helper.
--
-- The downstream gate (Step 23, BEFORE UPDATE trigger on
-- public.quotation_versions when status transitions to 'sent') needs a
-- single SQL question: "is this customer compliance-blocked right now?"
-- That question wraps two screening lookup shapes:
--
--   1. Direct: a compliance.screenings row with subject_party_id =
--      <account.id> and status='failed', not expired. This is the
--      natural shape once a customer is a real party (account exists).
--
--   2. Indirect via converted lead: a screening row created at
--      sales.lead.created time (Step 19's emitter) carries
--      subject_type='sales.lead', subject_id=<lead.id>, and
--      subject_party_id IS NULL at that point because the lead isn't a
--      party yet. After the lead converts to an account
--      (public.leads.converted_account_id IS NOT NULL), the gate for
--      that account must still see that lead-time failure.
--
-- accounts.id == core.parties.id for organization-type parties (per the
-- backfill at 20260529030000 line 35-41 — INSERT INTO core.parties
-- (id, ...) SELECT a.id, ...), so the caller passes accounts.id as the
-- p_party_id argument and the helper's direct lookup works without an
-- extra join.
--
-- Expiry: a screening row with expires_at IS NULL is treated as
-- non-expiring (the consumer in Step 22 sets expires_at = now() + 90
-- days for sanctions/denied-party class). expires_at IN THE PAST means
-- the decision is stale and re-screening is required — the gate fails
-- open (party not blocked) so a stale-failed row doesn't permanently
-- lock out the customer until manual re-screen.
--
-- Status: only 'failed' blocks. 'flagged' surfaces in the
-- compliance-officer UI (Step 13's intent emitter) for review but does
-- NOT auto-block — per compliance.md §9.1 "sync only for denied_party
-- on high-risk subject types; otherwise async with status badge".

CREATE OR REPLACE FUNCTION compliance.is_party_blocked(
  p_tenant_id uuid,
  p_party_id  uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = compliance, public, pg_catalog
AS $$
  SELECT EXISTS (
    -- (1) Direct: screening keyed to the party.
    SELECT 1
    FROM compliance.screenings s
    WHERE s.tenant_id = p_tenant_id
      AND s.status = 'failed'
      AND s.subject_party_id = p_party_id
      AND (s.expires_at IS NULL OR s.expires_at > now())
    UNION ALL
    -- (2) Indirect: screening keyed to a lead that converted to this party.
    SELECT 1
    FROM compliance.screenings s
    JOIN public.leads l
      ON l.id = s.subject_id
     AND l.converted_account_id = p_party_id
    WHERE s.tenant_id = p_tenant_id
      AND s.status = 'failed'
      AND s.subject_type = 'sales.lead'
      AND (s.expires_at IS NULL OR s.expires_at > now())
  );
$$;

COMMENT ON FUNCTION compliance.is_party_blocked(uuid, uuid) IS
  'Phase 6 Step 21 — gate-read for the compliance saga. Returns TRUE if the party has a non-expired failed screening, either keyed directly to the party OR keyed to a lead that converted to this party. Used by Step 23''s quote.sent BEFORE trigger to block transitions; safe for any caller (BEFORE/AFTER triggers, edge functions, application code).';

GRANT EXECUTE ON FUNCTION compliance.is_party_blocked(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION compliance.is_party_blocked(uuid, uuid) TO service_role;
