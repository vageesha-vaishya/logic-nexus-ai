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
    const tenantId = String(accessContext.tenantId || '');
    const franchiseId = accessContext.franchiseId ? String(accessContext.franchiseId) : null;
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const query = req.query as Record<string, unknown>;
      const statusFilter = query.status ? String(query.status).trim() : 'pending';
      const validStatuses = ['pending', 'approved', 'rejected', 'all'];
      const status = validStatuses.includes(statusFilter) ? statusFilter : 'pending';

      let baseQuery = supabase
        .from('amro_stock_approval_queue')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (franchiseId) baseQuery = baseQuery.eq('franchise_id', franchiseId);
      if (status !== 'all') baseQuery = baseQuery.eq('request_status', status);

      const { data, error, count } = await baseQuery;
      if (error) throw error;

      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-approvals-list',
        output: {
          records: (data || []).map((row: Record<string, unknown>) => ({
            id: row.id,
            request_type: row.request_type,
            request_status: row.request_status,
            related_transaction_id: row.related_transaction_id || null,
            related_period_id: row.related_period_id || null,
            reason: row.reason || null,
            decision_notes: row.decision_notes || null,
            reviewed_at: row.reviewed_at || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          })),
          total: count ?? 0,
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      const requestType = String(body.request_type || 'adjustment').trim();
      const validTypes = ['adjustment', 'period_reopen', 'backdated_posting'];
      if (!validTypes.includes(requestType)) {
        res.status(400).json({ error: `Invalid request_type. Must be one of: ${validTypes.join(', ')}`, version: 'v2', correlationId: ctx.correlationId });
        return;
      }
      const reason = body.reason ? String(body.reason).trim() : null;

      const { data, error } = await supabase
        .from('amro_stock_approval_queue')
        .insert({
          tenant_id: tenantId,
          franchise_id: franchiseId,
          request_type: requestType,
          request_status: 'pending',
          requested_by: auth.userId,
          related_transaction_id: body.related_transaction_id || null,
          related_period_id: body.related_period_id || null,
          reason,
        })
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      res.status(201).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-approvals-create',
        output: {
          record: {
            id: data?.id,
            request_type: data?.request_type,
            request_status: data?.request_status,
            reason: data?.reason,
            created_at: data?.created_at,
          },
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
