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
import { mapStockLedgerRow } from './shared';

const REQUIRED_PERMISSIONS = ['inventory.admin', 'inventory.read', 'dashboards.view'];

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const startedAt = Date.now();
  try {
    if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
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
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const id = String(req.query.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    const supabase = getSupabaseAdminClient();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('amro_stock_ledger_transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'Record not found', version: 'v2', correlationId: ctx.correlationId });
        return;
      }
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-read',
        output: { record: mapStockLedgerRow(data as Record<string, unknown>), latency_ms: Date.now() - startedAt },
      });
      return;
    }

    if (req.method === 'PATCH') {
      const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
      const patch = {
        notes: body.notes === undefined ? undefined : String(body.notes || ''),
        source_reference: body.source_reference === undefined ? undefined : String(body.source_reference || ''),
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : undefined,
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
      };
      const updatePayload = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      if (Object.keys(updatePayload).length === 0) {
        res.status(400).json({ error: 'No mutable fields provided', version: 'v2', correlationId: ctx.correlationId });
        return;
      }
      const { data, error } = await supabase
        .from('amro_stock_ledger_transactions')
        .update(updatePayload)
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .eq('is_voided', false)
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'Record not found or already voided', version: 'v2', correlationId: ctx.correlationId });
        return;
      }
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-update',
        output: { record: mapStockLedgerRow(data as Record<string, unknown>), latency_ms: Date.now() - startedAt },
      });
      return;
    }

    const reason = String((req.body as Record<string, unknown> | undefined)?.reason || 'Transaction voided').trim();
    const { data, error } = await supabase.rpc('amro_stock_ledger_void_transaction', {
      p_tenant_id: tenantId,
      p_franchise_id: franchiseId,
      p_user_id: auth.userId,
      p_transaction_id: id,
      p_reason: reason,
    });
    if (error) throw error;
    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-delete',
      output: {
        reversal_record: mapStockLedgerRow((data as unknown as Record<string, unknown>) || {}),
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
