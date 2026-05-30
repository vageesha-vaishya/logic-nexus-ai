// Phase 6 comms-api — notification dispatcher.
//
// The platform's single fan-out point from core.notifications (intent) to
// comms.deliveries (per-channel attempt). Per master plan §6.0 + comms.md
// §1 + comms.md §5:
//
//   core.notifications holds INTENT ("tell user X about event Y").
//   comms.deliveries tracks DELIVERY ("an email went to addr@host at T").
//
// Step 3 of comms-api (this slice) — the read + fan-out half:
//   1. Poll core.notifications for rows that have no matching
//      comms.deliveries (LEFT JOIN, dispatched_at IS NULL proxy).
//   2. For each row, resolve recipients (recipient-resolver.ts).
//   3. Insert one comms.deliveries (status='pending') per channel per
//      recipient. The UNIQUE partial index added in migration
//      20260530020000 makes ON CONFLICT DO NOTHING safe.
//
// Step 4 (next slice) — the write half:
//   - Pick up pending deliveries, hand to provider, transition to
//     sent/delivered/failed, respect comms.suppressions, RFC 8058
//     List-Unsubscribe header. Per comms-infrastructure.md §4.1.
//
// Concurrency: single worker is the assumption. The UNIQUE index blocks
// double inserts so two workers running side-by-side are safe but redundant.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';
import { RecipientResolver } from './recipient-resolver.js';
import type { NotificationIntent } from '../types/comms.types.js';

const POLL_INTERVAL_MS = parseInt(process.env.COMMS_DISPATCHER_POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.COMMS_DISPATCHER_BATCH_SIZE || '50', 10);

export class NotificationDispatcher {
  private supabase: SupabaseClient | null = null;
  private resolver: RecipientResolver | null = null;
  private running = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  start(): void {
    if (this.intervalHandle) return;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('notification dispatcher requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }
    this.supabase = createClient(url, key);
    this.resolver = new RecipientResolver(this.supabase);
    logger.info('comms notification dispatcher starting', {
      pollMs: POLL_INTERVAL_MS,
      batch: BATCH_SIZE,
    });
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    void this.tick();
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running || !this.supabase || !this.resolver) return;
    this.running = true;
    try {
      const pending = await this.fetchPendingIntents();
      if (pending.length === 0) return;
      logger.info('dispatcher processing', { count: pending.length });
      for (const intent of pending) {
        await this.processIntent(intent);
      }
    } catch (err) {
      logger.error('dispatcher tick failed', err);
    } finally {
      this.running = false;
    }
  }

  private async fetchPendingIntents(): Promise<NotificationIntent[]> {
    if (!this.supabase) return [];
    // The "not yet dispatched" proxy: no comms.deliveries row exists with
    // this notification_id. We fetch the last batch by created_at and let
    // the dedup index drop already-dispatched ones at insert time. A
    // dedicated view (core.v_notifications_pending_dispatch) is a
    // follow-up if this becomes hot.
    const { data, error } = await (this.supabase as any)
      .schema('core')
      .from('notifications')
      .select('*')
      .is('dismissed_at', null)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (error) {
      logger.warn('dispatcher fetch error', { error: error.message });
      return [];
    }
    return (data as NotificationIntent[]) || [];
  }

  private async processIntent(intent: NotificationIntent): Promise<void> {
    if (!this.supabase || !this.resolver) return;
    const recipients = await this.resolver.resolve(intent);
    if (recipients.length === 0) {
      logger.info('dispatcher: no resolvable recipients', { notificationId: intent.id });
      return;
    }
    for (const recipient of recipients) {
      const { error } = await (this.supabase as any)
        .schema('comms')
        .from('deliveries')
        .insert({
          tenant_id: intent.tenant_id,
          notification_id: intent.id,
          channel_kind: recipient.channel,
          recipient_address: recipient.address,
          status: 'pending',
          subject_type: intent.subject_type,
          subject_id: intent.subject_id,
        });
      if (error && !/duplicate key|already exists|comms_deliveries_intent_dedup_idx/i.test(error.message || '')) {
        logger.warn('dispatcher: delivery insert failed', {
          notificationId: intent.id,
          channel: recipient.channel,
          error: error.message,
        });
      }
    }
  }
}

export const notificationDispatcher = new NotificationDispatcher();
