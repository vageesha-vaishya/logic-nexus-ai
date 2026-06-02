// useScoreLead — calls llm-score-lead edge function. Returns the
// gateway-rendered sales.lead.score_evaluation prompt's structured
// output (ai_score 1-10 + stage_fit + reasoning + next_action).
// Same shape as useExplainHits.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ScoreLeadInput {
  lead_id: string;
  lead: {
    company_name: string;
    title?: string;
    industry?: string;
    estimated_value?: number;
    source?: string;
    rule_score?: number;
  };
  activity_count?: number;
  activities?: Array<Record<string, unknown>>;
}

export interface ScoreLeadOutput {
  ai_score: number;          // 1..10
  confidence: number;        // 0..1
  stage_fit:
    | 'discovery'
    | 'qualified'
    | 'proposal'
    | 'negotiation'
    | 'closed_won_likely'
    | 'closed_lost_likely';
  reasoning: string;
  next_action: string;
}

export interface ScoreLeadResult {
  lead_id: string;
  invocation_id: string;
  output: ScoreLeadOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function extractOutput(raw: unknown): ScoreLeadOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.ai_score === 'number' &&
    typeof r.confidence === 'number' &&
    typeof r.stage_fit === 'string' &&
    typeof r.reasoning === 'string' &&
    typeof r.next_action === 'string'
  ) {
    return r as unknown as ScoreLeadOutput;
  }
  // {text: "<json>"} envelope
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.ai_score != null) return parsed as ScoreLeadOutput;
    } catch { /* fall through */ }
  }
  return null;
}

export function useScoreLead() {
  return useMutation({
    mutationFn: async (input: ScoreLeadInput): Promise<ScoreLeadResult & { parsed_output: ScoreLeadOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<ScoreLeadResult>('llm-score-lead', { body: input });
      if (error) {
        logger.error({ event: 'score_lead.failed', lead_id: input.lead_id, err: String(error) });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-score-lead');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI rescore failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
