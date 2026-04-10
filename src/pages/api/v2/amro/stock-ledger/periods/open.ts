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

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const periodCode = String(body.period_code || '').trim();
    const periodStart = String(body.period_start || '');
    const periodEnd = String(body.period_end || '');
    const valuationMethod = String(body.valuation_method || 'weighted_average');
    const notes = body.notes ? String(body.notes) : null;

    if (!periodCode || !periodStart || !periodEnd) {
      res.status(400).json({ error: 'period_code, period_start, and period_end are required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const { data, error } = await supabase
      .from('amro_stock_period_closes')
      .insert({
        tenant_id: tenantId,
        franchise_id: franchiseId,
        period_code: periodCode,
        period_start: periodStart,
        period_end: periodEnd,
        close_status: 'open',
        valuation_method: valuationMethod,
        notes,
      })
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        res.status(409).json({ error: `Period ${periodCode} already exists`, version: 'v2', correlationId: ctx.correlationId });
        return;
      }
      throw error;
    }

    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-period-open',
      output: {
        record: {
          id: data?.id,
          period_code: data?.period_code,
          period_start: data?.period_start,
          period_end: data?.period_end,
          close_status: data?.close_status,
          valuation_method: data?.valuation_method,
          notes: data?.notes,
          created_at: data?.created_at,
          updated_at: data?.updated_at,
        },
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
