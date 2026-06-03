// Phase 7 UIM Step 8.5 — DlqRetryableRow type.
//
// Backed by uim.v_dlq_retryable view. Joined view of
// uim.integration_dlq + uim.webhook_subscriptions so callers see
// the target_url + signing context alongside the failure metadata
// in one query (mirrors how the dlq processor reads it).

import { builder } from '../builder.js';

export type DlqRetryableRowShape = {
  id: string;
  tenant_id: string | null;
  subscription_id: string | null;
  target_url: string | null;
  attempts: number;
  max_attempts: number;
  first_failed_at: string;
  last_failed_at: string;
  ready_at: string;
  error: string | null;
};

export const DlqRetryableRowRef =
  builder.objectRef<DlqRetryableRowShape>('DlqRetryableRow');

builder.objectType(DlqRetryableRowRef, {
  description: 'A single uim.integration_dlq row that is past its backoff window and still has attempts left.',
  fields: (t) => ({
    id: t.exposeID('id'),
    tenantId: t.id({ nullable: true, resolve: (p) => p.tenant_id }),
    subscriptionId: t.id({ nullable: true, resolve: (p) => p.subscription_id }),
    targetUrl: t.string({ nullable: true, resolve: (p) => p.target_url }),
    attempts: t.int({ resolve: (p) => Number(p.attempts || 0) }),
    maxAttempts: t.int({ resolve: (p) => Number(p.max_attempts || 0) }),
    firstFailedAt: t.field({ type: 'DateTime', resolve: (p) => p.first_failed_at }),
    lastFailedAt: t.field({ type: 'DateTime', resolve: (p) => p.last_failed_at }),
    readyAt: t.field({ type: 'DateTime', resolve: (p) => p.ready_at }),
    error: t.string({ nullable: true, resolve: (p) => p.error }),
  }),
});
