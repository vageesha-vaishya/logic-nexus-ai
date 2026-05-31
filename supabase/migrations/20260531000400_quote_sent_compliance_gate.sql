-- Phase 6 Step 23 — quote.sent compliance gate trigger.
--
-- The headline acceptance criterion in compliance.md §10:
--
--   > quotation.quote.sent is **blocked** if compliance.screening.failed
--   > for the customer (gate-test passes).
--
-- Wired here as a BEFORE-UPDATE-OF-status trigger on
-- public.quotation_versions. Fires only on the actual transition into
-- 'sent' (mirrors the AFTER-trigger from 20260530030000 that emits the
-- core.notifications row — but ours runs BEFORE so a block aborts the
-- update + skips the AFTER emit entirely).
--
-- Resolution chain:
--   quotation_versions.quote_id → quotes.account_id (== core.parties.id
--   for organization-type parties, established by the Phase 2 backfill
--   at 20260529030000) → compliance.is_party_blocked(tenant, party_id)
--   → RAISE EXCEPTION P0001 if true.
--
-- Idempotency: BEFORE the existing AFTER emit trigger means the saga
-- never fires for a blocked transition; the update is rejected so no
-- subsequent re-attempt without resolving the screening can succeed
-- either. The block message includes the screening id so the user can
-- jump to the officer-review UI.

CREATE OR REPLACE FUNCTION public.enforce_quote_sent_compliance_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, compliance, pg_catalog
AS $$
DECLARE
  v_account_id     uuid;
  v_blocked        boolean;
  v_screening_id   uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN
    RETURN NEW;
  END IF;

  SELECT q.account_id INTO v_account_id
  FROM public.quotes q
  WHERE q.id = NEW.quote_id;

  -- No customer to check against (quote draft without an account):
  -- nothing to gate. Let the transition through.
  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_blocked := compliance.is_party_blocked(NEW.tenant_id, v_account_id);

  IF v_blocked THEN
    -- Surface the most-recent failing screening so the user has a
    -- handle for the compliance officer to review (officer-review UI
    -- keys on this id).
    SELECT s.id INTO v_screening_id
    FROM compliance.screenings s
    LEFT JOIN public.leads l
      ON l.id = s.subject_id AND l.converted_account_id = v_account_id
    WHERE s.tenant_id = NEW.tenant_id
      AND s.status = 'failed'
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND (
        s.subject_party_id = v_account_id
        OR (s.subject_type = 'sales.lead' AND l.id IS NOT NULL)
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    RAISE EXCEPTION
      'COMPLIANCE_BLOCKED: cannot send quote — customer (account_id=%) has a failed compliance screening (screening_id=%). Resolve via /dashboard/compliance/screenings/% before retrying.',
      v_account_id, v_screening_id, v_screening_id
      USING ERRCODE = 'P0001',
            HINT = 'A compliance officer must mark the screening "override" or re-screen to a passing result before this quote can be sent.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_quote_sent_compliance_gate() IS
  'Phase 6 Step 23 — BEFORE-UPDATE gate on quotation_versions.status → sent. RAISES P0001 if compliance.is_party_blocked returns true for the quote''s account. Aborts the update + suppresses the AFTER emit trigger.';

DROP TRIGGER IF EXISTS trg_enforce_quote_sent_compliance_gate ON public.quotation_versions;
CREATE TRIGGER trg_enforce_quote_sent_compliance_gate
  BEFORE INSERT OR UPDATE OF status
  ON public.quotation_versions
  FOR EACH ROW
  WHEN (NEW.status = 'sent')
  EXECUTE FUNCTION public.enforce_quote_sent_compliance_gate();
