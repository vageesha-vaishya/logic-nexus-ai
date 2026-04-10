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

const REQUIRED_PERMISSIONS = ['inventory.admin', 'inventory.read', 'dashboards.view'];

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
      .from('amro_stock_audit_timeline')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (franchiseId) baseQuery = baseQuery.eq('franchise_id', franchiseId);

    const limit = Math.min(5000, Math.max(1, Number(query.limit) || 1000));
    baseQuery = baseQuery.limit(limit);

    const fromDate = query.from ? String(query.from).trim() : null;
    if (fromDate) baseQuery = baseQuery.gte('created_at', fromDate);

    const toDate = query.to ? String(query.to).trim() : null;
    if (toDate) baseQuery = baseQuery.lte('created_at', toDate);

    const eventType = query.event_type ? String(query.event_type).trim() : null;
    if (eventType) baseQuery = baseQuery.eq('event_type', eventType);

    const { data, error, count } = await baseQuery;
    if (error) throw error;

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-audit-export',
      output: {
        records: (data || []).map((row: Record<string, unknown>) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          franchise_id: row.franchise_id,
          actor_user_id: row.actor_user_id,
          event_type: row.event_type,
          event_category: row.event_category,
          reference_id: row.reference_id,
          event_payload: row.event_payload || {},
          immutable_hash: row.immutable_hash,
          created_at: row.created_at,
        })),
        total: count ?? 0,
        limit,
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
