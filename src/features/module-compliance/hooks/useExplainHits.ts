// useExplainHits — calls the llm-explain-hits edge function via the
// browser's supabase client (auto-attaches the user's JWT). Returns a
// React Query mutation that the ComplianceScreeningDetail page wires
// to the "Explain hits" button.
//
// The edge function does the actual gateway invocation; this hook is
// the thin browser-side glue that turns the response into typed UI state.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ExplainHitsInput {
  screening_id: string;
  party: { name: string; country: string; aliases?: string[] };
  hits: Array<{ list_name?: string; score?: number; matched_name?: string; [key: string]: unknown }>;
}

/** Shape of the gateway's structured response per the seeded prompt's output_schema. */
export interface ExplainHitsOutput {
  verdict: 'true_positive' | 'false_positive' | 'uncertain';
  confidence: number;
  reasoning: string;
}

export interface ExplainHitsResult {
  screening_id: string;
  invocation_id: string;
  output: ExplainHitsOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function extractOutput(raw: unknown): ExplainHitsOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  // Direct shape (provider returned structured JSON matching the schema):
  if (typeof r.verdict === 'string' && typeof r.confidence === 'number' && typeof r.reasoning === 'string') {
    return r as unknown as ExplainHitsOutput;
  }
  // Echo provider wraps the structured value inside output.echo for testing;
  // some adapters wrap as { text: "<json>" }. Try to parse from text.
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.verdict && typeof parsed.confidence === 'number' && parsed.reasoning) {
        return parsed as ExplainHitsOutput;
      }
    } catch { /* fall through */ }
  }
  return null;
}

export function useExplainHits() {
  return useMutation({
    mutationFn: async (input: ExplainHitsInput): Promise<ExplainHitsResult & { parsed_output: ExplainHitsOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<ExplainHitsResult>('llm-explain-hits', { body: input });
      if (error) {
        logger.error({ event: 'explain_hits.failed', screening_id: input.screening_id, err: String(error) });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-explain-hits');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`Explain failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
