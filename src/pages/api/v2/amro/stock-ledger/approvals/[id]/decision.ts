import type { ApiRequest, ApiResponse } from '../../../../../_utils/types';
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
} from '../../../../../_utils/http';
import { sendErrorResponse } from '../../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../../_utils/supabaseAdmin';

const REQUIRED_PERMISSIONS = ['inventory.admin'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const startedAt = Date.now();
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
    const accessContext = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(accessContext, { correlationId: ctx.correlationId });
    const tenantId = String(accessContext.tenantId || '');
    const supabase = getSupabaseAdminClient();

    const approvalId = String(req.query.id || '').trim();
    if (!approvalId) {
      res.status(400).json({ error: 'id is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const decision = String(body.decision || '').trim();
    if (!['approved', 'rejected'].includes(decision)) {
      res.status(400).json({ error: 'decision must be either "approved" or "rejected"', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    const decisionNotes = body.notes ? String(body.notes).trim() : null;
    const expectedUpdatedAt = body.expected_updated_at ? String(body.expected_updated_at) : null;

    let updateQuery = supabase
      .from('amro_stock_approval_queue')
      .update({
        request_status: decision,
        reviewed_by: auth.userId,
        reviewed_at: new Date().toISOString(),
        decision_notes: decisionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', approvalId)
      .eq('request_status', 'pending');

    if (expectedUpdatedAt) {
      updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
    }

    const { data, error } = await updateQuery
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      const conflictError = expectedUpdatedAt
        ? 'Approval was modified by another user. Please refresh and try again.'
        : 'Approval not found or already decided';
      res.status(expectedUpdatedAt ? 409 : 404).json({ error: conflictError, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-approval-decision',
      output: {
        record: {
          id: data.id,
          request_type: data.request_type,
          request_status: data.request_status,
          related_period_id: data.related_period_id || null,
          related_transaction_id: data.related_transaction_id || null,
          reason: data.reason || null,
          decision_notes: data.decision_notes || null,
          reviewed_at: data.reviewed_at,
          created_at: data.created_at,
        },
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
