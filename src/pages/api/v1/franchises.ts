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
  sanitizeQueryId,
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

function resolveTenantScope(req: ApiRequest, access: { isPlatformAdmin: boolean; tenantId: string | null }): string | null {
  const requestedTenantId = sanitizeQueryId(req.query.tenant_id, 'tenant_id');
  if (access.isPlatformAdmin) {
    return requestedTenantId || null;
  }
  if (!access.tenantId) {
    throw new Error('Forbidden');
  }
  if (requestedTenantId && requestedTenantId !== access.tenantId) {
    throw new Error('Forbidden');
  }
  return access.tenantId;
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
    const tenantId = resolveTenantScope(req, access);
    const requestedFranchiseId = sanitizeQueryId(req.query.franchise_id, 'franchise_id');

    const isActiveQuery = typeof req.query.is_active === 'string'
      ? req.query.is_active.toLowerCase().trim()
      : '';
    const filterByActive = isActiveQuery === 'true' || isActiveQuery === 'false';
    const onlyActive = isActiveQuery === 'true';

    let query = getSupabaseAdminClient()
      .from('franchises')
      .select('id, name, code, tenant_id, is_active, created_at, address, tenants:tenants!franchises_tenant_id_fkey(name)')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (requestedFranchiseId) {
      query = query.eq('id', requestedFranchiseId).limit(1);
    }

    if (filterByActive) {
      query = query.eq('is_active', onlyActive);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const rows = Array.isArray(data) ? data : [];
    const count = rows.length;
    logApiEvent('info', '[FranchiseAPI] tenant franchises fetched', {
      correlationId: ctx.correlationId,
      userId: access.userId,
      role: ctx.role,
      tenantId,
      isPlatformAdmin: access.isPlatformAdmin,
      adminOverrideEnabled: access.adminOverrideEnabled,
      requestedTenantHeader: req.headers['x-tenant-id'] || null,
      requestedTenantId: sanitizeQueryId(req.query.tenant_id, 'tenant_id') || null,
      requestedFranchiseId: requestedFranchiseId || null,
      franchiseScope: access.franchiseId || null,
      filterByActive,
      onlyActive: filterByActive ? onlyActive : null,
      count,
    });

    await writeAuditLog(getSupabaseAdminClient(), {
      userId: access.userId,
      tenantId: tenantId || '',
      franchiseId: access.franchiseId || '',
      details: {
        correlationId: ctx.correlationId,
        role: ctx.role,
        isPlatformAdmin: access.isPlatformAdmin,
        requestedTenantId: sanitizeQueryId(req.query.tenant_id, 'tenant_id') || null,
        requestedFranchiseId: requestedFranchiseId || null,
        filterByActive,
        onlyActive: filterByActive ? onlyActive : null,
        count,
      },
    });

    return res.status(200).json({
      data: rows,
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
