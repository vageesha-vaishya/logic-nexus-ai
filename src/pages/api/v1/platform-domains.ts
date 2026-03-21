import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { getCachedJson, setCachedJson } from '../_utils/redisCache';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../_utils/compatibility-facade';

type AuthorizedDomainsPayload = {
  domains: any[];
  tenantDomainCount: number;
  tenantId: string | null;
  isPlatformAdmin: boolean;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const initialDecision = resolveGatewayCompatibility(req);
  applyCompatibilityResponseHeaders(res, initialDecision, ctx.correlationId);

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

    const access = await resolveAndApplyAccessContext(req, ctx);
    const compatDecision = resolveGatewayCompatibility(req, {
      tenantId: access.tenantId,
      franchiseId: access.franchiseId,
    });
    applyCompatibilityResponseHeaders(res, compatDecision, ctx.correlationId);
    logApiEvent('info', '[GatewayFacade] route decision', {
      correlationId: ctx.correlationId,
      route: '/api/v1/platform-domains',
      method: req.method || 'GET',
      tenantId: access.tenantId || null,
      franchiseId: access.franchiseId || null,
      apiVersion: compatDecision.apiVersion,
      compatMode: compatDecision.compatMode,
    });
    enforceRateLimit(req, access.tenantId || '');
    const requestedDomainCode = typeof req.query.domain_code === 'string' ? req.query.domain_code : null;
    const domainAccess = await enforceDomainAccess(access, requestedDomainCode);
    const cacheKey = [
      'platform-domains',
      access.userId || 'anon',
      access.tenantId || 'global',
      requestedDomainCode || 'all',
      domainAccess.authorizedDomainCodes.join(','),
    ].join(':');
    const cached = await getCachedJson<AuthorizedDomainsPayload>(cacheKey);
    if (cached) {
      return res.status(200).json({
        data: cached,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }
    const supabase = getSupabaseAdminClient();

    if (!domainAccess.authorizedDomainCodes.length) {
      return res.status(200).json({
        data: {
          domains: [],
          tenantDomainCount: domainAccess.tenantDomainCount,
          tenantId: access.tenantId,
          isPlatformAdmin: access.isPlatformAdmin,
        },
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const { data, error } = await supabase
      .from('platform_domains')
      .select('id, code, name, description, is_active')
      .eq('is_active', true)
      .in('code', domainAccess.authorizedDomainCodes)
      .order('name');

    if (error) {
      throw new Error(error.message);
    }

    logApiEvent('info', '[DomainAPI] authorized domains fetched', {
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      role: ctx.role,
      tenantId: access.tenantId,
      isPlatformAdmin: access.isPlatformAdmin,
      adminOverrideEnabled: access.adminOverrideEnabled,
      requestedDomainCode,
      tenantDomainCount: domainAccess.tenantDomainCount,
      count: Array.isArray(data) ? data.length : 0,
    });

    const responsePayload = {
      domains: data || [],
      tenantDomainCount: domainAccess.tenantDomainCount,
      tenantId: access.tenantId,
      isPlatformAdmin: access.isPlatformAdmin,
    };
    await setCachedJson(cacheKey, responsePayload, 120);

    return res.status(200).json({
      data: responsePayload,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[DomainAPI] authorized domains fetch failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      tenantId: ctx.tenantId || null,
      isPlatformAdmin: ctx.isPlatformAdmin,
      adminOverrideEnabled: ctx.adminOverrideEnabled,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
