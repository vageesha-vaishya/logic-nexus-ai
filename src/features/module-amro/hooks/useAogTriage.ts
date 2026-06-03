// useAogTriage — frontend wrapper for the llm-aog-triage edge function
// (shipped 2026-06-03, commit 4700f8d1). Given an AOG alert + aircraft
// + fleet_context, the LLM returns a structured triage plan: priority,
// recommended actions ordered by deadline, parts to pre-order,
// escalation chain, MEL recommendation, safety flags.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type AogPriority =
  | 'P1_AOG_CRITICAL'
  | 'P2_AOG_URGENT'
  | 'P3_AOG_PLANNED'
  | 'P4_DEFER_MEL';

export type AogActionOwner =
  | 'ops_controller'
  | 'maintenance_lead'
  | 'stores'
  | 'procurement'
  | 'vendor_coordinator';

export interface AogAlertContext {
  alert_id: string;
  reported_at: string;
  airport_iata: string;
  airport_local_time?: string;
  reporter_role?: string;
  defect_summary: string;
  ata_chapter_code?: string;
  severity_signal?: string;
  related_warnings?: string[];
  mel_eligible?: boolean | null;
}

export interface AogAircraftContext {
  manufacturer?: string;
  model: string;
  serial_number: string;
  registration: string;
  hours_since_new?: number | null;
  cycles_since_new?: number | null;
  current_mel_deferrals?: string[];
}

export interface AogFleetContext {
  same_type_aircraft_nearby?: Array<{
    registration: string;
    airport_iata: string;
    status: string;
    distance_nm: number;
  }>;
  tools_at_airport?: string[];
  parts_at_airport?: Array<{ part_number: string; qty_available: number }>;
  station_capability?: 'self_handle' | 'vendor_required' | 'vendor_unavailable';
  sla_recovery_hours?: number;
}

export interface AogTriageInput {
  alert: AogAlertContext;
  aircraft: AogAircraftContext;
  fleet_context: AogFleetContext;
}

export interface AogRecommendedAction {
  action: string;
  owner_role: AogActionOwner;
  deadline_hours_from_now: number;
  blocking: boolean;
}

export interface AogPartToPreorder {
  part_number: string;
  qty: number;
  rationale: string;
  available_at_airport: boolean;
}

export interface AogMelRecommendation {
  consider_mel: boolean;
  mel_category: 'A' | 'B' | 'C' | 'D' | null;
  rationale: string;
}

export interface AogTriageOutput {
  priority: AogPriority;
  priority_rationale: string;
  estimated_recovery_hours: number;
  blocks_revenue_service: boolean;
  recommended_actions: AogRecommendedAction[];
  parts_to_preorder: AogPartToPreorder[];
  escalation_chain: string[];
  alternate_recovery_options: string[];
  mel_recommendation: AogMelRecommendation;
  safety_flags: string[];
  confidence: number;
}

export interface AogTriageResult {
  alert_id: string;
  invocation_id: string;
  output: AogTriageOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function isAogTriageOutput(raw: unknown): raw is AogTriageOutput {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.priority === 'string' &&
    typeof r.priority_rationale === 'string' &&
    typeof r.estimated_recovery_hours === 'number' &&
    typeof r.blocks_revenue_service === 'boolean' &&
    Array.isArray(r.recommended_actions) &&
    Array.isArray(r.parts_to_preorder) &&
    Array.isArray(r.escalation_chain) &&
    Array.isArray(r.alternate_recovery_options) &&
    typeof r.mel_recommendation === 'object' &&
    Array.isArray(r.safety_flags) &&
    typeof r.confidence === 'number'
  );
}

function extractOutput(raw: unknown): AogTriageOutput | null {
  if (isAogTriageOutput(raw)) return raw;
  if (raw && typeof raw === 'object' && typeof (raw as { text?: unknown }).text === 'string') {
    try {
      const parsed = JSON.parse((raw as { text: string }).text);
      if (isAogTriageOutput(parsed)) return parsed;
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useAogTriage() {
  return useMutation({
    mutationFn: async (
      input: AogTriageInput,
    ): Promise<AogTriageResult & { parsed_output: AogTriageOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<AogTriageResult>(
        'llm-aog-triage',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'aog_triage.failed',
          alert_id: input.alert.alert_id,
          aircraft_registration: input.aircraft.registration,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-aog-triage');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI AOG triage failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
