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
    enforceRoles(auth.role, ['admin', 'operations', 'sales', 'developer', 'user']);

    const leadId = sanitizeQueryId(req.query.id, 'id');
    if (!leadId) throw new Error('Invalid id format');
    if (!ctx.tenantId) throw new Error('Invalid tenantId format');

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const descriptionRaw = String(body.description ?? '');
    const description = sanitizeRichTextHtml(descriptionRaw);
    const visibleLength = stripHtmlTags(description).length;
    if (visibleLength > 5000) {
      throw new Error('Invalid description format');
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('leads')
      .update({
        description,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenantId)
      .eq('id', leadId)
      .select('id,description,updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Lead not found', correlationId: ctx.correlationId });
    }

    logApiEvent('info', '[LeadDescriptionAPI] updated', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      leadId,
      size: visibleLength,
    });

    return res.status(200).json({
      data: {
        leadId: data.id,
        description: data.description || '',
        updatedAt: data.updated_at || null,
      },
      correlationId: ctx.correlationId,
      version: 'v1',
    });
  } catch (error) {
    logApiEvent('error', '[LeadDescriptionAPI] failed', {
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      message: error instanceof Error ? error.message : 'unknown',
    });
    sendErrorResponse(res, error, ctx.correlationId);
  }
}
