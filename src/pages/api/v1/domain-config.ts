import type { ApiRequest, ApiResponse } from '../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAnyPermission,
  enforceDomainAccess,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body || '{}');
    } catch {
      throw new Error('Invalid request payload');
    }
  }
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function parsePluginName(value: unknown): string {
  const pluginName = String(value || '').trim().toUpperCase();
  if (!pluginName) return 'QUOTATION';
  if (!/^[A-Z0-9_-]{2,64}$/.test(pluginName)) {
    throw new Error('Invalid pluginName format');
  }
  return pluginName;
}

function parseEnvironment(value: unknown): string {
  const environment = String(value || 'prod').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(environment)) {
    throw new Error('Invalid environment format');
  }
  return environment;
}

function parseSettings(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('jsonSettings must be an object');
  }
  return value as Record<string, unknown>;
}

async function resolveDomainCodeById(supabase: any, domainId: string): Promise<string> {
  const { data, error } = await supabase
    .from('platform_domains')
    .select('code')
    .eq('id', domainId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const domainCode = String(data?.code || '').trim().toUpperCase();
  if (!domainCode) throw new Error('Domain not found');
  return domainCode;
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
    const access = await resolveAndApplyAccessContext(req, ctx);
    enforceRateLimit(req, access.tenantId || '');

    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      enforceAnyPermission(auth.permissions, ['domains.config.read']);
      const domainId = sanitizeQueryId(req.query.domain_id, 'domain_id');
      if (!domainId) throw new Error('domain_id is required');
      const pluginName = parsePluginName(req.query.plugin_name);
      const environment = parseEnvironment(req.query.environment);
      const domainCode = await resolveDomainCodeById(supabase, domainId);
      await enforceDomainAccess(access, domainCode);

      const { data, error } = await supabase
        .from('domain_config')
        .select('id, domain_id, plugin_name, environment, json_settings, encrypted_secrets, updated_at')
        .eq('domain_id', domainId)
        .eq('plugin_name', pluginName)
        .eq('environment', environment)
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);

      return res.status(200).json({
        data: data || null,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    enforceAnyPermission(auth.permissions, ['domains.config.write']);
    const payload = parseBody(req.body);
    const domainId = String(payload.domainId || '').trim();
    if (!domainId) throw new Error('domainId is required');
    const pluginName = parsePluginName(payload.pluginName);
    const environment = parseEnvironment(payload.environment);
    const jsonSettings = parseSettings(payload.jsonSettings);
    const encryptedSecrets = payload.encryptedSecrets == null ? null : String(payload.encryptedSecrets);
    const domainCode = await resolveDomainCodeById(supabase, domainId);
    await enforceDomainAccess(access, domainCode);

    const upsertPayload = {
      domain_id: domainId,
      plugin_name: pluginName,
      environment,
      json_settings: jsonSettings,
      encrypted_secrets: encryptedSecrets,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('domain_config')
      .upsert(upsertPayload, {
        onConflict: 'domain_id,plugin_name,environment',
      })
      .select('id, domain_id, plugin_name, environment, json_settings, encrypted_secrets, updated_at')
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    logApiEvent('info', '[DomainConfigAPI] domain configuration updated', {
      correlationId: ctx.correlationId,
      userId: auth.userId,
      domainId,
      domainCode,
      pluginName,
      environment,
    });

    return res.status(200).json({
      data,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[DomainConfigAPI] request failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
