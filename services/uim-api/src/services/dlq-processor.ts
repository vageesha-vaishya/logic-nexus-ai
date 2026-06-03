// Phase 7 UIM Step 6 — webhook DLQ retry processor.
//
// Each tick:
//   1. SELECT * FROM uim.v_dlq_retryable LIMIT N   — view encapsulates
//      the "attempts < max_attempts AND ready_at <= now()" predicate
//      so this code stays declarative.
//   2. For each row, POST the payload to target_url with an HMAC-SHA256
//      signature header. The signing secret resolves from
//      UIM_WEBHOOK_DEFAULT_SECRET env var today; per-subscription
//      secret rotation via core.secrets ships in a later slice.
//   3. On 2xx: DELETE the DLQ row.
//   4. On 4xx (except 408 / 429): treat as permanent — leave attempts
//      at max_attempts so the row is no longer returned by the view.
//   5. On 5xx / network failure / 408 / 429: increment attempts +
//      bump last_failed_at; the view's backoff lookup auto-defers the
//      next attempt.
//
// Designed as a tickable function so it can be driven from a setInterval
// in index.ts, the LLM-gateway-pattern POST /dlq/process endpoint, or
// a test harness. No timers live here.

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';

const DEFAULT_TICK_LIMIT = 25;

export interface DlqRetryableRow {
  id: string;
  tenant_id: string | null;
  integration_id: string | null;
  subscription_id: string | null;
  payload: Record<string, unknown>;
  error: string | null;
  attempts: number;
  max_attempts: number;
  first_failed_at: string;
  last_failed_at: string;
  target_url: string | null;
  event_filter: unknown;
  signing_secret_id: string | null;
  retry_policy: unknown;
  ready_at: string;
}

export interface DlqDeliveryResult {
  ok: boolean;
  status?: number;
  errorText?: string;
  /** True for 4xx (excluding 408/429) — caller stops retrying. */
  permanent?: boolean;
}

export type DlqDeliveryFn = (row: DlqRetryableRow, signature: string) => Promise<DlqDeliveryResult>;

export interface DlqTickResult {
  scanned: number;
  delivered: number;
  retry_scheduled: number;
  retired_as_permanent: number;
  skipped_no_target: number;
  errors: Array<{ dlq_id: string; reason: string }>;
}

export interface RunDlqTickOptions {
  supabase: SupabaseClient;
  deliveryFn?: DlqDeliveryFn;
  limit?: number;
  /** Override hook for tests — defaults to UIM_WEBHOOK_DEFAULT_SECRET. */
  signingSecret?: string;
}

function signPayload(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function defaultDelivery(row: DlqRetryableRow, signature: string): Promise<DlqDeliveryResult> {
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
      },
      body: JSON.stringify(row.payload),
    });
    if (res.ok) return { ok: true, status: res.status };
    // 408 = request timeout, 429 = rate-limited → retry
    if (res.status === 408 || res.status === 429) {
      return { ok: false, status: res.status, errorText: `transient ${res.status}` };
    }
    // Any other 4xx is permanent
    if (res.status >= 400 && res.status < 500) {
      return { ok: false, status: res.status, errorText: `permanent ${res.status}`, permanent: true };
    }
    // 5xx and anything else
    return { ok: false, status: res.status, errorText: `server ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      errorText: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run a single polling tick over uim.v_dlq_retryable. Never throws —
 * provider errors are captured per-row and returned.
 */
export async function runDlqTick(options: RunDlqTickOptions): Promise<DlqTickResult> {
  const limit = options.limit ?? DEFAULT_TICK_LIMIT;
  const secret = options.signingSecret ?? process.env.UIM_WEBHOOK_DEFAULT_SECRET ?? '';
  const deliver = options.deliveryFn ?? defaultDelivery;
  const result: DlqTickResult = {
    scanned: 0,
    delivered: 0,
    retry_scheduled: 0,
    retired_as_permanent: 0,
    skipped_no_target: 0,
    errors: [],
  };

  const { data, error } = await (options.supabase as any)
    .schema('uim')
    .from('v_dlq_retryable')
    .select('*')
    .order('first_failed_at', { ascending: true })
    .limit(limit);
  if (error) {
    logger.warn('dlq tick: list failed', { error: error.message });
    return result;
  }
  const rows = (data ?? []) as DlqRetryableRow[];
  result.scanned = rows.length;

  for (const row of rows) {
    if (!row.target_url) {
      result.skipped_no_target += 1;
      continue;
    }
    if (!secret) {
      result.errors.push({ dlq_id: row.id, reason: 'UIM_WEBHOOK_DEFAULT_SECRET unset' });
      continue;
    }
    const body = JSON.stringify(row.payload);
    const signature = signPayload(secret, body);
    let outcome: DlqDeliveryResult;
    try {
      outcome = await deliver(row, signature);
    } catch (err) {
      outcome = {
        ok: false,
        errorText: err instanceof Error ? err.message : String(err),
      };
    }

    if (outcome.ok) {
      // Delete the row — the source-of-truth is the live integration_log
      // entry the producer wrote at delivery time.
      const { error: delErr } = await (options.supabase as any)
        .schema('platform')
        .from('integration_dlq')
        .delete()
        .eq('id', row.id);
      if (delErr) {
        result.errors.push({ dlq_id: row.id, reason: `delete failed: ${delErr.message}` });
      } else {
        result.delivered += 1;
        logger.info('dlq tick: delivered', { id: row.id, attempts: row.attempts + 1, status: outcome.status });
      }
      continue;
    }

    // Failure — increment attempts + bump last_failed_at. When
    // outcome.permanent, jump attempts to max so the view stops
    // returning the row.
    const nextAttempts = outcome.permanent ? row.max_attempts : row.attempts + 1;
    const { error: updErr } = await (options.supabase as any)
      .schema('platform')
      .from('integration_dlq')
      .update({
        attempts: nextAttempts,
        last_failed_at: new Date().toISOString(),
        error: (outcome.errorText ?? row.error ?? 'unknown error').slice(0, 4000),
      })
      .eq('id', row.id);
    if (updErr) {
      result.errors.push({ dlq_id: row.id, reason: `update failed: ${updErr.message}` });
      continue;
    }
    if (outcome.permanent) {
      result.retired_as_permanent += 1;
      logger.info('dlq tick: retired permanent', { id: row.id, error: outcome.errorText });
    } else {
      result.retry_scheduled += 1;
      logger.info('dlq tick: retry scheduled', {
        id: row.id,
        next_attempt: nextAttempts,
        error: outcome.errorText,
      });
    }
  }

  return result;
}
