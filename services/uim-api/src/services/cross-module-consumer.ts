// ADR-0013 Step 65 — UIM cross-module consumer.
//
// Polls core.v_cross_module_pending_events for amro.work_order.parts_consumed
// events and writes the corresponding consumption entry into
// uim_inventory_ledger. Pattern mirrors finance-api +
// compliance-api + comms-api cross-module consumers (single tick
// loop, batch + per-event dispatch, retry RPC for failures).
//
// Event flow:
//   amro.work_order_materials.status='installed' (Step 64 emitter)
//     → core.outbox row with event_type='amro.work_order.parts_consumed'
//     → THIS CONSUMER picks it up
//     → uim_inventory_ledger INSERT (transaction_type='CONSUME')
//     → core.outbox.published_at stamped on success
//
// Idempotency: uim_inventory_ledger has no UNIQUE on source_outbox_id
// (it's append-only by design). We pre-check by metadata->>source_outbox_id
// before insert; if a row already exists the consumer marks the outbox
// published and moves on. Same idempotency guarantee as finance's
// UNIQUE constraint, just enforced in application code.
//
// Inventory-item resolution: AMRO emits part_number + manufacturer.
// We look up uim_catalog_items (tenant-scoped) by part_number +
// optional manufacturer match; then pick the most-recently-updated
// active uim_inventory_items row for that catalog_item. If we can't
// resolve, the event errors → retry. This is deliberate: we'd rather
// retry than silently swallow a consumption.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

const POLL_INTERVAL_MS = parseInt(process.env.UIM_CROSS_MODULE_POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.UIM_CROSS_MODULE_BATCH_SIZE || '50', 10);

const HANDLED_EVENT_TYPES = new Set(['amro.work_order.parts_consumed']);

