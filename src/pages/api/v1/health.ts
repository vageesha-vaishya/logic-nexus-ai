import type { ApiRequest, ApiResponse } from '../_utils/types';
import { applyCors, buildApiContext, handlePreflight } from '../_utils/http';
import { getSupabaseAdminClient } from '../_utils/supabaseAdmin';
import { ContainerMetadataApiService } from '@/services/logistics/ContainerMetadataApiService';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res);
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
  }

  try {
    const service = new ContainerMetadataApiService(getSupabaseAdminClient());
    const health = await service.checkHealth();
    const ok = health.db && health.cache;

    return res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      checks: health,
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error: any) {
    return res.status(503).json({
      status: 'down',
      checks: { db: false, cache: false },
      error: error?.message || 'Health check failed',
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  }
}
