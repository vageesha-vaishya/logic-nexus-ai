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
  sanitizeQueryId,
} from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { DomainAssignmentService } from '@/services/domain/DomainAssignmentService';

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

function parseTenantIds(payload: Record<string, unknown>): string[] {
  const raw = payload.tenantIds;
  if (!Array.isArray(raw)) {
    throw new Error('tenantIds must be an array');
  }
  const values = raw.map((item) => String(item || '').trim()).filter(Boolean);
  if (!values.length) throw new Error('tenantIds must not be empty');
  return Array.from(new Set(values));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'POST', 'DELETE'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  try {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions, ['domains.assign', 'domains.revoke', 'domains.audit.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    if (!access.isPlatformAdmin) {
      throw new Error('Forbidden');
    }
    enforceRateLimit(req, access.tenantId || '');

    const supabase = getSupabaseAdminClient();
    const service = new DomainAssignmentService(supabase as any);

    if (req.method === 'GET') {
      const history = await service.listAuditHistory({
        tenantId: sanitizeQueryId(req.query.tenant_id, 'tenant_id') || undefined,
        domainId: sanitizeQueryId(req.query.domain_id, 'domain_id') || undefined,
        batchId: sanitizeQueryId(req.query.batch_id, 'batch_id') || undefined,
        limit: Number(req.query.limit || 50),
      });

      return res.status(200).json({
        data: history,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    const payload = parseBody(req.body);
    const domainId = String(payload.domainId || '').trim();
    const tenantIds = parseTenantIds(payload);
    const batchId = String(payload.batchId || '').trim() || crypto.randomUUID();

    if (!domainId) {
      throw new Error('domainId is required');
    }

    if (req.method === 'POST') {
      enforceAnyPermission(auth.permissions, ['domains.assign']);
      const result = await service.assignTenants({
        tenantIds,
        domainId,
        actorUserId: auth.userId,
        batchId,
      });
      logApiEvent('info', '[DomainAssignmentAPI] bulk assignment completed', {
        correlationId: ctx.correlationId,
        userId: auth.userId,
        domainId,
        batchId: result.batchId,
        attempted: result.attempted,
        assigned: result.assigned,
        reactivated: result.reactivated,
        skipped: result.skipped,
      });
      return res.status(200).json({
        data: result,
        correlationId: ctx.correlationId,
        version: 'v1',
      });
    }

    enforceAnyPermission(auth.permissions, ['domains.revoke']);
    const result = await service.revokeTenants({
      tenantIds,
      domainId,
      actorUserId: auth.userId,
      batchId,
    });
    logApiEvent('info', '[DomainAssignmentAPI] bulk revocation completed', {
      correlationId: ctx.correlationId,
      userId: auth.userId,
      domainId,
      batchId: result.batchId,
      attempted: result.attempted,
      revoked: result.revoked,
      skipped: result.skipped,
    });
    return res.status(200).json({
      data: result,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[DomainAssignmentAPI] request failed', {
      correlationId: ctx.correlationId,
      userId: ctx.userId || null,
      tenantId: ctx.tenantId || null,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