interface OutboxEvent {
  id: string;
  tenant_id: string;
  module: string;
  event_type: string;
  entity_id: string;
  occurred_at: string;
  version: number;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

interface PartsConsumedPayload {
  id?: string;
  work_order_id?: string | null;
  part_number?: string | null;
  description?: string | null;
  manufacturer?: string | null;
  component_id?: string | null;
  quantity?: number | null;
  unit_of_measure?: string | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  currency?: string | null;
  batch_lot_number?: string | null;
  material_certification?: string | null;
  is_critical?: boolean | null;
}

export class UimCrossModuleConsumer {
  private _supabase: SupabaseClient | null = null;
  private get supabase(): SupabaseClient {
    if (!this._supabase) throw new Error('UIM cross-module consumer used before start()');
    return this._supabase;
  }
  private running = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  start(): void {
    if (this.intervalHandle) return;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('UIM cross-module consumer requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }
    this._supabase = createClient(url, key, { auth: { persistSession: false } });
    logger.info('UIM cross-module consumer starting', {
      pollIntervalMs: POLL_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      eventTypes: Array.from(HANDLED_EVENT_TYPES),
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

  // Exported so the slice can be tested without spinning up the timer.
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { data, error } = await this.supabase
        .schema('core')
        .from('v_cross_module_pending_events')
        .select('*')
        .limit(BATCH_SIZE);
      if (error) {
        logger.error('UIM cross-module consumer poll failed', { error: error.message });
        return;
      }
      if (!data || data.length === 0) return;
      // Filter to only what UIM handles — the view returns every chain's
      // events, and finance/compliance/comms each handle their own subset.
      const ours = (data as OutboxEvent[]).filter(e => HANDLED_EVENT_TYPES.has(e.event_type));
      if (ours.length === 0) return;
      logger.info('UIM cross-module consumer batch', { eventCount: ours.length });
      for (const row of ours) {
        try {
          await this.dispatch(row);
          await this.markRetryResolved(row.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error('UIM cross-module consumer dispatch failed', {
            outboxId: row.id,
            eventType: row.event_type,
            error: message,
          });
          await this.recordRetry(row, message);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async dispatch(event: OutboxEvent): Promise<void> {
    if (event.event_type === 'amro.work_order.parts_consumed') {
      await this.handlePartsConsumed(event);
    } else {
      // Shouldn't happen — tick() already filtered, but defend.
      logger.warn('UIM consumer skipping unexpected event', { eventType: event.event_type });
      return;
    }
    await this.markPublished(event.id);
  }

  private async handlePartsConsumed(event: OutboxEvent): Promise<void> {
    const payload = event.payload as PartsConsumedPayload;
    const quantity = numberOrNull(payload.quantity);
    if (quantity === null || quantity <= 0) {
      throw new Error(`parts_consumed payload missing/zero quantity (work_order=${payload.work_order_id})`);
    }
    if (!payload.part_number) {
      throw new Error(`parts_consumed payload missing part_number (work_order=${payload.work_order_id})`);
    }

    // Idempotency check: if any ledger row already references this
    // outbox.id we treat it as already-processed and short-circuit.
    const { data: existing, error: existingErr } = await this.supabase
      .from('uim_inventory_ledger')
      .select('id')
      .eq('tenant_id', event.tenant_id)
      .contains('metadata', { source_outbox_id: event.id })
      .limit(1);
    if (existingErr) {
      logger.warn('idempotency precheck failed; proceeding with insert', {
        outboxId: event.id,
        error: existingErr.message,
      });
    } else if (existing && existing.length > 0) {
      logger.info('parts_consumed ledger already exists for outbox, marking published', {
        outboxId: event.id,
        workOrderId: payload.work_order_id,
      });
      return;
    }

    // Resolve inventory_item_id via uim_catalog_items → uim_inventory_items.
    const inventoryItemId = await this.resolveInventoryItem(
      event.tenant_id,
      payload.part_number,
      payload.manufacturer ?? null,
    );

    const { error } = await this.supabase
      .from('uim_inventory_ledger')
      .insert({
        tenant_id: event.tenant_id,
        inventory_item_id: inventoryItemId,
        transaction_type: 'CONSUME',
        // Negative because CONSUME removes stock. Sign convention matches
        // the existing seed migrations (see e.g. 20260406142000_uim_amro_integration_seed.sql).
        quantity_changed: -quantity,
        referenced_module: 'amro',
        referenced_record_id: payload.work_order_id ?? null,
        metadata: {
          source_outbox_id: event.id,
          work_order_material_id: payload.id ?? null,
          part_number: payload.part_number,
          manufacturer: payload.manufacturer ?? null,
          unit_of_measure: payload.unit_of_measure ?? null,
          unit_cost: payload.unit_cost ?? null,
          total_cost: payload.total_cost ?? null,
          currency: payload.currency ?? null,
          batch_lot_number: payload.batch_lot_number ?? null,
          material_certification: payload.material_certification ?? null,
          is_critical: payload.is_critical ?? false,
          component_id: payload.component_id ?? null,
          consumed_at: event.occurred_at,
          consumed_by: 'uim-api.cross-module-consumer',
        },
      });

    if (error) {
      throw new Error(`CONSUME ledger insert failed: ${error.message}`);
    }

    logger.info('parts_consumed ledger entry created', {
      outboxId: event.id,
      workOrderId: payload.work_order_id,
      partNumber: payload.part_number,
      quantity,
      inventoryItemId,
    });
  }

  // Resolves the uim_inventory_items row to debit. Strategy:
  //  1. Find the matching uim_catalog_items by part_number (+ manufacturer
  //     when given). part_number is indexed and tenant-scoped.
  //  2. Pick the most-recently-updated uim_inventory_items row that's
  //     active for that catalog item.
  //  3. Throw if no match — the consumer will retry the event, giving
  //     ops time to fix the catalog/inventory before max_attempts.
  private async resolveInventoryItem(
    tenantId: string,
    partNumber: string,
    manufacturer: string | null,
  ): Promise<string> {
    let catalogQuery = this.supabase
      .from('uim_catalog_items')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('part_number', partNumber);
    if (manufacturer) {
      catalogQuery = catalogQuery.eq('manufacturer', manufacturer);
    }
    const { data: catalog, error: catalogErr } = await catalogQuery.limit(1).maybeSingle();
    if (catalogErr) {
      throw new Error(`catalog resolve failed for part_number=${partNumber}: ${catalogErr.message}`);
    }
    if (!catalog) {
      throw new Error(`no uim_catalog_items match for part_number=${partNumber} manufacturer=${manufacturer ?? 'any'}`);
    }

    const { data: inv, error: invErr } = await this.supabase
      .from('uim_inventory_items')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('catalog_item_id', catalog.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invErr) {
      throw new Error(`inventory_items resolve failed for catalog_item=${catalog.id}: ${invErr.message}`);
    }
    if (!inv) {
      throw new Error(`no uim_inventory_items for catalog_item=${catalog.id} (part_number=${partNumber})`);
    }
    return inv.id as string;
  }

  private async markPublished(outboxId: string): Promise<void> {
    const { error } = await this.supabase
      .schema('core')
      .from('outbox')
      .update({ published_at: new Date().toISOString() })
      .eq('id', outboxId);
    if (error) {
      logger.error('UIM consumer failed to stamp published_at', {
        outboxId,
        error: error.message,
      });
    }
  }

  private async recordRetry(event: OutboxEvent, errorMessage: string): Promise<void> {
    try {
      const { error } = await this.supabase.schema('core').rpc('record_outbox_retry', {
        p_outbox_id: event.id,
        p_tenant_id: event.tenant_id,
        p_error_message: errorMessage,
      });
      if (error) {
        logger.error('UIM consumer failed to record retry', {
          outboxId: event.id,
          error: error.message,
        });
      }
    } catch (err) {
      logger.error('UIM consumer record_outbox_retry threw', {
        outboxId: event.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async markRetryResolved(outboxId: string): Promise<void> {
    try {
      await this.supabase.schema('core').rpc('mark_outbox_resolved', { p_outbox_id: outboxId });
    } catch {
      // Same swallow as finance — outbox.published_at is the truth.
    }
  }
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export const uimCrossModuleConsumer = new UimCrossModuleConsumer();
