import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { checkAmroOpsPersistenceHealth } from '../../work-package-persistence';

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
    const health = await checkAmroOpsPersistenceHealth(500);
    if (!health.ok) {
      res.status(503).json({
        version: 'v2',
        status: 'degraded',
        schema: 'amro_ops',
        elapsed_ms: health.elapsedMs,
        threshold_ms: 500,
        correlationId: ctx.correlationId,
      });
      return;
    }
    res.status(200).json({
      version: 'v2',
      status: 'ok',
      schema: 'amro_ops',
      elapsed_ms: health.elapsedMs,
      threshold_ms: 500,
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
