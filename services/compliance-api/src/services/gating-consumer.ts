// Phase 6 compliance-api — cross-module gating consumer.
//
// First cross-module saga in the platform (master plan §7.4 +
// compliance.md §5). Subscribes to events that touch a party (lead
// created, quote about to send, booking created, payment created),
// runs a screening via compliance.screen_subject, marks the source
// outbox event published.
//
// Phase 6 Step 22 split:
//   22a — compliance.screen_subject(...) SECURITY DEFINER fn does the
//         insert-or-noop + screen + decision-tier work in one txn
//         (migration 20260531000300).
//   22b — this TS shrinks to a 3-step loop per event: derive screening
//         args from payload → call screen_subject rpc → mark outbox
//         published.
//
// The unique partial index on (metadata->>'source_outbox_id') from
// Step 14's realign (20260530130000) is what makes re-polling after a
// mid-tick crash safe — screen_subject's ON CONFLICT branch reuses
// the existing pending row instead of double-inserting.

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

// Pull a screening search_name and country out of the event payload.
// Step 19's emitter sets these explicitly; later emitters for
// quote.send_requested / booking.created / payment.created may carry a
// different shape — accept any of search_name | company | name as the
// label, and country_code | country as the jurisdiction.
function extractScreeningInputs(payload: Record<string, unknown>): {
  searchName: string | null;
  countryCode: string | null;
} {
  const pick = (k: string): string | null => {
    const v = payload?.[k];
    return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
  };
  return {
    searchName: pick('search_name') ?? pick('company') ?? pick('name'),
    countryCode: pick('country_code') ?? pick('country'),
  };
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
    const payload = event.payload ?? {};
    const partyId = (payload.party_id as string | undefined) || null;
    const { searchName, countryCode } = extractScreeningInputs(payload);

    try {
      // Step 22a — one RPC call does the insert-or-noop + screen +
      // decision-tier work inside a Postgres txn. Returns a single row
      // with the terminal status; we log and move on.
      const { data: decisionRows, error: rpcErr } = await (this.supabase as any)
        .schema('compliance')
        .rpc('screen_subject', {
          p_tenant_id: event.tenant_id,
          p_subject_type: subjectType,
          p_subject_id: event.entity_id,
          p_subject_party_id: partyId,
          p_triggered_by_event: event.event_type,
          p_source_outbox_id: event.id,
          p_search_name: searchName,
          p_country_code: countryCode,
        });
      if (rpcErr) {
        logger.warn('screen_subject rpc failed', { outboxId: event.id, error: rpcErr.message });
        return;
      }
      const decision = Array.isArray(decisionRows) ? decisionRows[0] : decisionRows;
      logger.info('screening decided', {
        outboxId: event.id,
        eventType: event.event_type,
        screeningId: decision?.screening_id,
        status: decision?.status,
        hitCount: decision?.hit_count,
        maxSimilarity: decision?.max_similarity,
      });

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
