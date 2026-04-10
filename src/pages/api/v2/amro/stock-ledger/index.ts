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
import { mapStockLedgerRow, parsePagination, validateStockLedgerMutation } from './shared';

const REQUIRED_PERMISSIONS = ['inventory.admin', 'inventory.read', 'dashboards.view'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const startedAt = Date.now();
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
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

    if (req.method === 'GET') {
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const query = supabase
        .from('amro_stock_ledger_transactions')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('effective_at', { ascending: false })
        .range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-list',
        output: {
          records: (data || []).map((row) => mapStockLedgerRow(row as Record<string, unknown>)),
          total: count ?? 0,
          page,
          page_size: pageSize,
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    if (req.method === 'POST') {
      const payload = validateStockLedgerMutation(req.body);
      const { data, error } = await supabase.rpc('amro_stock_ledger_post_transaction', {
        p_tenant_id: tenantId,
        p_franchise_id: franchiseId,
        p_user_id: auth.userId,
        p_part_inventory_id: payload.part_inventory_id,
        p_movement_type: payload.movement_type,
        p_quantity_delta: payload.quantity_delta,
        p_unit_cost: payload.unit_cost ?? 0,
        p_currency: payload.currency ?? 'USD',
        p_effective_at: payload.effective_at ?? new Date().toISOString(),
        p_source_module: payload.source_module ?? 'stock-ledger-ui',
        p_source_reference: payload.source_reference ?? null,
        p_notes: payload.notes ?? null,
        p_metadata: payload.metadata ?? {},
        p_valuation_method: payload.valuation_method ?? 'weighted_average',
        p_idempotency_key: payload.idempotency_key ?? null,
      });
      if (error) throw error;
      res.status(201).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-create',
        output: {
          record: mapStockLedgerRow((data as unknown as Record<string, unknown>) || {}),
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
