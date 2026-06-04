// useShipmentDelayPrediction — frontend wrapper for the
// llm-shipment-delay-prediction Edge Function (commit 84a965bf).
// Given a shipment + carrier history + lane conditions, predict
// P(breach) + slip hours + risk factors + mitigation options.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type ShipmentMode =
  | 'ocean_fcl' | 'ocean_lcl' | 'air' | 'road' | 'rail' | 'multimodal' | 'courier';

export type ShipmentStatus =
  | 'booked' | 'picked_up' | 'in_transit_origin' | 'departed_origin'
  | 'in_transit' | 'arrived_destination_port' | 'customs'
  | 'out_for_delivery' | 'delivered' | 'exception';

export type ReliabilityTier = 'tier_1' | 'tier_2' | 'tier_3' | 'unknown';
export type CongestionSignal = 'low' | 'medium' | 'high' | 'critical' | 'unknown';
export type WeatherDisruption = 'none' | 'watch' | 'active' | 'severe' | 'unknown';

export type DelayPredictionBand =
  | 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';

export type MitigationActionType =
  | 'carrier_escalation' | 'route_change' | 'expedite_customs'
  | 'alternate_carrier' | 'customer_notify_early' | 'buffer_inventory'
  | 'no_action_recommended';

export type FactorWeight = 'high' | 'medium' | 'low';
export type CostImpact = 'low' | 'medium' | 'high';

export interface ShipmentInput {
  shipment_id: string;
  mode: ShipmentMode;
  origin: { country: string; port_or_airport?: string | null };
  destination: { country: string; port_or_airport?: string | null };
  committed_delivery_iso: string;
  current_status: ShipmentStatus;
  last_known_location?: string | null;
  last_update_iso: string;
  days_in_transit_so_far: number;
  declared_value?: { amount: number; currency: string } | null;
  hazmat?: { is_hazmat: boolean; un_numbers: string[] } | null;
}

export interface CarrierHistoryInput {
  carrier_name?: string | null;
  on_time_rate_pct_lane_90d?: number | null;
  on_time_rate_pct_global_90d?: number | null;
  avg_transit_days_lane?: number | null;
  shipments_observed_lane_90d?: number | null;
  recent_disruption_count_30d: number;
  reliability_tier: ReliabilityTier;
}

export interface LaneConditionsInput {
  port_congestion_signal: CongestionSignal;
  weather_disruption: WeatherDisruption;
  customs_processing_delay_days?: number | null;
  holiday_or_strike_flag: boolean;
  alternative_routes_available: number;
}

export interface DelayPredictionInput {
  shipment: ShipmentInput;
  carrier_history: CarrierHistoryInput;
  lane_conditions: LaneConditionsInput;
}

export interface RiskFactor {
  factor: string;
  weight: FactorWeight;
  evidence: string;
}

export interface MitigationOption {
  action_type: MitigationActionType;
  specific_action: string;
  expected_delay_reduction_hours: number;
  cost_impact: CostImpact;
  deadline_to_act: string | null;
  rationale: string;
  confidence: number;
}

export interface DelayPredictionOutput {
  p_breach: number;
  p_breach_band: DelayPredictionBand;
  predicted_delay_hours: number;
  predicted_delivery_iso: string;
  confidence: number;
  risk_factors: RiskFactor[];
  positive_signals: RiskFactor[];
  mitigation_options: MitigationOption[];
  warnings: string[];
}

export interface DelayPredictionResult {
  invocation_id: string;
  output: DelayPredictionOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function isFactor(f: unknown): f is RiskFactor {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  return (
    typeof r.factor === 'string' &&
    typeof r.weight === 'string' &&
    typeof r.evidence === 'string'
  );
}

function isMitigation(m: unknown): m is MitigationOption {
  if (!m || typeof m !== 'object') return false;
  const r = m as Record<string, unknown>;
  return (
    typeof r.action_type === 'string' &&
    typeof r.specific_action === 'string' &&
    typeof r.expected_delay_reduction_hours === 'number' &&
    typeof r.cost_impact === 'string' &&
    typeof r.rationale === 'string' &&
    typeof r.confidence === 'number'
  );
}

function extractOutput(raw: unknown): DelayPredictionOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.p_breach === 'number' &&
    typeof r.p_breach_band === 'string' &&
    typeof r.predicted_delay_hours === 'number' &&
    typeof r.predicted_delivery_iso === 'string' &&
    typeof r.confidence === 'number' &&
    Array.isArray(r.risk_factors) && r.risk_factors.every(isFactor) &&
    Array.isArray(r.positive_signals) && r.positive_signals.every(isFactor) &&
    Array.isArray(r.mitigation_options) && r.mitigation_options.every(isMitigation) &&
    Array.isArray(r.warnings)
  ) {
    return r as unknown as DelayPredictionOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (typeof parsed?.p_breach === 'number' && parsed?.mitigation_options) {
        return parsed as DelayPredictionOutput;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useShipmentDelayPrediction() {
  return useMutation({
    mutationFn: async (
      input: DelayPredictionInput,
    ): Promise<DelayPredictionResult & { parsed_output: DelayPredictionOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<DelayPredictionResult>(
        'llm-shipment-delay-prediction',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'shipment_delay_prediction.failed',
          shipment_id: input.shipment.shipment_id,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-shipment-delay-prediction');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI delay prediction failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
