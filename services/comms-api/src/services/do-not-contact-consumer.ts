// Phase 6 Step 30b + Step 43b — comms-api do_not_contact consumer.
//
// CRM → comms suppression bridge. Subscribes to both
// crm.do_not_contact.set and crm.do_not_contact.cleared events from
// core.outbox, branches to the right RPC:
//
//   .set     → comms.upsert_do_not_contact_suppressions   (Step 30a)
//   .cleared → comms.remove_do_not_contact_suppressions   (Step 43a)
//
// Closes the bidirectional bridge — a customer who said "stop
// contacting me" gets every linked address suppressed; one who later
// says "actually contact me again" gets only their do_not_contact
// rows removed (bounce/complaint/unsubscribe survive).
//
// Same shape as the compliance gating-consumer (gating-consumer.ts):
// poll → per-event RPC → mark outbox published. TS is intentionally
// dumb; the address-resolution + diff work lives in the SQL fns.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { logger } from '../utils/logger.js';

const POLL_INTERVAL_MS = parseInt(process.env.COMMS_DNC_CONSUMER_POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.COMMS_DNC_CONSUMER_BATCH_SIZE || '50', 10);

const EVENT_TYPES = ['crm.do_not_contact.set', 'crm.do_not_contact.cleared'] as const;
type EventType = (typeof EVENT_TYPES)[number];

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

export class DoNotContactConsumer {
  private supabase: SupabaseClient | null = null;
  private running = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  start(): void {
    if (this.intervalHandle) return;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('do-not-contact consumer requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }
    this.supabase = createClient(url, key);
    logger.info('comms do-not-contact consumer starting', {
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
    if (this.running || !this.supabase) return;
    this.running = true;
    try {
      const { data: pending, error } = await (this.supabase as any)
        .schema('core')
        .from('v_cross_module_pending_events')
        .select('*')
        .in('event_type', EVENT_TYPES as readonly string[])
        .limit(BATCH_SIZE);
      if (error) {
        logger.warn('do-not-contact consumer poll error', { error: error.message });
        return;
      }
      const events = (pending as OutboxEvent[]) || [];
      if (events.length === 0) return;
      logger.info('do-not-contact consumer processing', { count: events.length });
      for (const evt of events) {
        await this.processEvent(evt);
      }
    } catch (err) {
      logger.error('do-not-contact consumer tick failed', err);
    } finally {
      this.running = false;
    }
  }

  private async processEvent(event: OutboxEvent): Promise<void> {
    const payload = event.payload ?? {};
    const partyId = payload.party_id as string | undefined;
    const partyKind = (payload.party_kind as string | undefined) ?? 'unknown';

    if (!partyId) {
      logger.warn('do-not-contact event missing party_id in payload', { outboxId: event.id });
      return;
    }

    // Branch on event type — set adds suppressions, cleared removes them.
    // Both RPCs take the same 4-arg signature for consumer symmetry.
    const isCleared = event.event_type === ('crm.do_not_contact.cleared' as EventType);
    const rpcName = isCleared
      ? 'remove_do_not_contact_suppressions'
      : 'upsert_do_not_contact_suppressions';

    try {
      const { data: rpcRows, error: rpcErr } = await (this.supabase as any)
        .schema('comms')
        .rpc(rpcName, {
          p_tenant_id: event.tenant_id,
          p_party_id: partyId,
          p_party_kind: partyKind,
          p_source_outbox_id: event.id,
        });
      if (rpcErr) {
        logger.warn('do-not-contact rpc failed', {
          rpc: rpcName,
          outboxId: event.id,
          error: rpcErr.message,
        });
        return;
      }
      const result = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      logger.info('do-not-contact suppressions changed', {
        outboxId: event.id,
        eventType: event.event_type,
        partyId,
        partyKind,
        // upsert returns inserted_count; remove returns deleted_count
        affectedCount: result?.inserted_count ?? result?.deleted_count,
        emailCount: result?.email_count,
        phoneCount: result?.phone_count,
      });

      const { error: markErr } = await (this.supabase as any)
        .schema('core')
        .from('outbox')
        .update({ published_at: new Date().toISOString() })
        .eq('id', event.id)
        .is('published_at', null);
      if (markErr) {
        logger.warn('do-not-contact outbox mark published failed', {
          outboxId: event.id,
          error: markErr.message,
        });
      }
    } catch (err) {
      logger.error('do-not-contact processEvent failed', { outboxId: event.id, error: err });
    }
  }
}

export const doNotContactConsumer = new DoNotContactConsumer();
