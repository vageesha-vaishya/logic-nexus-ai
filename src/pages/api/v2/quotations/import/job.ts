import { z } from 'zod';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { applyCors, authenticateRequest, buildApiContext, enforceAnyPermission, enforceCsrfProtection, enforceHttps, enforceRateLimit, enforceRoles, handlePreflight, logApiEvent } from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';
import { cancelQueuedQuotationImportJob } from './queue';

const importIdQuerySchema = z.object({
  importId: z.string().uuid(),
});

function toJobProgress(status: string): number {
  if (status === 'queued') return 0;
  if (status === 'partial') return 50;
  return 100;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  try {
    const method = String(req.method || '').toUpperCase();
    if (method !== 'GET' && method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    enforceCsrfProtection(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceRoles(auth.role, ['admin', 'operations', 'sales', 'developer']);
    enforceAnyPermission(auth.permissions, ['import_quotation', 'quotes.import_export', 'export_quotation']);

    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Missing tenant context', correlationId: ctx.correlationId });
    }

    const parsedQuery = importIdQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        error: 'Invalid request query',
        issues: parsedQuery.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        correlationId: ctx.correlationId,
      });
    }

    const db = getSupabaseAdminClient();
    const importId = parsedQuery.data.importId;
    const { data: session, error: sessionError } = await db
      .from('import_history')
      .select('*')
      .eq('id', importId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Import session not found', correlationId: ctx.correlationId });
    }

    if (method === 'DELETE') {
      const currentStatus = String((session as any).status || '');
      if (currentStatus === 'success' || currentStatus === 'failed' || currentStatus === 'reverted' || currentStatus === 'cancelled') {
        return res.status(409).json({ error: 'Job is not cancellable', correlationId: ctx.correlationId });
      }

      const removedFromQueue = await cancelQueuedQuotationImportJob(importId);

      await db
        .from('import_history')
        .update({
          status: 'cancelled',
          summary: { ...((session as any).summary || {}), cancelled: true, removedFromQueue },
        })
        .eq('id', importId);

      logApiEvent('info', '[QuotationImportV2] job cancelled', {
        correlationId: ctx.correlationId,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        importId,
      });

      return res.status(200).json({
        version: 'v2',
        job: {
          id: importId,
          status: 'cancelled',
          progress: 100,
          cancellable: false,
        },
        correlationId: ctx.correlationId,
      });
    }

    const status = String((session as any).status || 'queued');
    return res.status(200).json({
      version: 'v2',
      job: {
        id: importId,
        status,
        progress: toJobProgress(status),
        cancellable: status === 'queued' || status === 'partial',
        summary: (session as any).summary || { success: 0, failed: 0, inserted: 0, updated: 0 },
      },
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    logApiEvent('error', '[QuotationImportV2] job endpoint failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
