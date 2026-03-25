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
import { fetchWorkflowTransactionLogByTransitionId } from '../../workflow-transaction-logger';

function resolveTransitionId(req: ApiRequest): string {
  const raw = Array.isArray(req.query.transitionId) ? req.query.transitionId[0] : req.query.transitionId;
  const transitionId = String(raw || '').trim();
  if (!transitionId) {
    throw new Error('transitionId is required');
  }
  return transitionId;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  const startedAt = Date.now();
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
    const transitionId = resolveTransitionId(req);
    const record = await fetchWorkflowTransactionLogByTransitionId(transitionId);
    if (!record) {
      res.status(404).json({
        version: 'v2',
        error: 'Workflow transaction log entry not found',
        transition_id: transitionId,
        correlationId: ctx.correlationId,
      });
      return;
    }
    const elapsedMs = Date.now() - startedAt;
    res.status(200).json({
      version: 'v2',
      transition_id: transitionId,
      p99_target_ms: 50,
      elapsed_ms: elapsedMs,
      log: record,
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
