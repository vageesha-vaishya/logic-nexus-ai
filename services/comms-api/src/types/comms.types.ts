// Phase 6 comms-api types.

export interface ErrorResponse {
  error: string;
  code: string;
  statusCode: number;
  path?: string;
  requestId?: string | null;
}

// core.notifications row (the intent layer the dispatcher reads).
export interface NotificationIntent {
  id: string;
  tenant_id: string;
  recipient_user_id: string | null;
  recipient_role_id: string | null;
  recipient_team_id: string | null;
  // Phase 6 Step 6 — customer/vendor recipient
  recipient_party_id: string | null;
  recipient_address: string | null;
  subject_type: string;
  subject_id: string;
  intent_kind: string;
  severity: NotificationSeverity;
  payload: Record<string, unknown>;
  read_at: string | null;
  dismissed_at: string | null;
  expires_at: string | null;
  correlation_id: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationSeverity = 'info' | 'warning' | 'urgent' | 'critical';

// comms.deliveries row shape (the per-channel delivery record).
export interface DeliveryRow {
  id: string;
  tenant_id: string;
  notification_id: string | null;
  channel_kind: ChannelKind;
  provider: string | null;
  provider_message_id: string | null;
  recipient_address: string | null;
  status: DeliveryStatus;
  bounce_kind: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  failed_at: string | null;
  error_text: string | null;
  subject_type: string | null;
  subject_id: string | null;
  // Phase 6 Step 10 — retry bookkeeping
  attempt_count: number;
  // NOT NULL with '-infinity' sentinel meaning "ready immediately".
  next_retry_at: string;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}

export type ChannelKind = 'email' | 'sms' | 'whatsapp' | 'slack' | 'push' | 'in_app';

export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'suppressed'
  | 'bounced'
  | 'complained';

// Resolved recipient address per channel — what the dispatcher hands to a provider.
export interface ResolvedRecipient {
  userId: string;
  channel: ChannelKind;
  address: string;       // email | phone | push_token | in_app user_id
  displayName?: string | null;
}
