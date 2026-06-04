// usePredictQuoteAcceptance — frontend wrapper for the
// llm-predict-quote-acceptance Edge Function (commit 2f8f4316).
// Given a draft quotation + customer history + optional competitive
// context, returns P(accept) + drivers + risk factors + 1-3 specific
// quantified adjustments.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type Mode =
  | 'ocean_fcl' | 'ocean_lcl' | 'air' | 'road' | 'rail' | 'multimodal' | 'courier';

export type ServiceLevel = 'standard' | 'express' | 'deferred' | 'economy';

export type RelationshipStage =
  | 'new_logo' | 'active_account' | 'winback' | 'former_account' | 'unknown';

export type BillingReliability =
  | 'excellent' | 'good' | 'occasional_disputes' | 'frequent_disputes' | 'unknown';

export type MarketSignal =
  | 'rates_falling' | 'rates_stable' | 'rates_rising' | 'unknown';

export type AcceptanceBand =
  | 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';

export type AdjustmentType =
  | 'price_concession' | 'term_concession' | 'scope_change'
  | 'validity_extension' | 'add_concession_line' | 'no_change_recommended';

export type DriverWeight = 'high' | 'medium' | 'low';

export interface QuotationInput {
  quote_id: string;
  customer_account_id: string;
  mode: Mode;
  lane: {
    origin_country: string;
    destination_country: string;
    origin_port_or_airport?: string | null;
    destination_port_or_airport?: string | null;
  };
  service_level: ServiceLevel;
  total_amount: { amount: number; currency: string };
  line_count: number;
  top_lines: Array<{
    charge_code: string;
    label: string;
    amount: number;
    currency: string;
  }>;
  terms: {
    incoterm?: string | null;
    payment_terms_days: number;
    validity_days: number;
    credit_check_passed: boolean;
  };
  urgency_context: {
    requested_pickup_iso?: string | null;
    days_until_pickup?: number | null;
    spot_or_contract: 'spot' | 'contract';
  };
}

export interface CustomerHistoryInput {
  quotes_sent_last_180d: number;
  quotes_accepted_last_180d: number;
  quotes_rejected_last_180d: number;
  quotes_expired_unresponded_last_180d: number;
  typical_decision_window_hours?: number | null;
  acceptance_rate_pct?: number | null;
  avg_acceptance_value?: { amount: number; currency: string } | null;
  billing_reliability: BillingReliability;
  last_shipment_iso?: string | null;
  relationship_stage: RelationshipStage;
}

export interface CompetitiveContextInput {
  lane_benchmark?: { amount: number; currency: string } | null;
  known_competitor_quote?: { amount: number; currency: string } | null;
  market_signal?: MarketSignal | null;
}

export interface PredictAcceptanceInput {
  quotation: QuotationInput;
  customer_history: CustomerHistoryInput;
  competitive_context?: CompetitiveContextInput | null;
}

export interface Driver {
  factor: string;
  weight: DriverWeight;
  evidence: string;
}

export interface SuggestedAdjustment {
  adjustment_type: AdjustmentType;
  specific_change: string;
  expected_p_accept_delta: number;
  revenue_impact_pct: number;
  rationale: string;
  confidence: number;
}

export interface PredictAcceptanceOutput {
  p_accept: number;
  p_accept_band: AcceptanceBand;
  confidence: number;
  positive_drivers: Driver[];
  negative_drivers: Driver[];
  risk_factors: string[];
  suggested_adjustments: SuggestedAdjustment[];
  warnings: string[];
}

export interface PredictAcceptanceResult {
  invocation_id: string;
  output: PredictAcceptanceOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function isDriver(d: unknown): d is Driver {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.factor === 'string' &&
    typeof r.weight === 'string' &&
    typeof r.evidence === 'string'
  );
}

function isAdjustment(a: unknown): a is SuggestedAdjustment {
  if (!a || typeof a !== 'object') return false;
  const r = a as Record<string, unknown>;
  return (
    typeof r.adjustment_type === 'string' &&
    typeof r.specific_change === 'string' &&
    typeof r.expected_p_accept_delta === 'number' &&
    typeof r.revenue_impact_pct === 'number' &&
    typeof r.rationale === 'string' &&
    typeof r.confidence === 'number'
  );
}

function extractOutput(raw: unknown): PredictAcceptanceOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.p_accept === 'number' &&
    typeof r.p_accept_band === 'string' &&
    typeof r.confidence === 'number' &&
    Array.isArray(r.positive_drivers) && r.positive_drivers.every(isDriver) &&
    Array.isArray(r.negative_drivers) && r.negative_drivers.every(isDriver) &&
    Array.isArray(r.risk_factors) &&
    Array.isArray(r.suggested_adjustments) && r.suggested_adjustments.every(isAdjustment) &&
    Array.isArray(r.warnings)
  ) {
    return r as unknown as PredictAcceptanceOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (typeof parsed?.p_accept === 'number' && parsed?.suggested_adjustments) {
        return parsed as PredictAcceptanceOutput;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function usePredictQuoteAcceptance() {
  return useMutation({
    mutationFn: async (
      input: PredictAcceptanceInput,
    ): Promise<PredictAcceptanceResult & { parsed_output: PredictAcceptanceOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<PredictAcceptanceResult>(
        'llm-predict-quote-acceptance',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'predict_quote_acceptance.failed',
          quote_id: input.quotation.quote_id,
          customer_account_id: input.quotation.customer_account_id,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-predict-quote-acceptance');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI prediction failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
