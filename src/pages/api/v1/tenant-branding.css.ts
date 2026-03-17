import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  parseHeaderValue,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { buildTenantBrandingStylesheet, resolveTenantBranding } from '@/services/branding/brandingResolver';

function normalizeHostname(raw: unknown): string {
  const value = String(Array.isArray(raw) ? raw[0] || '' : raw || '').trim().toLowerCase();
  if (!value) return '';
  if (!/^[a-z0-9.-]{1,253}$/.test(value)) {
    throw new Error('Invalid hostname format');
  }
  return value;
}

function resolveTargetTenantId(req: ApiRequest, access: { isPlatformAdmin: boolean; tenantId: string | null }): string {
  const requestedTenantId = sanitizeQueryId(req.query.tenant_id, 'tenant_id');
  if (access.isPlatformAdmin) {
    const targetTenantId = requestedTenantId || access.tenantId || '';
    if (!targetTenantId) {
      throw new Error('Tenant scope required');
    }
    return targetTenantId;
  }
  if (!access.tenantId) {
    throw new Error('Tenant scope required');
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
    const access = await resolveAndApplyAccessContext(req, ctx);
    const targetTenantId = resolveTargetTenantId(req, access);
    enforceRateLimit(req, targetTenantId);

    const requestedDomainCode = sanitizeQueryId(req.query.domain_code, 'domain_code').toUpperCase();
    const requestedFranchiseId = sanitizeQueryId(req.query.franchise_id, 'franchise_id');
    const hostHeader = parseHeaderValue(req.headers.host).split(':')[0];
    const requestedHostname = normalizeHostname(req.query.hostname || hostHeader);

    const supabase = getSupabaseAdminClient();
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, slug, domain, logo_url, branding_settings, settings')
      .eq('id', targetTenantId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!tenant) {
      return res.status(404).end();
    }

    const branding = resolveTenantBranding(
      {
        tenantId: String(tenant.id),
        tenantName: String(tenant.name || ''),
        tenantSlug: String(tenant.slug || ''),
        domain: String(tenant.domain || ''),
        logoUrl: String(tenant.logo_url || ''),
        brandingSettings: tenant.branding_settings || {},
        tenantSettings: tenant.settings || {},
      },
      {
        hostname: requestedHostname,
        domainCode: requestedDomainCode,
        franchiseId: requestedFranchiseId,
      }
    );

    const css = buildTenantBrandingStylesheet(branding);
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200);
    res.end(css);
    return;
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
