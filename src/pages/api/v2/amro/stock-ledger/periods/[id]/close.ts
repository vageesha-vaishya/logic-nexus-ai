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
    const notes = body.notes ? String(body.notes) : null;
    const expectedUpdatedAt = body.expected_updated_at ? String(body.expected_updated_at) : null;

    let updateQuery = supabase
      .from('amro_stock_period_closes')
      .update({
        close_status: 'closed',
        closed_by: auth.userId,
        closed_at: new Date().toISOString(),
        notes: notes,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', periodId)
      .eq('close_status', 'open');

    if (franchiseId) {
      updateQuery = updateQuery.eq('franchise_id', franchiseId);
    }

    if (expectedUpdatedAt) {
      updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
    }

    const { data, error } = await updateQuery
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const conflictError = expectedUpdatedAt
        ? 'Period was modified by another user. Please refresh and try again.'
        : 'Period not found or not in open status';
      res.status(expectedUpdatedAt ? 409 : 404).json({ error: conflictError, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-period-close',
      output: {
        record: {
          id: data.id,
          period_code: data.period_code,
          period_start: data.period_start,
          period_end: data.period_end,
          close_status: data.close_status,
          valuation_method: data.valuation_method,
          closed_at: data.closed_at,
          notes: data.notes,
          updated_at: data.updated_at,
        },
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
