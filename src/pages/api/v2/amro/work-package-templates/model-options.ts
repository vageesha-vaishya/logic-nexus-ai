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
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { logger } from '@/lib/logger';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });

  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET', 'OPTIONS']);
      return res.status(405).json({
        error: `Method ${req.method} Not Allowed`,
        correlationId: ctx.correlationId,
      });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);

    const supabase = getSupabaseAdminClient();
    const tenantId = String(scopedAccess.tenantId || '').trim();
    const scopedFranchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId).trim() : '';
    const requestedFranchiseId = String(req.query.franchise_id || '').trim();
    const normalizedRole = String((auth as { role?: string }).role || '').trim().toLowerCase();
    const isTenantAdmin = normalizedRole === 'tenant_admin';
    const franchiseId = isTenantAdmin && requestedFranchiseId ? requestedFranchiseId : scopedFranchiseId;
    const isPlatformAdmin = Boolean(scopedAccess.isPlatformAdmin);

    if (tenantId) {
      // tenant-scoped path (tenant/franchise users)
    } else if (!isPlatformAdmin) {
      logger.warn('[WPT model-options] missing tenant scope for non-platform user', {
        correlationId: ctx.correlationId,
        userId: auth.userId,
      });
      return res.status(400).json({
        error: 'Tenant scope missing for model options query',
        correlationId: ctx.correlationId,
      });
    }

    const runModelQuery = async (includeFranchiseColumn: boolean, includeGlobalTenantRows: boolean) => {
      let query = supabase
        .from('assembly_models')
        .select(includeFranchiseColumn
          ? 'id,name,model_code,is_active,tenant_id,franchise_id'
          : 'id,name,model_code,is_active,tenant_id')
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (tenantId) {
        query = includeGlobalTenantRows ? query.is('tenant_id', null) : query.eq('tenant_id', tenantId);
      }
      // If franchise scope exists and franchise_id column exists, include tenant-global rows.
      if (franchiseId && includeFranchiseColumn) {
        query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
      }
      return query;
    };

    const loadScopeRows = async (includeFranchiseColumn: boolean) => {
      const tenantRows = await runModelQuery(includeFranchiseColumn, false);
      if (tenantRows.error) return tenantRows;
      const globalRows = await runModelQuery(includeFranchiseColumn, true);
      if (globalRows.error) return globalRows;
      const merged = [
        ...(Array.isArray(tenantRows.data) ? tenantRows.data : []),
        ...(Array.isArray(globalRows.data) ? globalRows.data : []),
      ] as unknown as Array<Record<string, unknown>>;
      const deduped = Array.from(new Map(
        merged.map((row) => [String(row.id || ''), row]),
      ).values());
      return { data: deduped, error: null };
    };

    let { data, error } = await loadScopeRows(true);
    if (error && String(error.message || '').toLowerCase().includes('franchise_id')) {
      // Schema compatibility fallback: some environments do not expose franchise_id on assembly_models.
      logger.warn('[WPT model-options] franchise_id column missing, retrying tenant-scope query', {
        correlationId: ctx.correlationId,
        message: String(error.message || ''),
      });
      ({ data, error } = await loadScopeRows(false));
    }
    if (error) {
      logger.error('[WPT model-options] query failed', {
        correlationId: ctx.correlationId,
        message: String(error.message || ''),
        tenantId: tenantId || null,
        franchiseId: franchiseId || null,
      });
      return res.status(500).json({
        error: 'Failed to load aircraft model options',
        correlationId: ctx.correlationId,
      });
    }

    const rawRows = (Array.isArray(data) ? data : []) as unknown as Array<Record<string, unknown>>;
    const records = rawRows.map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      model_code: String(row.model_code || ''),
      is_active: Boolean(row.is_active),
      tenant_id: String(row.tenant_id || ''),
      franchise_id: row.franchise_id ? String(row.franchise_id || '') : null,
    }));

    return res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        records,
        total: records.length,
      },
    });
  } catch (error) {
    const message = String((error as Error).message || '');
    const normalized = message.toLowerCase();
    const status = normalized.includes('unauthorized') ? 401
      : normalized.includes('forbidden') ? 403
        : normalized.includes('https required') ? 400
          : 500;
    logger.error('[WPT model-options] unhandled error', {
      correlationId: ctx.correlationId,
      message,
    });
    return res.status(status).json({
      error: message || 'Unexpected error',
      correlationId: ctx.correlationId,
    });
  }
}
