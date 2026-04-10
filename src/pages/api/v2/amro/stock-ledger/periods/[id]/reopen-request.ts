import type { ApiRequest, ApiResponse } from '../../../../../_utils/types';
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
} from '../../../../../_utils/http';
import { sendErrorResponse } from '../../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../../_utils/supabaseAdmin';

const REQUIRED_PERMISSIONS = ['inventory.admin'];

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
    const tenantId = String(accessContext.tenantId || '');
    const franchiseId = accessContext.franchiseId ? String(accessContext.franchiseId) : null;
    const supabase = getSupabaseAdminClient();

    const periodId = String(req.query.id || '').trim();
    if (!periodId) {
      res.status(400).json({ error: 'id is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const reason = String(body.reason || '').trim();
    if (!reason) {
      res.status(400).json({ error: 'reason is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const { data, error } = await supabase
      .from('amro_stock_approval_queue')
      .insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        request_type: 'period_reopen',
        request_status: 'pending',
        related_period_id: periodId,
        requested_by: auth.userId,
        reason,
      })
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-period-reopen-request',
      output: {
        record: {
          id: data?.id,
          request_type: data?.request_type,
          request_status: data?.request_status,
          related_period_id: data?.related_period_id,
          reason: data?.reason,
          created_at: data?.created_at,
        },
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
