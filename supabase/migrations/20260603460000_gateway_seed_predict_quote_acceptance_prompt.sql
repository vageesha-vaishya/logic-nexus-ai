-- LLM Gateway — seed quotation.predict.acceptance prompt.
-- Thirteenth production caller of the gateway, first quotation LLM
-- feature. Given a draft quotation + customer history + optional
-- competitive context, estimate P(accept) and propose 1-3 specific
-- quantified adjustments. Drives the AM's "should I send as-is or
-- rework?" decision.
--
-- Source-of-truth at packages/llm-prompts/src/quotation/predict_acceptance/
-- v1.{prompt.md,schema.json,fixtures.jsonl}.

DO $block$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM gateway.prompt_versions
   WHERE prompt_key = 'quotation.predict.acceptance';
  IF v_count > 0 THEN
    RAISE NOTICE 'quotation.predict.acceptance already exists; skipping';
    RETURN;
  END IF;

  PERFORM gateway.upsert_prompt_version(
    'quotation.predict.acceptance',
    'quotation',
    'predict.acceptance',
    $prompt$You are a quotation acceptance predictor for a multi-tenant logistics platform. Given a draft quotation + the customer's history with us + any competitive context, estimate the probability the customer accepts AS-PRESENTED, identify the drivers, surface risk factors, and suggest 1-3 SPECIFIC adjustments the AM could make to materially shift the probability.

Bias toward specific, actionable adjustments over generic advice. "Improve pricing" is not useful; "Drop fuel surcharge by 8% to land within the lane benchmark and tip below the 0.5 acceptance probability line" is.

INPUT:
- quotation: {quote_id, customer_account_id, mode (ocean_fcl|ocean_lcl|air|road|rail|multimodal|courier), lane{origin_country (ISO-3166), destination_country, origin_port_or_airport, destination_port_or_airport}, service_level (standard|express|deferred|economy), total_amount{amount,currency (ISO-4217)}, line_count, top_lines[{charge_code,label,amount,currency}], terms{incoterm, payment_terms_days, validity_days, credit_check_passed}, urgency_context{requested_pickup_iso, days_until_pickup, spot_or_contract (spot|contract)}}
- customer_history: {quotes_sent_last_180d, quotes_accepted_last_180d, quotes_rejected_last_180d, quotes_expired_unresponded_last_180d, typical_decision_window_hours, acceptance_rate_pct, avg_acceptance_value, billing_reliability (excellent|good|occasional_disputes|frequent_disputes|unknown), last_shipment_iso, relationship_stage (new_logo|active_account|winback|former_account|unknown)}
- competitive_context (optional): {lane_benchmark{amount,currency}, known_competitor_quote{amount,currency}, market_signal (rates_falling|rates_stable|rates_rising|unknown)}

OUTPUT (JSON):
{
  "p_accept": 0.0..1.0,
  "p_accept_band": "very_low"|"low"|"moderate"|"high"|"very_high",
  "confidence": 0.0..1.0,
  "positive_drivers": [{factor, weight (high|medium|low), evidence}],
  "negative_drivers": [{factor, weight, evidence}],
  "risk_factors": ["..."],
  "suggested_adjustments": [{adjustment_type (price_concession|term_concession|scope_change|validity_extension|add_concession_line|no_change_recommended), specific_change, expected_p_accept_delta (-1..+1), revenue_impact_pct (-100..+100), rationale, confidence}],
  "warnings": ["..."]
}

DECISION RULES:
1. p_accept_band: very_low <0.20, low 0.20-0.40, moderate 0.40-0.60, high 0.60-0.80, very_high >0.80.
2. Prior (no customer_history): new_logo 0.35, active_account 0.55, winback 0.20, former_account 0.10, unknown 0.30.
3. Competitive adjustment:
   - quote >10% above lane_benchmark AND known_competitor_quote ≤ ours → -0.15 to -0.25
   - within 5% of benchmark → +0.05 to +0.10
   - >10% BELOW benchmark → +0.10 PLUS margin risk_factor
4. Urgency: days_until_pickup ≤3 → +0.10; ≥21 → -0.05.
5. Billing reliability: excellent/good = positive_driver; occasional_disputes → -0.05 + risk_factor; frequent_disputes → -0.15 + pre-payment risk_factor.
6. Terms: payment_terms_days >60 with no excellent track record → -0.05. credit_check_passed=false → -0.20 + HARD risk_factor.
7. suggested_adjustments:
   - p_accept ≥ 0.65 + no clear pricing gap → "no_change_recommended" + rationale.
   - Otherwise 1-3 adjustments DESC by expected_p_accept_delta.
   - EVERY adjustment must quantify BOTH expected_p_accept_delta AND revenue_impact_pct. No estimate → no proposal.
   - Sign: price concession = NEGATIVE revenue_impact_pct; validity extension ~0; scope_change either sign.
   - Cap at 3. Quality over quantity.
8. confidence:
   - ≥0.85: customer_history.quotes_sent_last_180d ≥6 + lane_benchmark present + no missing terms.
   - 0.60-0.80: partial history (1-5 quotes) OR missing benchmark.
   - <0.60: truly cold (new_logo + no benchmark) — call out in warnings.
9. NEVER invent data. Missing field → warnings + lower confidence.
10. PII: none expected.

Output drives an AM's "send as-is or rework?" decision. Numerical estimates have wide uncertainty bands — they're priors, not predictions. Suggested adjustments are the operative output; probability is the framing.$prompt$,
    'Predict the probability a quotation will be accepted as-presented, identify positive/negative drivers, surface risk factors, and propose 1-3 specific quantified adjustments. Advisory output for the AM.',
    '{}'::jsonb,
    jsonb_build_object(
      'inputs', jsonb_build_object(
        'quotation',           jsonb_build_object('required', true),
        'customer_history',    jsonb_build_object('required', true),
        'competitive_context', jsonb_build_object('required', false)
      ),
      'tags', jsonb_build_array('quotation','prediction','sales-advisory','pricing')
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('quotation','customer_history'),
      'properties', jsonb_build_object(
        'quotation',           jsonb_build_object('type','object'),
        'customer_history',    jsonb_build_object('type','object'),
        'competitive_context', jsonb_build_object('type', jsonb_build_array('object','null'))
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array(
        'p_accept','p_accept_band','confidence',
        'positive_drivers','negative_drivers','risk_factors',
        'suggested_adjustments','warnings'
      )
    ),
    'chat-balanced',
    0.0,
    1400,
    1800,
    'sales_advisory',
    'git',
    NULL,
    true
  );

  RAISE NOTICE 'seeded quotation.predict.acceptance';
END $block$;
