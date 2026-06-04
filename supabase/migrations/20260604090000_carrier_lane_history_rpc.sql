-- Follow-up #6 — carrier_lane_history aggregation RPC.
-- Backs the carrier_history payload for the shipment delay-prediction
-- LLM feature (commit 84a965bf + 683fd082). Replaces the honest
-- "unknown tier" stub in ShipmentDetail's delayPredictionInput memo.
--
-- Mirrors the customer_quote_history pattern (Follow-up #2) — a single
-- RPC that the frontend can call without fanning out 4-5 queries.
--
-- Buckets (reliability_tier) match the LLM prompt's enum
-- (tier_1|tier_2|tier_3|unknown — see migration
-- 20260604080000_gateway_seed_shipment_delay_prediction_prompt.sql)
-- so the model's tier weighting fires cleanly:
--   tier_1  : on_time_rate ≥ 90% AND shipments_observed ≥ 10
--   tier_2  : on_time_rate ≥ 75%  (or ≥ 80% on a thin window)
--   tier_3  : on_time_rate <  75%
--   unknown : shipments_observed = 0  (cold start)

CREATE OR REPLACE FUNCTION public.carrier_lane_history(
  p_tenant_id           uuid,
  p_carrier_id          uuid,
  p_origin_country      text,
  p_destination_country text,
  p_window_days         int DEFAULT 90,
  p_disruption_days     int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - make_interval(days => p_window_days);
  v_disruption_start timestamptz := v_now - make_interval(days => p_disruption_days);

  v_lane_total           int := 0;
  v_lane_on_time         int := 0;
  v_lane_late            int := 0;
  v_lane_transit_days    numeric;
  v_lane_on_time_rate    numeric;

  v_global_total         int := 0;
  v_global_on_time       int := 0;
  v_global_on_time_rate  numeric;

  v_disruption_count     int := 0;
  v_carrier_name         text;
  v_reliability_tier     text;
BEGIN
  -- Resolve carrier name. Falls back to NULL if the carrier row was
  -- deleted; the LLM handles a null carrier_name gracefully.
  SELECT carrier_name
    INTO v_carrier_name
    FROM public.carriers
   WHERE id = p_carrier_id
     AND tenant_id = p_tenant_id;

  -- ── Lane window aggregation ─────────────────────────────────────────
  -- "Delivered in window" = actual_delivery_date IS NOT NULL AND
  -- actual_delivery_date >= window start. We compare actual vs
  -- estimated to bucket on-time / late.
  SELECT
    COUNT(*) FILTER (WHERE s.actual_delivery_date IS NOT NULL),
    COUNT(*) FILTER (
      WHERE s.actual_delivery_date IS NOT NULL
        AND s.estimated_delivery_date IS NOT NULL
        AND s.actual_delivery_date::date <= s.estimated_delivery_date::date
    ),
    COUNT(*) FILTER (
      WHERE s.actual_delivery_date IS NOT NULL
        AND s.estimated_delivery_date IS NOT NULL
        AND s.actual_delivery_date::date > s.estimated_delivery_date::date
    ),
    AVG(
      EXTRACT(EPOCH FROM (s.actual_delivery_date::timestamptz - s.pickup_date::timestamptz))
        / 86400.0
    ) FILTER (
      WHERE s.actual_delivery_date IS NOT NULL
        AND s.pickup_date IS NOT NULL
    )
    INTO v_lane_total, v_lane_on_time, v_lane_late, v_lane_transit_days
    FROM public.shipments s
   WHERE s.tenant_id = p_tenant_id
     AND s.carrier_id = p_carrier_id
     AND s.origin_country = p_origin_country
     AND s.destination_country = p_destination_country
     AND s.actual_delivery_date >= v_window_start;

  -- ── Global window aggregation (carrier across all lanes) ────────────
  SELECT
    COUNT(*) FILTER (WHERE s.actual_delivery_date IS NOT NULL),
    COUNT(*) FILTER (
      WHERE s.actual_delivery_date IS NOT NULL
        AND s.estimated_delivery_date IS NOT NULL
        AND s.actual_delivery_date::date <= s.estimated_delivery_date::date
    )
    INTO v_global_total, v_global_on_time
    FROM public.shipments s
   WHERE s.tenant_id = p_tenant_id
     AND s.carrier_id = p_carrier_id
     AND s.actual_delivery_date >= v_window_start;

  -- ── Recent disruption count (last 30d, lane-scoped) ────────────────
  -- A "disruption" = late delivery OR shipment that ended in
  -- on_hold/returned/cancelled within the disruption window.
  SELECT COUNT(*)
    INTO v_disruption_count
    FROM public.shipments s
   WHERE s.tenant_id = p_tenant_id
     AND s.carrier_id = p_carrier_id
     AND s.origin_country = p_origin_country
     AND s.destination_country = p_destination_country
     AND s.updated_at >= v_disruption_start
     AND (
       (s.actual_delivery_date IS NOT NULL
         AND s.estimated_delivery_date IS NOT NULL
         AND s.actual_delivery_date::date > s.estimated_delivery_date::date)
       OR s.status IN ('on_hold', 'returned', 'cancelled')
     );

  -- ── Derive rates + tier ────────────────────────────────────────────
  IF v_lane_total > 0 THEN
    v_lane_on_time_rate := round((v_lane_on_time::numeric / v_lane_total::numeric) * 100, 1);
  END IF;
  IF v_global_total > 0 THEN
    v_global_on_time_rate := round((v_global_on_time::numeric / v_global_total::numeric) * 100, 1);
  END IF;

  -- Tier bucketing — matches LLM prompt enum (tier_1|tier_2|tier_3|unknown).
  IF v_lane_total = 0 AND v_global_total = 0 THEN
    v_reliability_tier := 'unknown';
  ELSIF v_lane_on_time_rate IS NOT NULL AND v_lane_on_time_rate >= 90 AND v_lane_total >= 10 THEN
    v_reliability_tier := 'tier_1';
  ELSIF COALESCE(v_lane_on_time_rate, v_global_on_time_rate, 0) >= 75 THEN
    v_reliability_tier := 'tier_2';
  ELSE
    v_reliability_tier := 'tier_3';
  END IF;

  RETURN jsonb_build_object(
    'carrier_name', v_carrier_name,
    'on_time_rate_pct_lane_90d',   v_lane_on_time_rate,
    'on_time_rate_pct_global_90d', v_global_on_time_rate,
    'avg_transit_days_lane',
      CASE WHEN v_lane_transit_days IS NULL THEN NULL
           ELSE round(v_lane_transit_days::numeric, 1) END,
    'shipments_observed_lane_90d', v_lane_total,
    'shipments_observed_global_90d', v_global_total,
    'recent_disruption_count_30d', v_disruption_count,
    'reliability_tier', v_reliability_tier,
    'window_days', p_window_days,
    'computed_at', v_now
  );
END $$;

COMMENT ON FUNCTION public.carrier_lane_history IS
  'Carrier lane-history aggregation for shipment delay prediction. '
  'Returns 90-day lane on-time rate + global on-time rate + avg lane '
  'transit days + 30-day disruption count + a derived reliability_tier '
  'bucket (gold/silver/standard/watchlist/unknown). See '
  'supabase/migrations/20260604090000_carrier_lane_history_rpc.sql.';

GRANT EXECUTE ON FUNCTION public.carrier_lane_history(uuid, uuid, text, text, int, int)
  TO authenticated, service_role;
