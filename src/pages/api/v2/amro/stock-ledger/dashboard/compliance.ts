import type { ApiRequest, ApiResponse } from '../../../../_utils/types';
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
} from '../../../../_utils/http';
import { sendErrorResponse } from '../../../../_utils/errorHandler';
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    enforceAnyPermission(auth.permissions || [], ['inventory.read', 'dashboards.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const supabase = getSupabaseAdminClient();
    const now = Date.now();
    const staleHours = Number(req.query.stale_hours || 24);

    const [auditRows, approvals, periods, reconciliations] = await Promise.all([
      supabase
        .from('amro_stock_audit_timeline')
        .select('id,immutable_hash,created_at,event_type')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('amro_stock_approval_queue')
        .select('id,request_status,created_at')
        .eq('tenant_id', tenantId),
      supabase
        .from('amro_stock_period_closes')
        .select('id,close_status,period_code,period_end')
        .eq('tenant_id', tenantId),
      supabase
        .from('amro_stock_reconciliation_runs')
        .select('id,run_status,created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (auditRows.error) throw auditRows.error;
    if (approvals.error) throw approvals.error;
    if (periods.error) throw periods.error;
    if (reconciliations.error) throw reconciliations.error;

    const audit = auditRows.data || [];
    const approvalRows = approvals.data || [];
    const staleApprovals = approvalRows.filter((row) => {
      const createdAt = String((row as Record<string, unknown>).created_at || '');
      if (!createdAt) return false;
      return (now - new Date(createdAt).getTime()) > staleHours * 60 * 60 * 1000;
    }).length;
    const pendingApprovals = approvalRows.filter((row) => String((row as Record<string, unknown>).request_status) === 'pending').length;
    const hashCoverage = audit.length === 0
      ? 100
      : Math.round((audit.filter((row) => String((row as Record<string, unknown>).immutable_hash || '').length >= 64).length / audit.length) * 10000) / 100;
    const openPeriods = (periods.data || []).filter((row) => String((row as Record<string, unknown>).close_status || '') === 'open').length;
    const failedRecons = (reconciliations.data || []).filter((row) => String((row as Record<string, unknown>).run_status || '') === 'failed').length;

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-compliance-dashboard',
      output: {
        immutable_hash_coverage_percent: hashCoverage,
        pending_approvals: pendingApprovals,
        stale_approvals: staleApprovals,
        open_periods: openPeriods,
        failed_reconciliation_runs: failedRecons,
        evidence_snapshot: {
          audit_rows: audit.length,
          approval_rows: approvalRows.length,
          period_rows: (periods.data || []).length,
          reconciliation_rows: (reconciliations.data || []).length,
        },
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
