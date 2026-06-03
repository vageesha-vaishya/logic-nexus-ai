// Phase 7 UIM Step 6 follow-up — outbound webhook outbox + dispatcher.
//
// The Step 6 DLQ retry processor only ever retried rows that
// already existed in uim.integration_dlq — it had no producer
// surface to write the first delivery attempt FROM. This module
// is that surface.
//
// Producer side (enqueueWebhookEvent):
//   - Resolves the active uim.webhook_subscriptions whose
//     event_filter.events array includes the given event_type
//     (or whose event_filter is empty, treated as "all events").
//   - Inserts one uim.webhook_outbox row per matching subscription
//     with status='pending'.
//
// Dispatcher side (runOutboxDispatchTick):
//   - SELECT * FROM uim.v_outbox_pending LIMIT N (joined view of
//     pending rows + their active subscriptions).
//   - HMAC-SHA256 sign the payload + POST to target_url with the
//     same headers as the DLQ delivery (X-UIM-Signature,
//     X-UIM-Delivery-Id, X-UIM-Attempt).
//   - On 2xx: mark outbox row delivered.
//   - On permanent 4xx (excl 408/429): mark outbox row failed.
//   - On transient (5xx / network / 408 / 429): bump attempts,
//     and if max_attempts reached escalate to uim.integration_dlq
//     so the existing Step 6 retry processor picks up with
//     exponential backoff. Mark outbox row failed.
//
// Escalating to the DLQ keeps backoff logic in one place — this
// module owns first-attempt delivery, the DLQ processor owns
// retry with backoff.

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';
import { getConnector } from '../connectors/registry.js';

const DEFAULT_TICK_LIMIT = 25;
const DEFAULT_MAX_ATTEMPTS = 1;
const DLQ_DEFAULT_MAX_ATTEMPTS = 5;

export type EnqueueResult = {
  matched: number;
  enqueued: number;
  outbox_ids: string[];
};

export interface OutboxPendingRow {
  id: string;
  tenant_id: string;
  subscription_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  created_at: string;
  target_url: string | null;
  signing_secret_id: string | null;
  event_filter: unknown;
  subscription_status: string | null;
  integration_id: string | null;
  vendor: string | null;
  integration_name: string | null;
  integration_direction: string | null;
}

export interface OutboxDeliveryResult {
  ok: boolean;
  status?: number;
  errorText?: string;
  /** 4xx (excluding 408/429) — caller stops retrying immediately. */
  permanent?: boolean;
}

export type OutboxDeliveryFn = (
  row: OutboxPendingRow,
  signature: string,
) => Promise<OutboxDeliveryResult>;

export interface RunOutboxTickOptions {
  supabase: SupabaseClient;
  deliveryFn?: OutboxDeliveryFn;
  limit?: number;
  signingSecret?: string;
}

export interface OutboxTickResult {
  scanned: number;
  delivered: number;
  retired_permanent: number;
  escalated_to_dlq: number;
  retried_in_outbox: number;
  errors: Array<{ outbox_id: string; reason: string }>;
}

// Subscription row shape we need for fan-out — narrow enough to keep
// the query small.
interface SubscriptionFanoutRow {
  id: string;
  tenant_id: string;
  event_filter: { events?: unknown } | null;
  status: string;
}

function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function subscriptionMatchesEvent(
  filter: { events?: unknown } | null,
  eventType: string,
): boolean {
  if (!filter) return true;
  const events = (filter as { events?: unknown }).events;
  // Empty / missing events array → fan out (subscribed to all).
  if (!Array.isArray(events) || events.length === 0) return true;
  return events.some((value) => typeof value === 'string' && value === eventType);
}

/**
 * Enqueue a domain event into the outbox for every active
 * subscription that matches event_type. Returns matched +
 * enqueued counts so the caller can confirm fan-out happened.
 */
