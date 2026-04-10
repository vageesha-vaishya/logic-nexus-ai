import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
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
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import { mapStockLedgerRow, parsePagination } from '../shared';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    enforceAnyPermission(auth.permissions || [], ['inventory.read', 'dashboards.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('amro_stock_ledger_transactions')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('effective_at', { ascending: false })
      .range(from, to);
    if (franchiseId) {
      query = query.eq('franchise_id', franchiseId);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-report-transaction-history',
      output: { rows: (data || []).map((row) => mapStockLedgerRow(row as Record<string, unknown>)), total: count || 0, page, page_size: pageSize },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
