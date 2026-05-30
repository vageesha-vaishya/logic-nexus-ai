// Phase 6 compliance-api types.

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  path?: string;
  requestId?: string | null;
}

// compliance.screenings row shape (canonical, post-Phase 6 Step 1).
export interface ScreeningRow {
  id: string;
  tenant_id: string;
  subject_type: string;          // 'core.party', 'sales.lead', 'quotation.quote', ...
  subject_id: string;
  subject_party_id: string | null;
  rule_id: string | null;
  triggered_by_event: string | null;
  provider: string | null;
  provider_request_id: string | null;
  status: ScreeningStatus;
  hits: unknown;
  decision: ScreeningDecision | null;
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_notes: string | null;
  evidence_file_ids: string[] | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScreeningStatus = 'pending' | 'passed' | 'flagged' | 'failed' | 'error';
export type ScreeningDecision = 'pass' | 'review_required' | 'fail';

// The events compliance-api subscribes to for gating decisions. Each one
// triggers a screening; downstream modules read the resulting decision
// from compliance.records before allowing their next state transition.
export const GATING_EVENT_TYPES = [
  'sales.lead.created',
  'quotation.quote.send_requested',
  'logistics.booking.created',
  'finance.payment.created',
] as const;

export type GatingEventType = (typeof GATING_EVENT_TYPES)[number];
