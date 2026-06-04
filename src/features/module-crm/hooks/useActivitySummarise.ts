// useActivitySummarise — frontend wrapper for the
// llm-activity-summarise Edge Function (commit 9021f152).
// Given subject + activity log + summary_window, returns a structured
// narrative summary for sales-prep / SDR handoff / renewal review.

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export type SubjectType = 'lead' | 'opportunity' | 'account' | 'contact';

export type ActivityType =
  | 'call' | 'email' | 'meeting' | 'note' | 'demo'
  | 'proposal_sent' | 'quote_sent' | 'task_completed'
  | 'stage_change' | 'other';

export type Audience = 'sdr_handoff' | 'am_prep' | 'manager_review' | 'renewal_prep';

export type Sentiment =
  | 'champion' | 'interested' | 'neutral' | 'cooling' | 'lost' | 'unknown';

export type StakeholderSentiment =
  | 'champion' | 'neutral' | 'skeptical' | 'blocker' | 'unknown';

export type Urgency = 'today' | 'this_week' | 'this_month' | 'watch';

export type Party = 'us' | 'prospect';

export type CommitmentStatus = 'open' | 'done' | 'overdue' | 'missed';

export interface SubjectInput {
  type: SubjectType;
  id: string;
  name: string;
  stage?: string | null;
  owner?: string | null;
}

export interface ActivityInput {
  activity_id: string;
  type: ActivityType;
  direction?: 'inbound' | 'outbound' | null;
  actor_role?: string | null;
  occurred_at: string;
  duration_minutes?: number | null;
  summary?: string | null;
  body: string;
  outcome?: string | null;
}

export interface SummaryWindowInput {
  max_activities_considered: number;
  earliest_iso?: string | null;
  audience: Audience;
}

export interface ActivitySummariseInput {
  subject: SubjectInput;
  activities: ActivityInput[];
  summary_window: SummaryWindowInput;
}

export interface CommitmentItem {
  party: Party;
  what: string;
  deadline_iso: string | null;
  status: CommitmentStatus;
  supporting_activity_id: string;
}

export interface StakeholderItem {
  name: string;
  role_or_title: string | null;
  side: 'us' | 'prospect' | 'third_party';
  sentiment: StakeholderSentiment;
}

export interface NextStepSuggestion {
  action: string;
  owner: Party;
  rationale: string;
  urgency: Urgency;
}

export interface ActivitySummariseOutput {
  headline: string;
  narrative: string;
  topics_covered: string[];
  commitments: CommitmentItem[];
  decisions_made: string[];
  blockers: string[];
  key_stakeholders_named: StakeholderItem[];
  sentiment_overall: Sentiment;
  sentiment_rationale: string;
  next_step_suggestion: NextStepSuggestion;
  redactions_made: string[];
  confidence: number;
}

export interface ActivitySummariseResult {
  invocation_id: string;
  output: ActivitySummariseOutput | { text?: string; [k: string]: unknown };
  cost_usd: number;
  latency_ms: number;
  warnings?: string[];
}

function extractOutput(raw: unknown): ActivitySummariseOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.headline === 'string' &&
    typeof r.narrative === 'string' &&
    Array.isArray(r.topics_covered) &&
    Array.isArray(r.commitments) &&
    Array.isArray(r.decisions_made) &&
    Array.isArray(r.blockers) &&
    Array.isArray(r.key_stakeholders_named) &&
    typeof r.sentiment_overall === 'string' &&
    typeof r.sentiment_rationale === 'string' &&
    r.next_step_suggestion && typeof r.next_step_suggestion === 'object' &&
    Array.isArray(r.redactions_made) &&
    typeof r.confidence === 'number'
  ) {
    return r as unknown as ActivitySummariseOutput;
  }
  if (typeof r.text === 'string') {
    try {
      const parsed = JSON.parse(r.text);
      if (parsed?.headline && parsed?.narrative) return parsed as ActivitySummariseOutput;
    } catch {
      /* fall through */
    }
  }
  return null;
}

export function useActivitySummarise() {
  return useMutation({
    mutationFn: async (
      input: ActivitySummariseInput,
    ): Promise<ActivitySummariseResult & { parsed_output: ActivitySummariseOutput | null }> => {
      const { data, error } = await supabase.functions.invoke<ActivitySummariseResult>(
        'llm-activity-summarise',
        { body: input },
      );
      if (error) {
        logger.error({
          event: 'activity_summarise.failed',
          subject_id: input.subject.id,
          subject_type: input.subject.type,
          activity_count: input.activities.length,
          err: String(error),
        });
        throw error;
      }
      if (!data) throw new Error('empty response from llm-activity-summarise');
      return { ...data, parsed_output: extractOutput(data.output) };
    },
    onError: (e: unknown) => {
      toast.error(`AI summary failed: ${(e as Error).message ?? 'unknown error'}`);
    },
  });
}
