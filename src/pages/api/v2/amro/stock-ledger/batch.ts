import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { mapStockLedgerRow, validateStockLedgerMutation } from './shared';

const REQUIRED_PERMISSIONS = ['inventory.admin', 'inventory.read'];

type BatchEntry = Record<string, unknown>;

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const startedAt = Date.now();
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], REQUIRED_PERMISSIONS);
    const accessContext = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(accessContext, { correlationId: ctx.correlationId });
    const supabase = getSupabaseAdminClient();
    const tenantId = String(accessContext.tenantId || '');
    const franchiseId = accessContext.franchiseId ? String(accessContext.franchiseId) : null;

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const entries = Array.isArray(body.entries) ? body.entries as BatchEntry[] : [];
    if (entries.length === 0) {
      res.status(400).json({ error: 'entries array is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (entries.length > 100) {
      res.status(400).json({ error: 'Batch size cannot exceed 100 entries', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const batchId = crypto.randomUUID();
    const created: Record<string, unknown>[] = [];
    const rejected: { row_index: number; reason: string; payload: Record<string, unknown> }[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      try {
        const validated = validateStockLedgerMutation(entry);
        const { data, error } = await supabase.rpc('amro_stock_ledger_post_transaction', {
          p_tenant_id: tenantId,
          p_franchise_id: franchiseId,
          p_user_id: auth.userId,
          p_part_inventory_id: validated.part_inventory_id,
          p_movement_type: validated.movement_type,
          p_quantity_delta: validated.quantity_delta,
          p_unit_cost: validated.unit_cost ?? 0,
          p_currency: validated.currency ?? 'USD',
          p_effective_at: validated.effective_at ?? new Date().toISOString(),
          p_source_module: validated.source_module ?? 'stock-ledger-ui',
          p_source_reference: validated.source_reference ?? null,
          p_notes: validated.notes ?? null,
          p_metadata: validated.metadata ?? {},
          p_valuation_method: validated.valuation_method ?? 'weighted_average',
          p_idempotency_key: validated.idempotency_key ?? null,
        });
        if (error) throw error;
        created.push(mapStockLedgerRow((data as unknown as Record<string, unknown>) || {}));
      } catch (error) {
        const reason = error instanceof Error ? error.message : (error && typeof error === 'object' ? String((error as Record<string, unknown>).message || 'Unknown error') : 'Unknown error');
        rejected.push({
          row_index: i,
          reason,
          payload: entry,
        });
      }
    }

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-batch-create',
      output: {
        batch_id: batchId,
        created_count: created.length,
        rejected_count: rejected.length,
        records: created,
        rejected,
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
