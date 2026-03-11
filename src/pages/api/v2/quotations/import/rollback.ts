import { z } from 'zod';
import type { ApiRequest, ApiResponse } from '../../../_utils/types';
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { applyCors, authenticateRequest, buildApiContext, enforceAnyPermission, enforceCsrfProtection, enforceHttps, enforceRateLimit, enforceRoles, handlePreflight, logApiEvent } from '../../../_utils/http';
import { sendErrorResponse } from '../../../_utils/errorHandler';

const rollbackPayloadSchema = z.object({
  importId: z.string().uuid(),
});

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
    enforceRoles(auth.role, ['admin', 'operations', 'developer']);
    enforceAnyPermission(auth.permissions, ['import_quotation', 'quotes.import_export']);

    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Missing tenant context', correlationId: ctx.correlationId });
    }

    const parsedPayload = rollbackPayloadSchema.safeParse(req.body);
    if (!parsedPayload.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        issues: parsedPayload.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        correlationId: ctx.correlationId,
      });
    }

    const { importId } = parsedPayload.data;
    const db = getSupabaseAdminClient();

    const { data: session, error: sessionError } = await db
      .from('import_history')
      .select('*')
      .eq('id', importId)
      .eq('tenant_id', ctx.tenantId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Import session not found', correlationId: ctx.correlationId });
    }

    if ((session as any).status === 'reverted') {
      return res.status(409).json({ error: 'Import already reverted', correlationId: ctx.correlationId });
    }

    const details: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error } = await db
        .from('import_history_details')
        .select('*')
        .eq('import_id', importId)
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!page || page.length === 0) break;
      details.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    const inserts = details.filter((d) => d.operation_type === 'insert');
    const updates = details.filter((d) => d.operation_type === 'update');
    const idsToDelete = inserts.map((d) => d.record_id).filter(Boolean);
    const restoreRows = updates.map((d) => d.previous_data).filter(Boolean);

    for (let i = 0; i < idsToDelete.length; i += 1000) {
      const chunk = idsToDelete.slice(i, i + 1000);
      if (!chunk.length) continue;
      const { error } = await db.from('quotes').delete().in('id', chunk);
      if (error) throw new Error(error.message);
    }

    for (let i = 0; i < restoreRows.length; i += 1000) {
      const chunk = restoreRows.slice(i, i + 1000);
      if (!chunk.length) continue;
      const { error } = await db.from('quotes').upsert(chunk, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }

    await db
      .from('import_history')
      .update({
        status: 'reverted',
        reverted_at: new Date().toISOString(),
        reverted_by: ctx.userId,
      })
      .eq('id', importId);

    logApiEvent('info', '[QuotationImportV2] rollback completed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      importId,
      revertedInserts: idsToDelete.length,
      revertedUpdates: restoreRows.length,
    });

    return res.status(200).json({
      version: 'v2',
      importId,
      revertedInserts: idsToDelete.length,
      revertedUpdates: restoreRows.length,
      correlationId: ctx.correlationId,
    });
  } catch (error) {
    logApiEvent('error', '[QuotationImportV2] rollback failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
