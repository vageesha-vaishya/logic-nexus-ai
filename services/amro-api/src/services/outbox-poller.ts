// Phase 8d — core.outbox → Kafka transactional outbox poller.
//
// Pattern: business code writes events to core.outbox in the SAME
// transaction as the domain mutation. This poller picks up unpublished
// rows and forwards to Kafka via the existing amroEventsProducer.
// On 2xx Kafka ack, stamps core.outbox.published_at. On Kafka failure,
// leaves the row unprocessed for the next tick.
//
// This closes the gap where the previous direct-publish pattern would
// lose events when Kafka was momentarily unavailable mid-write.

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { amroEventsProducer } from '../events/amro-events.producer.js';
import { AmroEventType } from '../events/amro-events.types.js';

const DEFAULT_TICK_LIMIT = 50;

export interface OutboxRow {
  id: string;
  tenant_id: string | null;
  module: string;
  entity_type: string;
  event_type: string;
  entity_id: string | null;
  occurred_at: string;
  version: number;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  published_at: string | null;
}

export interface OutboxTickOptions {
  supabase: SupabaseClient;
  limit?: number;
}

export interface OutboxTickResult {
  scanned: number;
  published: number;
  failed: number;
  errors: Array<{ outbox_id: string; reason: string }>;
}

/**
 * Drain one batch of unpublished `module='amro'` rows from core.outbox.
 * Never throws — per-row errors are captured in the result.
 */
export async function runAmroOutboxTick(
  options: OutboxTickOptions,
): Promise<OutboxTickResult> {
  const limit = options.limit ?? DEFAULT_TICK_LIMIT;
  const result: OutboxTickResult = {
    scanned: 0,
    published: 0,
    failed: 0,
    errors: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (options.supabase as any)
    .schema('core')
    .from('outbox')
    .select('*')
    .eq('module', 'amro')
    .is('published_at', null)
    .order('occurred_at', { ascending: true })
    .limit(limit);
  if (error) {
    logger.warn('amro outbox tick: list failed', { error: error.message });
    return result;
  }
  const rows = (data ?? []) as OutboxRow[];
  result.scanned = rows.length;

  for (const row of rows) {
    try {
      const tenantId = row.tenant_id ?? '';
      const userId = String((row.metadata ?? {}).user_id ?? '');
      const eventType = row.event_type as AmroEventType;
      // Route to entity-specific producer method based on event_type
      // prefix. The producer publishes to its dedicated Kafka topic.
      if (row.event_type.startsWith('amro.work_order')) {
        amroEventsProducer.publishWorkOrderEvent(tenantId, userId, eventType, row.payload);
      } else if (row.event_type.startsWith('amro.task')) {
        amroEventsProducer.publishTaskEvent(tenantId, userId, eventType, row.payload);
      } else if (row.event_type.startsWith('amro.maintenance')) {
        amroEventsProducer.publishMaintenanceEvent(tenantId, userId, row.payload);
      } else {
        throw new Error(`unknown event_type prefix: ${row.event_type}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (options.supabase as any)
        .schema('core')
        .from('outbox')
        .update({ published_at: new Date().toISOString() })
        .eq('id', row.id);
      if (updErr) {
        result.errors.push({ outbox_id: row.id, reason: `mark published failed: ${updErr.message}` });
        result.failed += 1;
      } else {
        result.published += 1;
        logger.info('amro outbox: published', {
          outbox_id: row.id,
          event_type: row.event_type,
          entity_type: row.entity_type,
        });
      }
    } catch (err) {
      result.errors.push({
        outbox_id: row.id,
        reason: err instanceof Error ? err.message : String(err),
      });
      result.failed += 1;
      logger.warn('amro outbox: publish failed, will retry next tick', {
        outbox_id: row.id,
        event_type: row.event_type,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}
