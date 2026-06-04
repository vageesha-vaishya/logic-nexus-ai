// useChargesSuggestion — frontend wrapper for the llm-charges-suggestion
// Edge Function (commit c842b902). Given a shipment + carrier + optional
// tariff hints, returns a complete operator-reviewable charge spine
// with magnitudes, rationale, and incoterm-driven payable_by allocation.
//
// Non-modal: structured JSON only, no attachments.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type ShipmentMode =
  | 'ocean_fcl' | 'ocean_lcl' | 'air' | 'road' | 'rail' | 'multimodal' | 'courier';

export type ChargeCode =
  | 'freight' | 'fuel_surcharge' | 'security_surcharge'
  | 'handling_origin' | 'handling_destination'
  | 'thc_origin' | 'thc_destination'
  | 'documentation' | 'customs_filing_origin' | 'customs_filing_destination'
  | 'ams_aci_ens' | 'isps' | 'war_risk'
  | 'hazmat_surcharge' | 'temperature_control'
  | 'container_seal' | 'vgm' | 'wharfage' | 'delivery_order'
  | 'demurrage_risk_reserve' | 'detention_risk_reserve'
  | 'pickup' | 'delivery' | 'insurance'
  | 'duties_taxes_pass_through' | 'fumigation' | 'inspection' | 'other';

export type ChargeBasis =
  | 'flat' | 'per_kg' | 'per_cbm' | 'per_container'
  | 'percent_of_value' | 'per_shipment' | 'per_document';

export type PayableBy = 'shipper' | 'consignee' | 'third_party' | 'per_incoterm';

export interface ShipmentInput {
  shipment_id: string;
  mode: ShipmentMode;
  origin: { country: string; port_or_airport?: string | null; city?: string | null };
  destination: { country: string; port_or_airport?: string | null; city?: string | null };
  packages: {
    total_pieces?: number | null;
    total_weight_kg?: number | null;
    total_volume_m3?: number | null;
    chargeable_weight_kg?: number | null;
  };
  containers?: Array<{ type: string; count: number }> | null;
  hazmat: { is_hazmat: boolean; un_numbers: string[]; imdg_class?: string | null };
  temp_controlled: { required: boolean; range_celsius?: string | null };
  incoterm?: string | null;
  currency: string;
  declared_value?: { amount?: number | null; currency?: string | null };
  line_items: Array<{
    description: string;
    hs_code?: string | null;
    qty: number;
    weight_kg?: number | null;
  }>;
  service_terms: {
    door_pickup: boolean;
    door_delivery: boolean;
    customs_clearance: 'origin' | 'destination' | 'both' | 'neither';
  };
}

export interface CarrierInput {
  name?: string | null;
  type?: 'ocean_carrier' | 'airline' | 'trucking' | 'freight_forwarder' | 'courier' | null;
  service_level?: 'standard' | 'express' | 'deferred' | 'economy' | null;
}

export interface TariffHints {
  lane_avg_charges?: Array<{ charge_code: string; amount: number; currency: string }> | null;
  last_invoiced_on_lane?: string | null;
  fuel_surcharge_pct?: number | null;
}

export interface ChargesSuggestionInput {
  shipment: ShipmentInput;
  carrier: CarrierInput;
  tariff_hints?: TariffHints | null;
}

export interface SuggestedCharge {
  charge_code: ChargeCode;
  label: string;
  amount: number;
  currency: string;
  basis: ChargeBasis;
  basis_qty: number | null;
  rate: number | null;
  payable_by: PayableBy;
  rationale: string;
  confidence: number;
}

export interface ChargesSuggestionOutput {
  currency: string;
  suggested_charges: SuggestedCharge[];
  total_estimate: { amount: number; currency: string };
  incoterm_split: { shipper_pays: number; consignee_pays: number; rationale: string };
  risk_flags: string[];
  warnings: string[];
  confidence: number;
}

export interface ChargesSuggestionResult {
  invocation_id: string;
  output: ChargesSuggestionOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function isCharge(c: unknown): c is SuggestedCharge {
  if (!c || typeof c !== 'object') return false;
  const r = c as Record<string, unknown>;
  return (
    typeof r.charge_code === 'string' &&
    typeof r.label === 'string' &&
    typeof r.amount === 'number' &&
    typeof r.currency === 'string' &&
    typeof r.basis === 'string' &&
    typeof r.payable_by === 'string' &&
    typeof r.rationale === 'string' &&
    typeof r.confidence === 'number'
  );
}

function extractOutput(raw: unknown): ChargesSuggestionOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.currency === 'string' &&
    Array.isArray(r.suggested_charges) &&
    r.suggested_charges.every(isCharge) &&
    r.total_estimate && typeof r.total_estimate === 'object' &&
    r.incoterm_split && typeof r.incoterm_split === 'object' &&
    Array.isArray(r.risk_flags) &&
    Array.isArray(r.warnings) &&
    typeof r.confidence === 'number'
  ) {
    return r as unknown as ChargesSuggestionOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.suggested_charges && parsed?.total_estimate) {
        return parsed as ChargesSuggestionOutput;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useChargesSuggestion() {
  return useMutation({
    mutationFn: async (
      input: ChargesSuggestionInput,
    ): Promise<ChargesSuggestionResult & { parsed_output: ChargesSuggestionOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<ChargesSuggestionResult>(
        'llm-charges-suggestion',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'charges_suggestion.failed',
          shipment_id: input.shipment.shipment_id,
          mode: input.shipment.mode,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-charges-suggestion');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI charges suggestion failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
