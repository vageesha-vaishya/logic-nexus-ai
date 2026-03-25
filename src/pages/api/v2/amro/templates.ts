import type { ApiRequest, ApiResponse } from '../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { listTemplateRegistryEntries } from './template-registry-client';

function resolveRegistryVersion(req: ApiRequest): string {
  const raw = Array.isArray(req.query.registryVersion) ? req.query.registryVersion[0] : req.query.registryVersion;
  return String(raw || 'latest').trim() || 'latest';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ version: 'v2', error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    const auth = await authenticateRequest(req);
    enforceAnyPermission(auth.permissions || [], ['dashboards.view']);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const registryVersion = resolveRegistryVersion(req);
    const templates = await listTemplateRegistryEntries({
      tenantId: String(access.tenantId || ''),
      userId: String(auth.userId || ''),
      registryVersion,
    });
    res.status(200).json({
      version: 'v2',
      source: 'template-registry',
      registryVersion,
      templates,
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
