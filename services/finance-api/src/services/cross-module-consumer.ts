// Phase 5 cross-module consumer.
//
// Polls core.v_cross_module_pending_events on an interval, dispatches
// each event to the appropriate handler, and stamps core.outbox.
// published_at once the side effect lands.
//
// Two chains:
//   1. sales.opportunity.won       → finance.commissions row
//   2. logistics.shipment.delivered → finance.invoices draft row
//
// Idempotency:
//   - finance.commissions has UNIQUE (source_outbox_id) — the INSERT
//     uses ON CONFLICT DO NOTHING; same outbox.id can't double-create.
//   - finance.invoices has a UNIQUE partial index on
//     (metadata->>'source_outbox_id') — same protection.
//
// Concurrency model: single-worker is the assumption. Two consumers
// running in parallel would still be safe (UNIQUE keys block double
// inserts) but might do redundant work. A SELECT FOR UPDATE SKIP LOCKED
// upgrade is a follow-up if we need multi-worker fanout.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

const POLL_INTERVAL_MS = parseInt(process.env.FINANCE_CONSUMER_POLL_INTERVAL_MS || '5000', 10);
const BATCH_SIZE = parseInt(process.env.FINANCE_CONSUMER_BATCH_SIZE || '50', 10);
const COMMISSION_RATE_PERCENT = parseFloat(process.env.FINANCE_COMMISSION_RATE_PERCENT || '5');

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

interface OpportunityPayload {
  opportunity_id: string;
  amount?: number | null;
  expected_revenue?: number | null;
  account_id?: string | null;
  contact_id?: string | null;
  lead_id?: string | null;
  owner_id?: string | null;
  currency?: string | null;
  name?: string | null;
  close_date?: string | null;
}

interface ShipmentPayload {
  shipment_id: string;
  shipment_number?: string | null;
  account_id?: string | null;
  contact_id?: string | null;
  carrier_id?: string | null;
  vendor_id?: string | null;
  quote_id?: string | null;
  booking_id?: string | null;
  total_charges?: number | null;
  currency?: string | null;
  actual_delivery_date?: string | null;
  port_of_loading?: string | null;
  port_of_discharge?: string | null;
}

export class CrossModuleConsumer {
  private supabase: SupabaseClient;
  private running = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new Error('cross-module consumer requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    }
    this.supabase = createClient(url, key, { auth: { persistSession: false } });
  }

