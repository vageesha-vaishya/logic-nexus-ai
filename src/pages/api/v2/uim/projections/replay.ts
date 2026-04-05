import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { resolveUimAccess } from '../_shared';

type ProjectionAccumulator = {
  available: number;
  reserved: number;
  consumed: number;
  lastLedgerId: string | null;
  lastLedgerAt: string | null;
};

function readNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const access = await resolveUimAccess(req, ctx);
    const supabase = getSupabaseAdminClient();

    let query = supabase
      .from('uim_inventory_ledger')
      .select('id, inventory_item_id, transaction_type, quantity_changed, created_at')
      .eq('tenant_id', access.tenantId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (access.franchiseId) query = query.eq('franchise_id', access.franchiseId);

    const { data: ledgerRows, error: ledgerError } = await query.limit(50000);
    if (ledgerError) throw new Error(`Failed to load ledger for projection replay: ${ledgerError.message}`);

    const projection = new Map<string, ProjectionAccumulator>();
    for (const row of ledgerRows || []) {
      const rowData = row as Record<string, unknown>;
      const itemId = String(rowData.inventory_item_id || '').trim();
      if (!itemId) continue;
      const eventType = String(rowData.transaction_type || '').toUpperCase();
      const quantity = readNumber(rowData.quantity_changed);
      const current = projection.get(itemId) || {
        available: 0,
        reserved: 0,
        consumed: 0,
        lastLedgerId: null,
        lastLedgerAt: null,
      };

      if (eventType === 'RECEIVE' || eventType === 'RETURN' || eventType === 'ADJUST') {
        current.available += quantity;
      } else if (eventType === 'RESERVE') {
        current.available -= quantity;
        current.reserved += quantity;
      } else if (eventType === 'RELEASE') {
        current.available += quantity;
        current.reserved -= quantity;
      } else if (eventType === 'CONSUME') {
        current.reserved = Math.max(0, current.reserved - quantity);
        current.consumed += quantity;
      } else if (eventType === 'SCRAP') {
        current.available -= quantity;
      }

      current.lastLedgerId = String(rowData.id || current.lastLedgerId || '');
      current.lastLedgerAt = String(rowData.created_at || current.lastLedgerAt || '');
      projection.set(itemId, current);
    }

    const snapshotRows = [...projection.entries()].map(([inventoryItemId, totals]) => ({
      tenant_id: access.tenantId,
      franchise_id: access.franchiseId || null,
      inventory_item_id: inventoryItemId,
      projected_available_quantity: Number(totals.available.toFixed(4)),
      projected_reserved_quantity: Number(Math.max(0, totals.reserved).toFixed(4)),
      projected_consumed_quantity: Number(Math.max(0, totals.consumed).toFixed(4)),
      last_ledger_id: totals.lastLedgerId,
      last_ledger_at: totals.lastLedgerAt,
      replay_version: Date.now(),
      updated_at: new Date().toISOString(),
    }));

    if (snapshotRows.length > 0) {
      const { error: upsertError } = await supabase
        .from('uim_inventory_projection_snapshots')
        .upsert(snapshotRows, {
          onConflict: 'tenant_id,inventory_item_id',
          ignoreDuplicates: false,
        });
      if (upsertError) throw new Error(`Failed to upsert projection snapshots: ${upsertError.message}`);
    }

    res.status(200).json({
      version: 'v2',
      interface: 'uim-projection-replay',
      correlationId: ctx.correlationId,
      output: {
        replayed_events: (ledgerRows || []).length,
        updated_snapshots: snapshotRows.length,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
