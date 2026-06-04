-- Follow-up #2 — customer_quote_history aggregation RPC.
--
-- Unblocks the PredictAcceptancePanel host insertion. The LLM
-- prediction takes a customer_history object with 180-day windowed
-- quote counts + acceptance rate + last shipment + relationship
-- stage. This function aggregates those numbers from public.quotes
-- and public.shipments in a single round-trip so the QuoteDetail UI
-- can drop the result straight into the panel input.
--
-- Tenancy: SECURITY INVOKER (callers run as authenticated user;
-- public.quotes already has tenant RLS so the function automatically
-- scopes by the caller's tenant). No service_role required.
--
-- Output is a single jsonb row matching the panel's
-- CustomerHistoryInput shape — caller passes it through.

CREATE OR REPLACE FUNCTION public.customer_quote_history(
  p_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public AS $$
DECLARE
  v_now             timestamptz := now();
  v_window_start    timestamptz := now() - interval '180 days';
  v_sent_180        int;
  v_accepted_180    int;
  v_rejected_180    int;
  v_expired_180     int;
  v_median_hours    numeric;
  v_acceptance_pct  numeric;
  v_avg_value       numeric;
  v_avg_currency    text;
  v_last_ship       date;
  v_first_quote     date;
  v_last_quote      date;
  v_relationship    text;
BEGIN
  -- Quote counts in 180-day window. "sent" = anything that left draft.
  -- Status 'sent' / 'accepted' / 'rejected' / 'expired' / 'cancelled' all
  -- imply the quote was visible to the customer.
  SELECT
    count(*) FILTER (WHERE q.created_at >= v_window_start AND q.status <> 'draft'),
    count(*) FILTER (WHERE q.accepted_at IS NOT NULL AND q.accepted_at >= v_window_start),
    count(*) FILTER (WHERE q.rejected_at IS NOT NULL AND q.rejected_at >= v_window_start),
    count(*) FILTER (WHERE q.status = 'expired' AND q.valid_until >= v_window_start
                       AND q.accepted_at IS NULL AND q.rejected_at IS NULL)
  INTO v_sent_180, v_accepted_180, v_rejected_180, v_expired_180
  FROM public.quotes q
  WHERE q.account_id = p_account_id;

  -- Typical decision window in hours: median of (accepted_at - created_at).
  -- Falls back to NULL when there are no accepted quotes (LLM uses base rate).
  SELECT percentile_cont(0.5) WITHIN GROUP (
           ORDER BY EXTRACT(EPOCH FROM (q.accepted_at - q.created_at)) / 3600.0
         )
  INTO v_median_hours
  FROM public.quotes q
  WHERE q.account_id = p_account_id
    AND q.accepted_at IS NOT NULL
    AND q.created_at  IS NOT NULL
    AND q.accepted_at >= v_window_start;

  -- Acceptance rate: accepted / (accepted + rejected + expired)
  -- Avoids divide-by-zero when no decisions exist.
  v_acceptance_pct := CASE
    WHEN (v_accepted_180 + v_rejected_180 + v_expired_180) > 0
    THEN ROUND(100.0 * v_accepted_180 / (v_accepted_180 + v_rejected_180 + v_expired_180), 1)
    ELSE NULL
  END;

  -- Average acceptance value + currency (modal currency of accepted quotes
  -- in the window). Returned only when at least one accepted quote exists.
  SELECT AVG(q.total_amount), MODE() WITHIN GROUP (ORDER BY q.currency)
  INTO v_avg_value, v_avg_currency
  FROM public.quotes q
  WHERE q.account_id = p_account_id
    AND q.accepted_at IS NOT NULL
    AND q.accepted_at >= v_window_start
    AND q.total_amount IS NOT NULL
    AND q.currency IS NOT NULL;

  -- Last shipment date (any status — delivered preferred but anything
  -- counts as "relationship still alive").
  SELECT MAX(COALESCE(s.actual_delivery_date::date, s.created_at::date))
  INTO v_last_ship
  FROM public.shipments s
  WHERE s.account_id = p_account_id;

  -- First and last quote dates (lifetime, not 180d) for relationship stage.
  SELECT MIN(q.created_at::date), MAX(q.created_at::date)
  INTO v_first_quote, v_last_quote
  FROM public.quotes q
  WHERE q.account_id = p_account_id;

  -- Relationship stage heuristic:
  --   new_logo:        first quote within last 90 days
  --   active_account:  last quote within last 90 days AND has accepted history
  --   winback:         last quote 90d-180d ago
  --   former_account:  no quote in 180d+ AND no shipment in 180d+
  --   unknown:         no quotes at all
  v_relationship := CASE
    WHEN v_first_quote IS NULL THEN 'unknown'
    WHEN v_first_quote >= v_now - interval '90 days' THEN 'new_logo'
    WHEN v_last_quote >= v_now - interval '90 days' AND v_accepted_180 > 0 THEN 'active_account'
    WHEN v_last_quote >= v_now - interval '180 days' THEN 'winback'
    ELSE 'former_account'
  END;

  RETURN jsonb_build_object(
    'quotes_sent_last_180d',              v_sent_180,
    'quotes_accepted_last_180d',          v_accepted_180,
    'quotes_rejected_last_180d',          v_rejected_180,
    'quotes_expired_unresponded_last_180d', v_expired_180,
    'typical_decision_window_hours',      v_median_hours,
    'acceptance_rate_pct',                v_acceptance_pct,
    'avg_acceptance_value',
      CASE
        WHEN v_avg_value IS NOT NULL AND v_avg_currency IS NOT NULL
        THEN jsonb_build_object('amount', v_avg_value, 'currency', v_avg_currency)
        ELSE NULL
      END,
    -- billing_reliability: derived from invoice/payment data we don't have
    -- reliably yet, so we surface 'unknown' as the honest default. A
    -- follow-up RPC can refine this once invoice payment SLAs are
    -- aggregated. Returning 'unknown' is one of the prompt's documented
    -- valid enum values (the LLM treats it as base-rate priors).
    'billing_reliability',                'unknown',
    'last_shipment_iso',
      CASE WHEN v_last_ship IS NOT NULL THEN to_jsonb(v_last_ship::text) ELSE NULL::jsonb END,
    'relationship_stage',                 v_relationship
  );
END $$;

COMMENT ON FUNCTION public.customer_quote_history(uuid) IS
  '180-day quote history aggregation for the quotation.predict.acceptance '
  'LLM feature. Returns a jsonb object matching the CustomerHistoryInput '
  'shape so the caller can pass it straight into the gateway invocation. '
  'SECURITY INVOKER — relies on public.quotes RLS for tenant scoping. '
  'billing_reliability is hardcoded "unknown" until invoice payment SLA '
  'aggregation lands; the LLM treats this as base-rate prior territory.';

GRANT EXECUTE ON FUNCTION public.customer_quote_history(uuid) TO authenticated, service_role;