  start(): void {
    if (this.intervalHandle) return;
    logger.info('cross-module consumer starting', {
      pollIntervalMs: POLL_INTERVAL_MS,
      batchSize: BATCH_SIZE,
      commissionRatePercent: COMMISSION_RATE_PERCENT,
    });
    this.intervalHandle = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS);
    // First tick immediately so backfilled events get picked up without
    // waiting one poll interval.
    void this.tick();
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return; // Avoid overlap when work outlasts the interval.
    this.running = true;
    try {
      const { data, error } = await this.supabase
        .schema('core')
        .from('v_cross_module_pending_events')
        .select('*')
        .limit(BATCH_SIZE);
      if (error) {
        logger.error('cross-module consumer poll failed', { error: error.message });
        return;
      }
      if (!data || data.length === 0) return;
      logger.info('cross-module consumer batch', { eventCount: data.length });
      for (const row of data as OutboxEvent[]) {
        try {
          await this.dispatch(row);
        } catch (err) {
          logger.error('cross-module consumer dispatch failed', {
            outboxId: row.id,
            eventType: row.event_type,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async dispatch(event: OutboxEvent): Promise<void> {
    if (event.event_type === 'sales.opportunity.won') {
      await this.handleOpportunityWon(event);
    } else if (event.event_type === 'logistics.shipment.delivered') {
      await this.handleShipmentDelivered(event);
    } else {
      logger.warn('cross-module consumer skipping unknown event', { eventType: event.event_type });
      return;
    }
    await this.markPublished(event.id);
  }

  private async handleOpportunityWon(event: OutboxEvent): Promise<void> {
    const payload = event.payload as unknown as OpportunityPayload;
    const baseAmount = numberOrNull(payload.expected_revenue) ?? numberOrNull(payload.amount) ?? 0;

    // Resolve commission rate via the per-tenant rules table. The
    // resolver returns NULL when no rule matches; fall back to env
    // default (FINANCE_COMMISSION_RATE_PERCENT, 5%).
    const { rate: ruleRate, ruleId } = await this.resolveCommissionRate(
      event.tenant_id,
      payload.owner_id ?? null,
      payload.account_id ?? null,
      event.occurred_at,
    );
    const ratePercent = ruleRate ?? COMMISSION_RATE_PERCENT;
    const commissionAmount = round2(baseAmount * (ratePercent / 100));

    const { error } = await this.supabase
      .schema('finance')
      .from('commissions')
      .insert({
        tenant_id: event.tenant_id,
        opportunity_id: payload.opportunity_id,
        account_id: payload.account_id ?? null,
        owner_id: payload.owner_id ?? null,
        amount_base: baseAmount,
        rate_percent: ratePercent,
        amount: commissionAmount,
        currency: payload.currency || 'INR',
        status: 'pending',
        source_outbox_id: event.id,
        commission_rule_id: ruleId,
        metadata: {
          opportunity_name: payload.name ?? null,
          close_date: payload.close_date ?? null,
          contact_id: payload.contact_id ?? null,
          lead_id: payload.lead_id ?? null,
          computed_by: 'finance-api.cross-module-consumer',
          rate_source: ruleRate !== null ? 'commission_rule' : 'env_default',
        },
      });

    if (error) {
      // UNIQUE violation on source_outbox_id = idempotency hit; safe to
      // ignore + still mark the outbox published.
      if (error.code === '23505') {
        logger.info('commission already exists for outbox event, skipping', {
          outboxId: event.id,
          opportunityId: payload.opportunity_id,
        });
        return;
      }
      throw error;
    }
    logger.info('commission created', {
      opportunityId: payload.opportunity_id,
      amount: commissionAmount,
      ratePercent,
      ruleId,
    });
  }

  // Picks the best-matching active rule from finance.commission_rules.
  // Returns the rate + rule id, or {rate: null, ruleId: null} when no rule
  // matches. Looking up the rate via RPC + the rule id via a follow-up
  // select keeps the consumer code simple; both calls hit indexed
  // primary keys so the cost is negligible.
  private async resolveCommissionRate(
    tenantId: string,
    ownerId: string | null,
    accountId: string | null,
    occurredAt: string,
  ): Promise<{ rate: number | null; ruleId: string | null }> {
    try {
      const { data: rate, error: rateError } = await this.supabase
        .schema('finance')
        .rpc('resolve_commission_rate', {
          p_tenant_id: tenantId,
          p_owner_id: ownerId,
          p_account_id: accountId,
          p_occurred_at: occurredAt,
        });
      if (rateError) {
        logger.warn('resolve_commission_rate RPC failed; falling back to env default', { error: rateError.message });
        return { rate: null, ruleId: null };
      }
      if (rate === null || rate === undefined) {
        return { rate: null, ruleId: null };
      }
      // Re-query the matching rule's id so we can store the back-link.
      // Same ORDER BY semantics as the resolver function — keep them in
      // sync if the resolver tiebreakers change.
      const { data: ruleRows } = await this.supabase
        .schema('finance')
        .from('commission_rules')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lte('effective_from', occurredAt)
        .or(`effective_to.is.null,effective_to.gt.${occurredAt}`)
        .or(`owner_id.is.null,owner_id.eq.${ownerId ?? '00000000-0000-0000-0000-000000000000'}`)
        .or(`account_id.is.null,account_id.eq.${accountId ?? '00000000-0000-0000-0000-000000000000'}`)
        .eq('rate_percent', rate)
        .order('priority', { ascending: true })
        .order('effective_from', { ascending: false })
        .limit(1);
      return {
        rate: Number(rate),
        ruleId: ruleRows && ruleRows.length > 0 ? (ruleRows[0] as { id: string }).id : null,
      };
    } catch (err) {
      logger.warn('resolve_commission_rate threw; falling back to env default', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { rate: null, ruleId: null };
    }
  }

  private async handleShipmentDelivered(event: OutboxEvent): Promise<void> {
    const payload = event.payload as unknown as ShipmentPayload;
    const total = numberOrNull(payload.total_charges) ?? 0;
    const draftInvoiceNumber = `DRAFT-${payload.shipment_number || event.entity_id.slice(0, 8)}`;

    const { error } = await this.supabase
      .schema('finance')
      .from('invoices')
      .insert({
        tenant_id: event.tenant_id,
        invoice_number: draftInvoiceNumber,
        customer_id: payload.account_id ?? null,
        shipment_id: payload.shipment_id,
        status: 'draft',
        type: 'standard',
        issue_date: null,
        due_date: null,
        currency: payload.currency || 'INR',
        subtotal: total,
        tax_total: 0,
        total: total,
        balance_due: total,
        notes: `Draft invoice auto-generated from shipment ${payload.shipment_number || event.entity_id} delivery.`,
        metadata: {
          source_outbox_id: event.id,
          source_event_type: 'logistics.shipment.delivered',
          shipment_number: payload.shipment_number ?? null,
          carrier_id: payload.carrier_id ?? null,
          vendor_id: payload.vendor_id ?? null,
          quote_id: payload.quote_id ?? null,
          booking_id: payload.booking_id ?? null,
          actual_delivery_date: payload.actual_delivery_date ?? null,
          port_of_loading: payload.port_of_loading ?? null,
          port_of_discharge: payload.port_of_discharge ?? null,
          created_by: 'finance-api.cross-module-consumer',
        },
      });

    if (error) {
      if (error.code === '23505') {
        logger.info('draft invoice already exists for outbox event, skipping', {
          outboxId: event.id,
          shipmentId: payload.shipment_id,
        });
        return;
      }
      throw error;
    }
    logger.info('draft invoice created', {
      shipmentId: payload.shipment_id,
      invoiceNumber: draftInvoiceNumber,
      total,
    });
  }

  private async markPublished(outboxId: string): Promise<void> {
    const { error } = await this.supabase
      .schema('core')
      .from('outbox')
      .update({ published_at: new Date().toISOString() })
      .eq('id', outboxId);
    if (error) {
      logger.error('cross-module consumer failed to stamp published_at', {
        outboxId,
        error: error.message,
      });
    }
  }
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const crossModuleConsumer = new CrossModuleConsumer();
