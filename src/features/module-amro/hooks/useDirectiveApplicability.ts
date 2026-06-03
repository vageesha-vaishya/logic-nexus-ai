// useDirectiveApplicability — frontend wrapper for the
// llm-directive-applicability edge function (shipped 2026-06-03,
// commit 6c9359f9). Given a directive + aircraft profile, the LLM
// returns a structured applicability verdict the operator UI can
// surface with evidence-of-applicability before commit.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface DirectiveInput {
  issuing_authority: string;
  directive_id: string;
  kind: string;
  title: string;
  effective_date: string;
  applies_to: string;
  compliance_action: string;
  relevant_ata_chapters?: string[];
}

export interface AircraftInput {
  manufacturer: string;
  model: string;
  serial_number: string;
  registration?: string;
  engines?: Array<{ manufacturer?: string; model?: string; serial_number?: string }>;
  configurations?: string[];
  hours_since_new?: number | null;
  cycles_since_new?: number | null;
}

export interface DirectiveApplicabilityInput {
  directive: DirectiveInput;
  aircraft: AircraftInput;
}

export interface DirectiveApplicabilityOutput {
  applies: boolean;
  confidence: number;
  reasoning: string;
  matched_criteria: string[];
  unmatched_criteria: string[];
  ata_chapters_touched: string[];
  recommended_followup: string;
}

export interface DirectiveApplicabilityResult {
  directive_id: string;
  aircraft_serial: string;
  invocation_id: string;
  output: DirectiveApplicabilityOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function extractOutput(raw: unknown): DirectiveApplicabilityOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.applies === 'boolean' &&
    typeof r.confidence === 'number' &&
    typeof r.reasoning === 'string' &&
    Array.isArray(r.matched_criteria) &&
    Array.isArray(r.unmatched_criteria) &&
    Array.isArray(r.ata_chapters_touched) &&
    typeof r.recommended_followup === 'string'
  ) {
    return {
      applies: r.applies,
      confidence: r.confidence,
      reasoning: r.reasoning,
      matched_criteria: r.matched_criteria as string[],
      unmatched_criteria: r.unmatched_criteria as string[],
      ata_chapters_touched: r.ata_chapters_touched as string[],
      recommended_followup: r.recommended_followup,
    };
  }
  // Some models occasionally double-encode JSON in `text`; try once.
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.applies !== undefined && typeof parsed?.reasoning === 'string') {
        return parsed as DirectiveApplicabilityOutput;
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useDirectiveApplicability() {
  return useMutation({
    mutationFn: async (
      input: DirectiveApplicabilityInput,
    ): Promise<DirectiveApplicabilityResult & { parsed_output: DirectiveApplicabilityOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<DirectiveApplicabilityResult>(
        'llm-directive-applicability',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'directive_applicability.failed',
          directive_id: input.directive.directive_id,
          aircraft_serial: input.aircraft.serial_number,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-directive-applicability');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI applicability check failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
