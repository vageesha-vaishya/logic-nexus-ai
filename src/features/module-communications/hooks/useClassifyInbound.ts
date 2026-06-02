// useClassifyInbound — calls llm-classify-inbound edge function.
// Returns the gateway-rendered comms.inbound.classify output:
// { intent, urgency, language, confidence, summary }.
// Same shape as useExplainHits + useScoreLead.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ClassifyInboundInput {
  message_id: string;
  message: { from: string; subject: string; body: string };
}

export type InboundIntent =
  | 'quote_request'
  | 'shipment_status'
  | 'complaint'
  | 'billing_question'
  | 'spam'
  | 'other';
export type InboundUrgency = 'low' | 'medium' | 'high' | 'urgent';

export interface ClassifyInboundOutput {
  intent: InboundIntent;
  urgency: InboundUrgency;
  language: string;
  confidence: number;
  summary: string;
}

export interface ClassifyInboundResult {
  message_id: string;
  invocation_id: string;
  output: ClassifyInboundOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function extractOutput(raw: unknown): ClassifyInboundOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.intent === 'string' &&
    typeof r.urgency === 'string' &&
    typeof r.language === 'string' &&
    typeof r.confidence === 'number' &&
    typeof r.summary === 'string'
  ) {
    return r as unknown as ClassifyInboundOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.intent && parsed?.urgency) return parsed as ClassifyInboundOutput;
    } catch { /* fall through */ }
  }
  return null;
}

export function useClassifyInbound() {
  return useMutation({
    mutationFn: async (
      input: ClassifyInboundInput,
    ): Promise<ClassifyInboundResult & { parsed_output: ClassifyInboundOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<ClassifyInboundResult>(
        'llm-classify-inbound',
        { body: input },
      );
      if (error) {
        logger.error({ event: 'classify_inbound.failed', message_id: input.message_id, err: String(error) });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-classify-inbound');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI classify failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
