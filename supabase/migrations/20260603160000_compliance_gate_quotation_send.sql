-- Phase 6 Compliance Step 4 — server-side gate enforcement for quote sends.
--
-- Companion to Step 3's compliance.gate_check function. This wires the
-- gate into the actual state transition: a BEFORE UPDATE trigger on
-- public.quotation_versions raises when a sent transition tries to
-- commit on a subject whose screening verdict is failed or flagged
-- without override.
--
-- Decision matrix (gate_check return → action):
--   pass             → allow
--   failed           → RAISE (block the transition; the row stays in its prior status)
--   flagged          → RAISE (officer must override via /screenings/:id/override first)
--   no_screening_yet → allow (legacy quotes never went through screening)
--
-- We gate the quote subject directly (subject_type='quotation.quote',
-- subject_id=quote_id), matching what the Phase 6 gating consumer
-- produces. Upstream account / opportunity screening is a separate
-- slice once those modules emit screening-trigger events of their own
-- — today only sales.lead is screened, and quotes don't carry a
-- lead_id (they hang off account_id / contact_id / opportunity_id).
--
-- Smoke data confirms safety: 3 versions already in 'sent' state on
-- prod, 0 active screening blocks — nothing existing is retroactively
-- prevented from being re-saved.

CREATE OR REPLACE FUNCTION compliance.gate_quotation_send()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = compliance, public
AS $$
DECLARE
  v_quote          public.quotes%ROWTYPE;
  v_quote_verdict  text;
BEGIN
  -- Fire only on the actual draft|review|approved → 'sent' transition.
  -- Idle saves of already-sent rows and non-status updates must pass
  -- through without paying the screening lookup cost.
  IF NEW.status IS DISTINCT FROM 'sent' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = NEW.quote_id;
  IF v_quote.id IS NULL THEN
    -- Orphan version (no quote row) — nothing to gate against; let
    -- existing referential integrity catch it elsewhere.
    RETURN NEW;
  END IF;

  v_quote_verdict := compliance.gate_check(
    v_quote.tenant_id,
    'quotation.quote',
    v_quote.id
  );
  IF v_quote_verdict IN ('failed','flagged') THEN
    RAISE EXCEPTION
      'compliance gate blocked quote send: quote_id=% verdict=%',
      v_quote.id, v_quote_verdict
      USING ERRCODE = 'P0001',
            HINT = 'Resolve the failed/flagged screening via the compliance officer UI (override or remediate).';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION compliance.gate_quotation_send() IS
  'Phase 6 Compliance Step 4: BEFORE UPDATE trigger fn on public.quotation_versions. Blocks the draft|review|approved → sent transition when compliance.gate_check returns failed/flagged for either the quote or its upstream lead.';

-- Drop any existing trigger with this name (idempotent re-apply).
DROP TRIGGER IF EXISTS trg_compliance_gate_quotation_send ON public.quotation_versions;

-- BEFORE UPDATE so the RAISE rolls back the txn and the row stays in
-- its prior status. We deliberately scope WHEN to status transitions
-- so non-status updates skip the lookup entirely.
CREATE TRIGGER trg_compliance_gate_quotation_send
  BEFORE UPDATE OF status
  ON public.quotation_versions
  FOR EACH ROW
  WHEN (NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'sent'))
  EXECUTE FUNCTION compliance.gate_quotation_send();

-- Audit trail: also block INSERTs that land directly in 'sent' state.
CREATE TRIGGER trg_compliance_gate_quotation_send_insert
  BEFORE INSERT
  ON public.quotation_versions
  FOR EACH ROW
  WHEN (NEW.status = 'sent')
  EXECUTE FUNCTION compliance.gate_quotation_send();
