import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceAmroDomainAccess,
  enforceAnyPermission,
  enforceHttps,
  enforceRateLimit,
  handlePreflight,
  resolveAndApplyAccessContext,
} from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { executeStockLedgerReconciliationRun } from './reconciliationService';

const REQUIRED_PERMISSIONS = ['inventory.admin'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], REQUIRED_PERMISSIONS);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const supabase = getSupabaseAdminClient();
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const requestBody =
      req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const trigger = requestBody.trigger ? String(requestBody.trigger) : 'manual';

    const result = await executeStockLedgerReconciliationRun({
      supabase,
      tenantId,
      franchiseId,
      userId: auth.userId,
      parameters: { ...requestBody, trigger },
    });

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-reconcile',
      output: {
        run_id: result.runId,
        inspected_items: result.inspectedItems,
        variance_items: result.varianceItems,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
