import type { ApiRequest, ApiResponse } from '../../_utils/types';
import { getSupabaseAdminClient } from '../../_utils/supabaseAdmin';
import { applyCors, authenticateRequest, buildApiContext, enforceAnyPermission, enforceCsrfProtection, enforceHttps, enforceRateLimit, enforceRoles, handlePreflight, logApiEvent } from '../../_utils/http';
import { sendErrorResponse } from '../../_utils/errorHandler';
import { importPayloadSchema, processQuotationImportJob } from './import/processor';
import { enqueueQuotationImportJob } from './import/queue';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    enforceCsrfProtection(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceRoles(auth.role, ['admin', 'operations', 'sales', 'developer']);
    enforceAnyPermission(auth.permissions, ['import_quotation', 'quotes.import_export']);

    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Missing tenant context', correlationId: ctx.correlationId });
    }

    const parsedPayload = importPayloadSchema.safeParse(req.body);
    if (!parsedPayload.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        issues: parsedPayload.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        correlationId: ctx.correlationId,
      });
    }

    const payload = parsedPayload.data;
    const db = getSupabaseAdminClient();

    const { data: session, error: sessionError } = await db
      .from('import_history')
      .insert({
        entity_name: 'Quotes',
        table_name: 'quotes',
        file_name: `api-${payload.format}-${Date.now()}`,
        imported_by: ctx.userId,
        tenant_id: ctx.tenantId,
        status: 'partial',
        summary: { success: 0, failed: 0, inserted: 0, updated: 0 },
      })
      .select('id')
      .single();

    if (sessionError || !session) throw new Error(sessionError?.message || 'Unable to initialize import session');
    const importId = String((session as any).id);

    if (payload.async) {
      await db
        .from('import_history')
        .update({
          status: 'queued',
          summary: { success: 0, failed: 0, inserted: 0, updated: 0, queued: payload.rows.length },
        })
        .eq('id', importId);

      const enqueued = await enqueueQuotationImportJob({
        importId,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        payload,
        correlationId: ctx.correlationId,
      });

      if (!enqueued) {
        void processQuotationImportJob({
          importId,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          payload,
          correlationId: ctx.correlationId,
        });
      }

      return res.status(202).json({
        version: 'v2',
        importId,
        summary: { success: 0, failed: 0, inserted: 0, updated: 0 },
        job: {
          id: importId,
          status: 'queued',
          progress: 0,
          cancellable: true,
          statusEndpoint: `/api/v2/quotations/import/job?importId=${importId}`,
          cancelEndpoint: `/api/v2/quotations/import/job?importId=${importId}`,
        },
        rollback: { endpoint: '/api/v2/quotations/import/rollback', importId },
        correlationId: ctx.correlationId,
      });
    }

    const result = await processQuotationImportJob({
      importId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      payload,
      correlationId: ctx.correlationId,
    });

    return res.status(200).json({
      version: 'v2',
      importId,
      summary: result.summary,
      job: { id: importId, status: result.status, progress: result.status === 'success' || result.status === 'failed' ? 100 : 50, cancellable: false },
      rollback: { endpoint: '/api/v2/quotations/import/rollback', importId },
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    logApiEvent('error', '[QuotationImportV2] import failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
