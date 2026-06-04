// useDraftReply — frontend wrapper for the llm-draft-reply Edge
// Function. Given an inbound message + its classification + operator
// context, drafts a reply (subject + body_markdown + body_plaintext)
// the operator can review and send.
//
// Operator-in-the-loop: this NEVER auto-sends. The panel shows the
// draft in an editable form; the operator hits "Use this draft"
// to populate the existing reply composer.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type {
  InboundIntent,
  InboundUrgency,
} from './useClassifyInbound';

export type DraftReplyTone = 'formal' | 'friendly' | 'firm';

export interface DraftReplyInboundMessage {
  from_name: string;
  from_email: string;
  subject: string;
  body: string;
  received_iso: string;
  language?: string | null;
}

export interface DraftReplyClassification {
  intent: InboundIntent;
  urgency: InboundUrgency;
  summary: string;
}

export interface DraftReplyThreadEntry {
  from: string;
  body: string;
  sent_iso: string;
}

export interface DraftReplyContext {
  operator_name: string;
  company_name: string;
  customer_name?: string | null;
  related_shipment_ids?: string[];
  related_quote_ids?: string[];
  signature_block?: string | null;
}

export interface DraftReplyInput {
  message_id: string;
  inbound: DraftReplyInboundMessage;
  classification: DraftReplyClassification;
  thread_history?: DraftReplyThreadEntry[];
  context: DraftReplyContext;
  tone?: DraftReplyTone;
  language?: string;
}

export type FollowUpActionType =
  | 'create_task'
  | 'escalate_to_manager'
  | 'attach_document'
  | 'schedule_callback'
  | 'request_info_from_ops'
  | 'none';

export interface FollowUpAction {
  action_type: FollowUpActionType;
  description: string;
  deadline_hint_hours: number | null;
}

export interface DraftReplyOutput {
  subject: string;
  body_markdown: string;
  body_plaintext: string;
  tone_used: DraftReplyTone;
  language: string;
  confidence: number;
  follow_up_actions: FollowUpAction[];
  internal_note: string;
  warnings: string[];
}

export interface DraftReplyResult {
  message_id: string;
  invocation_id: string;
  output: DraftReplyOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function isFollowUp(v: unknown): v is FollowUpAction {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.action_type === 'string' &&
    typeof r.description === 'string'
  );
}

function extractOutput(raw: unknown): DraftReplyOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.subject === 'string' &&
    typeof r.body_markdown === 'string' &&
    typeof r.body_plaintext === 'string' &&
    typeof r.tone_used === 'string' &&
    typeof r.language === 'string' &&
    typeof r.confidence === 'number' &&
    Array.isArray(r.follow_up_actions) && r.follow_up_actions.every(isFollowUp) &&
    typeof r.internal_note === 'string' &&
    Array.isArray(r.warnings)
  ) {
    return r as unknown as DraftReplyOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.body_markdown && parsed?.subject) return parsed as DraftReplyOutput;
    } catch { /* fall through */ }
  }
  return null;
}

export function useDraftReply() {
  return useMutation({
    mutationFn: async (
      input: DraftReplyInput,
    ): Promise<DraftReplyResult & { parsed_output: DraftReplyOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<DraftReplyResult>(
        'llm-draft-reply',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'draft_reply.failed',
          message_id: input.message_id,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-draft-reply');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI draft reply failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
