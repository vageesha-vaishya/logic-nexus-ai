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
import { sanitizeRichTextHtml, stripHtmlTags } from '@/lib/utils/sanitizer';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['PUT'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);
  res.setHeader('x-correlation-id', ctx.correlationId);

  try {
    if (req.method !== 'PUT') {
      res.setHeader('Allow', ['PUT']);
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
    if (!leadId) throw new Error('Invalid id format');
    if (!ctx.tenantId) throw new Error('Invalid tenantId format');

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const notesRaw = String(body.notes ?? '');
    const notes = sanitizeRichTextHtml(notesRaw);
    const visibleLength = stripHtmlTags(notes).length;
    if (visibleLength > 10000) {
      throw new Error('Invalid notes format');
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('leads')
      .update({
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenantId)
      .eq('id', leadId)
      .select('id,notes,updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Lead not found', correlationId: ctx.correlationId });
    }

    logApiEvent('info', '[LeadNotesAPI] updated', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      leadId,
      size: visibleLength,
    });

    return res.status(200).json({
      data: {
        leadId: data.id,
        notes: data.notes || '',
        updatedAt: data.updated_at || null,
      },
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[LeadNotesAPI] failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
