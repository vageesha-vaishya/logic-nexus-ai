import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';

async function writeAuditLog(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  params: { userId: string; tenantId: string; franchiseId: string; details: Record<string, unknown> }
) {
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    action: 'FRANCHISES_LIST_VIEW',
    resource_type: 'franchises',
    tenant_id: params.tenantId,
    details: params.details,
  };
  if (params.franchiseId) {
    payload.franchise_id = params.franchiseId;
  }

  const { error } = await supabase.from('audit_logs').insert(payload);
  if (error) {
    logApiEvent('warn', '[FranchiseAPI] audit log write failed', {
      userId: params.userId,
      tenantId: params.tenantId,
      message: error.message,
    });
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
    }

    enforceHttps(req);
    enforceRateLimit(req);

    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions, ['admin.franchises.manage', 'dashboards.view']);

    const access = await resolveAndApplyAccessContext(req, ctx);
    enforceRateLimit(req, access.tenantId || '');

    const tenantId = access.tenantId || '';
    if (!tenantId) {
      throw new Error('Forbidden');
    }

    const isActiveQuery = typeof req.query.is_active === 'string'
      ? req.query.is_active.toLowerCase().trim()
      : '';
    const filterByActive = isActiveQuery === 'true' || isActiveQuery === 'false';
    const onlyActive = isActiveQuery === 'true';

    let query = getSupabaseAdminClient()
      .from('franchises')
      .select('id, name, code, tenant_id, is_active, created_at, address, tenants:tenants!franchises_tenant_id_fkey(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filterByActive) {
      query = query.eq('is_active', onlyActive);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const count = Array.isArray(data) ? data.length : 0;
    logApiEvent('info', '[FranchiseAPI] tenant franchises fetched', {
      correlationId: ctx.correlationId,
      userId: access.userId,
      role: ctx.role,
      tenantId,
      isPlatformAdmin: access.isPlatformAdmin,
      adminOverrideEnabled: access.adminOverrideEnabled,
      requestedTenantHeader: req.headers['x-tenant-id'] || null,
      franchiseScope: access.franchiseId || null,
      filterByActive,
      onlyActive: filterByActive ? onlyActive : null,
      count,
    });

    await writeAuditLog(getSupabaseAdminClient(), {
      userId: access.userId,
      tenantId,
      franchiseId: access.franchiseId || '',
      details: {
        correlationId: ctx.correlationId,
        role: ctx.role,
        isPlatformAdmin: access.isPlatformAdmin,
        filterByActive,
        onlyActive: filterByActive ? onlyActive : null,
        count,
      },
    });

    return res.status(200).json({
      data: data || [],
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[FranchiseAPI] tenant franchises fetch failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      role: ctx.role || null,
      tenantId: ctx.tenantId || null,
      franchiseId: ctx.franchiseId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
