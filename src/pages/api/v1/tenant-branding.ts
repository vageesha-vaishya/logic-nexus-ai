import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  parseHeaderValue,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { resolveTenantBranding } from '@/services/branding/brandingResolver';
import { sanitizeBrandingCss } from '@/lib/utils/sanitizer';
import type { BrandingSettings } from '@/services/quotation/QuotationConfigurationService';

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

function parseBrandingPayload(body: unknown): BrandingSettings {
  let parsed: any = {};
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      throw new Error('Invalid branding payload');
    }
  } else {
    parsed = body || {};
  }
  const candidate = (parsed as any).brandingSettings ?? (parsed as any).branding_settings;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('Invalid branding payload');
  }
  return candidate as BrandingSettings;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'PUT'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'PUT') {
      res.setHeader('Allow', ['GET', 'PUT']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    let access: { isPlatformAdmin: boolean; tenantId: string | null };
    try {
      access = await resolveAndApplyAccessContext(req, ctx);
    } catch (accessError) {
      const requestedTenantId = sanitizeQueryId(req.query.tenant_id, 'tenant_id');
      const normalizedRole = String(ctx.role || '').trim().toLowerCase();
      const canFallbackPlatformScope = normalizedRole === 'platform_admin' && !!requestedTenantId;
      if (!canFallbackPlatformScope) {
        throw accessError;
      }
      access = {
        isPlatformAdmin: true,
        tenantId: requestedTenantId,
      };
      ctx.tenantId = requestedTenantId;
      ctx.isPlatformAdmin = true;
      logApiEvent('warn', '[TenantBrandingAPI] fallback scope applied', {
        correlationId: ctx.correlationId,
        userId: ctx.userId,
        role: ctx.role,
        tenantId: requestedTenantId,
        reason: accessError instanceof Error ? accessError.message : 'unknown',
      });
    }
    const targetTenantId = resolveTargetTenantId(req, access);
    enforceRateLimit(req, targetTenantId);

    const requestedDomainCode = sanitizeQueryId(req.query.domain_code, 'domain_code').toUpperCase();
    const requestedFranchiseId = sanitizeQueryId(req.query.franchise_id, 'franchise_id');
    const hostHeader = parseHeaderValue(req.headers.host).split(':')[0];
    const requestedHostname = normalizeHostname(req.query.hostname || hostHeader);
    const supabase = getSupabaseAdminClient();

    if (req.method === 'PUT') {
      const incoming = parseBrandingPayload(req.body);
      const sanitized: BrandingSettings = {
        ...incoming,
        custom_css: sanitizeBrandingCss(incoming.custom_css || ''),
      };
      const { data: existingTenant, error: existingError } = await supabase
        .from('tenants')
        .select('id, settings')
        .eq('id', targetTenantId)
        .limit(1)
        .maybeSingle();
      if (existingError) {
        throw new Error(existingError.message);
      }
      if (!existingTenant) {
        return res.status(404).json({ error: 'Tenant not found', correlationId: ctx.correlationId, version: 'v1' });
      }
      const nextSettings = {
        ...((existingTenant as any).settings || {}),
        branding_settings: sanitized,
      };
      const { error: updateError } = await supabase
        .from('tenants')
        .update({
          branding_settings: sanitized,
          settings: nextSettings,
        })
        .eq('id', targetTenantId);
      if (updateError) {
        throw new Error(updateError.message);
      }

      logApiEvent('info', '[TenantBrandingAPI] branding updated', {
        correlationId: ctx.correlationId,
        userId: ctx.userId,
        role: ctx.role,
        tenantId: targetTenantId,
        requestedTenantId: sanitizeQueryId(req.query.tenant_id, 'tenant_id') || null,
      });

      return res.status(200).json({
        data: {
          tenantId: targetTenantId,
          brandingSettings: sanitized,
        },
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

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
      return res.status(404).json({ error: 'Tenant not found', correlationId: ctx.correlationId, version: 'v1' });
    }

    const data = resolveTenantBranding(
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

    logApiEvent('info', '[TenantBrandingAPI] branding resolved', {
      correlationId: ctx.correlationId,
      userId: ctx.userId,
      role: ctx.role,
      tenantId: targetTenantId,
      hostname: requestedHostname,
      domainCode: requestedDomainCode || null,
      franchiseId: requestedFranchiseId || null,
      requestedTenantId: sanitizeQueryId(req.query.tenant_id, 'tenant_id') || null,
    });

    return res.status(200).json({ data, correlationId: ctx.correlationId, version: 'v1' });
  } catch (error) {
    logApiEvent('error', '[TenantBrandingAPI] branding resolution failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