export async function enqueueWebhookEvent(input: {
  supabase: SupabaseClient;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  scheduledAt?: string;
  maxAttempts?: number;
  subscriptionId?: string;
}): Promise<EnqueueResult> {
  const result: EnqueueResult = { matched: 0, enqueued: 0, outbox_ids: [] };

  // Narrow by tenant + active. Single-subscription dispatch skips
  // the fan-out by selecting a specific row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = (input.supabase as any)
    .schema('uim')
    .from('webhook_subscriptions')
    .select('id, tenant_id, event_filter, status')
    .eq('tenant_id', input.tenantId)
    .eq('status', 'active');
  if (input.subscriptionId) {
    query = query.eq('id', input.subscriptionId);
  }

  const { data: subs, error: subsError } = await query;
  if (subsError) {
    throw new Error(`Failed to resolve subscriptions for fan-out: ${subsError.message}`);
  }
  const rows = (subs ?? []) as SubscriptionFanoutRow[];
  result.matched = rows.length;

  const matching = rows.filter((row) => subscriptionMatchesEvent(row.event_filter, input.eventType));
  if (matching.length === 0) return result;

  const insertRows = matching.map((sub) => ({
    tenant_id: input.tenantId,
    subscription_id: sub.id,
    event_type: input.eventType,
    payload: input.payload,
    status: 'pending',
    attempts: 0,
    max_attempts: Math.max(1, input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
    scheduled_at: input.scheduledAt ?? new Date().toISOString(),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insertError } = await (input.supabase as any)
    .schema('uim')
    .from('webhook_outbox')
    .insert(insertRows)
    .select('id');
  if (insertError) {
    throw new Error(`Failed to insert outbox rows: ${insertError.message}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result.outbox_ids = ((inserted as any) || []).map((row: { id: string }) => String(row.id));
  result.enqueued = result.outbox_ids.length;
  return result;
}

async function defaultDelivery(
  row: OutboxPendingRow,
  signature: string,
): Promise<OutboxDeliveryResult> {
  // Connector registry takes precedence over raw HTTP POST.
  // When uim.integrations.vendor matches a registered adapter, the
  // adapter's dispatch() handles transport (which can include
  // anything from SDK calls to multi-step orchestration). HTTP
  // POST stays as the default for connectors with no registered
  // adapter — useful for one-off webhook URLs.
  const adapter = getConnector(row.vendor);
  if (adapter && row.integration_id) {
    try {
      return await adapter.dispatch(
        { type: row.event_type, payload: row.payload },
        {
          tenantId: row.tenant_id,
          integrationId: row.integration_id,
          vendorName: row.integration_name,
          vendorCode: row.vendor,
          config: null,
        },
      );
    } catch (err) {
      return {
        ok: false,
        errorText: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (!row.target_url) {
    return { ok: false, errorText: 'target_url missing', permanent: true };
  }
  try {
    const res = await fetch(row.target_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-UIM-Signature': signature,
        'X-UIM-Delivery-Id': row.id,
        'X-UIM-Attempt': String(row.attempts + 1),
        'X-UIM-Event-Type': row.event_type,
      },
      body: JSON.stringify(row.payload),
    });
    if (res.ok) return { ok: true, status: res.status };
    if (res.status === 408 || res.status === 429) {
      return { ok: false, status: res.status, errorText: `transient ${res.status}` };
    }
    if (res.status >= 400 && res.status < 500) {
      return { ok: false, status: res.status, errorText: `permanent ${res.status}`, permanent: true };
    }
    return { ok: false, status: res.status, errorText: `server ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      errorText: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * One polling tick over uim.v_outbox_pending. Never throws —
 * provider errors are captured per row.
 *
 * Behavior:
 *  - 2xx           → mark delivered.
 *  - permanent 4xx → mark failed (terminal).
 *  - transient     → bump attempts. If max_attempts reached,
 *                    escalate to uim.integration_dlq (Step 6
 *                    processor takes over with backoff) and mark
 *                    failed. Otherwise leave pending for the next
 *                    tick.
 */
export async function runOutboxDispatchTick(
  options: RunOutboxTickOptions,
): Promise<OutboxTickResult> {
  const limit = options.limit ?? DEFAULT_TICK_LIMIT;
  const secret = options.signingSecret ?? process.env.UIM_WEBHOOK_DEFAULT_SECRET ?? '';
  const deliver = options.deliveryFn ?? defaultDelivery;
  const result: OutboxTickResult = {
    scanned: 0,
    delivered: 0,
    retired_permanent: 0,
    escalated_to_dlq: 0,
    retried_in_outbox: 0,
    errors: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (options.supabase as any)
    .schema('uim')
    .from('v_outbox_pending')
    .select('*')
    .limit(limit);
  if (error) {
    logger.warn('outbox tick: list failed', { error: error.message });
    return result;
  }
  const rows = (data ?? []) as OutboxPendingRow[];
  result.scanned = rows.length;

  for (const row of rows) {
    // Skip only if BOTH the adapter registry and target_url are
    // empty — adapter-only connectors don't need a target_url.
    if (!row.target_url && !getConnector(row.vendor)) {
      result.errors.push({
        outbox_id: row.id,
        reason: 'no delivery path: target_url missing and no registered adapter',
      });
      continue;
    }
    if (!secret) {
      result.errors.push({ outbox_id: row.id, reason: 'UIM_WEBHOOK_DEFAULT_SECRET unset' });
      continue;
    }

    const body = JSON.stringify(row.payload);
    const signature = signPayload(secret, body);
    let outcome: OutboxDeliveryResult;
    try {
      outcome = await deliver(row, signature);
    } catch (err) {
      outcome = {
        ok: false,
        errorText: err instanceof Error ? err.message : String(err),
      };
    }

    const nowIso = new Date().toISOString();

    if (outcome.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (options.supabase as any)
        .schema('uim')
        .from('webhook_outbox')
        .update({
          status: 'delivered',
          attempts: row.attempts + 1,
          last_attempted_at: nowIso,
          delivered_at: nowIso,
        })
        .eq('id', row.id);
      if (updErr) {
        result.errors.push({ outbox_id: row.id, reason: `mark delivered failed: ${updErr.message}` });
      } else {
        result.delivered += 1;
        logger.info('outbox tick: delivered', {
          id: row.id,
          attempts: row.attempts + 1,
          status: outcome.status,
        });
      }
      continue;
    }

    if (outcome.permanent) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (options.supabase as any)
        .schema('uim')
        .from('webhook_outbox')
        .update({
          status: 'failed',
          attempts: row.attempts + 1,
          last_attempted_at: nowIso,
          last_error: (outcome.errorText ?? 'permanent').slice(0, 4000),
        })
        .eq('id', row.id);
      if (updErr) {
        result.errors.push({ outbox_id: row.id, reason: `mark failed-permanent failed: ${updErr.message}` });
      } else {
        result.retired_permanent += 1;
        logger.info('outbox tick: retired permanent', { id: row.id, error: outcome.errorText });
      }
      continue;
    }

    // Transient — bump attempts on the outbox row. If we've hit
    // max_attempts, escalate to the DLQ for backoff retry.
    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= row.max_attempts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dlqErr } = await (options.supabase as any)
        .schema('platform')
        .from('integration_dlq')
        .insert({
          tenant_id: row.tenant_id,
          subscription_id: row.subscription_id,
          payload: row.payload,
          error: (outcome.errorText ?? 'unknown error').slice(0, 4000),
          attempts: 0,
          max_attempts: DLQ_DEFAULT_MAX_ATTEMPTS,
          first_failed_at: nowIso,
          last_failed_at: nowIso,
        });
      if (dlqErr) {
        result.errors.push({
          outbox_id: row.id,
          reason: `escalate to dlq failed: ${dlqErr.message}`,
        });
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (options.supabase as any)
        .schema('uim')
        .from('webhook_outbox')
        .update({
          status: 'failed',
          attempts: nextAttempts,
          last_attempted_at: nowIso,
          last_error: `escalated-to-dlq: ${(outcome.errorText ?? 'unknown error').slice(0, 3900)}`,
        })
        .eq('id', row.id);
      if (updErr) {
        result.errors.push({
          outbox_id: row.id,
          reason: `mark failed-after-dlq failed: ${updErr.message}`,
        });
        continue;
      }
      result.escalated_to_dlq += 1;
      logger.info('outbox tick: escalated to dlq', {
        outbox_id: row.id,
        tenant_id: row.tenant_id,
        subscription_id: row.subscription_id,
        error: outcome.errorText,
      });
      continue;
    }

    // Still has attempts left — leave pending. The dispatcher will
    // pick it up on the next tick.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (options.supabase as any)
      .schema('uim')
      .from('webhook_outbox')
      .update({
        attempts: nextAttempts,
        last_attempted_at: nowIso,
        last_error: (outcome.errorText ?? 'transient').slice(0, 4000),
      })
      .eq('id', row.id);
    if (updErr) {
      result.errors.push({ outbox_id: row.id, reason: `bump attempts failed: ${updErr.message}` });
      continue;
    }
    result.retried_in_outbox += 1;
    logger.info('outbox tick: transient, kept pending', {
      id: row.id,
      attempts: nextAttempts,
      max_attempts: row.max_attempts,
      error: outcome.errorText,
    });
  }

  return result;
}
