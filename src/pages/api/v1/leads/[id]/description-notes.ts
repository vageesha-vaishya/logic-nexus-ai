import type { ApiRequest, ApiResponse } from '@/pages/api/_utils/types';
import {
  applyCors,
  authenticateRequest,
  buildApiContext,
  enforceHttps,
  enforceRateLimit,
  enforceRoles,
  handlePreflight,
  logApiEvent,
  resolveAndApplyAccessContext,
  sanitizeQueryId,
} from '@/pages/api/_utils/http';
import { sendErrorResponse } from '@/pages/api/_utils/errorHandler';
import { getSupabaseAdminClient } from '@/pages/api/_utils/supabaseAdmin';
import { sanitizeRichTextHtml } from '@/lib/utils/sanitizer';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET'] });
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
    await resolveAndApplyAccessContext(req, ctx);
    enforceRoles(auth.role, ['admin', 'operations', 'sales', 'developer', 'user']);

    const leadId = sanitizeQueryId(req.query.id, 'id');
    if (!leadId) {
      throw new Error('Invalid id format');
    }
    if (!ctx.tenantId) {
      throw new Error('Invalid tenantId format');
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('leads')
      .select('id,description,notes,updated_at')
      .eq('tenant_id', ctx.tenantId)
      .eq('id', leadId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Lead not found', correlationId: ctx.correlationId });
    }

    const payload = {
      leadId: data.id,
      description: sanitizeRichTextHtml(String(data.description || '')),
      notes: sanitizeRichTextHtml(String(data.notes || '')),
      updatedAt: data.updated_at || null,
    };

    logApiEvent('info', '[LeadDescriptionNotesAPI] fetched', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      leadId,
    });

    return res.status(200).json({ data: payload, correlationId: ctx.correlationId, version: 'v1' });
  } catch (error) {
    logApiEvent('error', '[LeadDescriptionNotesAPI] failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
