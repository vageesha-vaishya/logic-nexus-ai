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

const REQUIRED_PERMISSIONS = ['inventory.admin', 'inventory.read'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const startedAt = Date.now();
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
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
    const tenantId = String(accessContext.tenantId || '');
    const franchiseId = accessContext.franchiseId ? String(accessContext.franchiseId) : null;
    const supabase = getSupabaseAdminClient();

    const query = req.query as Record<string, unknown>;
    let baseQuery = supabase
      .from('amro_stock_period_closes')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('period_end', { ascending: false });

    if (franchiseId) baseQuery = baseQuery.eq('franchise_id', franchiseId);

    const statusFilter = query.status ? String(query.status).trim() : null;
    if (statusFilter && ['open', 'closing', 'closed', 'reopened'].includes(statusFilter)) {
      baseQuery = baseQuery.eq('close_status', statusFilter);
    }

    const { data, error, count } = await baseQuery;
    if (error) throw error;

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-periods-list',
      output: {
        records: (data || []).map((row: Record<string, unknown>) => ({
          id: row.id,
          period_code: row.period_code,
          period_start: row.period_start,
          period_end: row.period_end,
          close_status: row.close_status,
          valuation_method: row.valuation_method,
          closed_at: row.closed_at || null,
          reopened_at: row.reopened_at || null,
          notes: row.notes || null,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
        total: count ?? 0,
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
