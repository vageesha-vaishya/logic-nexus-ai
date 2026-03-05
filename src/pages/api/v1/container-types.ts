import type { ApiRequest, ApiResponse } from '../_utils/types';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { ContainerMetadataApiService } from '@/services/logistics/ContainerMetadataApiService';
import { applyCors, authenticateRequest, buildApiContext, enforceHttps, enforceRateLimit, enforceRoles, handlePreflight, logApiEvent } from '../_utils/http';
import { sendErrorResponse } from '../_utils/errorHandler';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res);
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
    enforceRoles(auth.role, ['admin', 'operations', 'sales', 'developer', 'user']);

    const service = new ContainerMetadataApiService(getSupabaseAdminClient());
    const data = await service.getContainerTypes(ctx.tenantId);

    if (!data.length) {
      return res.status(404).json({ error: 'No container types found', correlationId: ctx.correlationId });
    }

    logApiEvent('info', '[ContainerAPI] container-types fetched', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      count: data.length,
    });

    return res.status(200).json({ data, correlationId: ctx.correlationId, version: 'v1' });
  } catch (error) {
    logApiEvent('error', '[ContainerAPI] container-types failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
