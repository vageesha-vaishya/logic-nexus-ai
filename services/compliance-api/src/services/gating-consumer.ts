// Phase 6 compliance-api — cross-module gating consumer (skeleton).
//
// This is the first cross-module *saga* in the platform (per master plan
// §7.4 + compliance.md §5). It subscribes to events that touch a party
// (lead created, quote about to send, booking created, payment created),
// runs a screening, and writes the result to compliance.screenings +
// compliance.records. Downstream modules read compliance.records before
// allowing the next state transition.
//
// Phase 6 Step 1 of the consumer:
//   - Poll core.v_cross_module_pending_events filtered to GATING_EVENT_TYPES.
//   - For each event, create a compliance.screenings row with status='pending'.
//   - Mark the outbox entry published (the screening row is the durable
//     side-effect; provider invocation happens in Step 2).
//
// Step 2 (next slice) wires actual providers (Dow Jones, World-Check) and
// transitions screenings from pending → passed/flagged/failed. Step 3
// adds compliance.records upserts + the downstream gate-read API.
//
// Idempotency: compliance.screenings will get a UNIQUE partial index on
// (tenant_id, subject_type, subject_id, triggered_by_event,
//  metadata->>'source_outbox_id') in the next migration; INSERT uses
// ON CONFLICT DO NOTHING so a re-run of the same outbox event is safe.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';
import { GATING_EVENT_TYPES, GatingEventType } from '../types/compliance.types.js';

const POLL_INTERVAL_MS = parseInt(process.env.COMPLIANCE_CONSUMER_POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.COMPLIANCE_CONSUMER_BATCH_SIZE || '50', 10);

interface OutboxEvent {
  id: string;
  tenant_id: string;
  module: string;
  event_type: string;
  entity_id: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

function isGatingEvent(eventType: string): eventType is GatingEventType {
  return (GATING_EVENT_TYPES as readonly string[]).includes(eventType);
}

function subjectTypeFor(eventType: GatingEventType): string {
  // Map event → screening subject_type. Mirrors compliance.md §3.
  switch (eventType) {
    case 'sales.lead.created':
      return 'sales.lead';
    case 'quotation.quote.send_requested':
      return 'quotation.quote';
    case 'logistics.booking.created':
      return 'logistics.booking';
    case 'finance.payment.created':
      return 'finance.payment';
  }
}

export class ComplianceGatingConsumer {
  private supabase: SupabaseClient | null = null;
  private running = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  start(): void {
    if (this.intervalHandle) return;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('gating consumer requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }
    this.supabase = createClient(url, key);
    logger.info('compliance gating consumer starting', { pollMs: POLL_INTERVAL_MS, batch: BATCH_SIZE });
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // Run one tick immediately so first events don't wait for the interval.
    void this.tick();
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running || !this.supabase) return;
    this.running = true;
    try {
      const { data: pending, error } = await (this.supabase as any)
        .schema('core')
        .from('v_cross_module_pending_events')
        .select('*')
        .in('event_type', GATING_EVENT_TYPES as readonly string[])
        .limit(BATCH_SIZE);
      if (error) {
        logger.warn('gating consumer poll error', { error: error.message });
        return;
      }
      const events = (pending as OutboxEvent[]) || [];
      if (events.length === 0) return;
      logger.info('gating consumer processing', { count: events.length });
      for (const evt of events) {
        await this.processEvent(evt);
      }
    } catch (err) {
      logger.error('gating consumer tick failed', err);
    } finally {
      this.running = false;
    }
  }

  private async processEvent(event: OutboxEvent): Promise<void> {
    if (!isGatingEvent(event.event_type)) return;
    const subjectType = subjectTypeFor(event.event_type);
    const partyId = (event.payload?.party_id as string | undefined) || null;

    try {
      const { error: insertErr } = await (this.supabase as any)
        .schema('compliance')
        .from('screenings')
        .insert({
          tenant_id: event.tenant_id,
          subject_type: subjectType,
          subject_id: event.entity_id,
          subject_party_id: partyId,
          triggered_by_event: event.event_type,
          status: 'pending',
          metadata: { source_outbox_id: event.id },
        });
      if (insertErr && !/duplicate key|already exists/i.test(insertErr.message || '')) {
        logger.warn('screening insert failed', { outboxId: event.id, error: insertErr.message });
        return;
      }

      const { error: markErr } = await (this.supabase as any)
        .schema('core')
        .from('outbox')
        .update({ published_at: new Date().toISOString() })
        .eq('id', event.id)
        .is('published_at', null);
      if (markErr) {
        logger.warn('outbox mark published failed', { outboxId: event.id, error: markErr.message });
      }
    } catch (err) {
      logger.error('processEvent failed', { outboxId: event.id, error: err });
    }
  }
}

export const complianceGatingConsumer = new ComplianceGatingConsumer();
