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
import { loadP2Settings } from './p2SettingsStore';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const startedAt = Date.now();
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

    const settings = await loadP2Settings(supabase, tenantId);
    const policy = settings.alert_policy;
    const [openApprovals, latestRecon, valuationData, openPeriods, breachedApprovals, unresolvedVariance] = await Promise.all([
      supabase
        .from('amro_stock_approval_queue')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('approval_status', 'pending'),
      supabase
        .from('amro_stock_reconciliation_runs')
        .select('id,run_status,variance_amount,completed_at,started_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('amro_stock_ledger_current_balance')
        .select('inventory_value')
        .eq('tenant_id', tenantId),
      supabase
        .from('amro_stock_period_closes')
        .select('id,period_start')
        .eq('tenant_id', tenantId)
        .eq('close_status', 'open')
        .order('period_start', { ascending: true }),
      supabase
        .from('amro_stock_approval_queue')
        .select('id,created_at')
        .eq('tenant_id', tenantId)
        .eq('approval_status', 'pending'),
      supabase
        .from('amro_stock_reconciliation_items')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .gt('variance_quantity', policy.variance_threshold),
    ]);

    if (openApprovals.error) throw openApprovals.error;
    if (latestRecon.error) throw latestRecon.error;
    if (valuationData.error) throw valuationData.error;
    if (openPeriods.error) throw openPeriods.error;
    if (breachedApprovals.error) throw breachedApprovals.error;
    if (unresolvedVariance.error) throw unresolvedVariance.error;

    const totalInventoryValue = (valuationData.data || []).reduce((acc, row) => acc + Number((row as any).inventory_value || 0), 0);
    const now = Date.now();
    const oldestOpenPeriod = (openPeriods.data || [])[0] as { period_start?: string } | undefined;
    const openPeriodAgeHours = oldestOpenPeriod?.period_start
      ? Math.max(0, (now - new Date(oldestOpenPeriod.period_start).getTime()) / (1000 * 60 * 60))
      : 0;
    const approvalSlaBreaches = (breachedApprovals.data || []).filter((row) => {
      const createdAt = (row as { created_at?: string }).created_at;
      if (!createdAt) return false;
      return now - new Date(createdAt).getTime() > policy.approval_sla_hours * 60 * 60 * 1000;
    }).length;

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-dashboard-kpis',
      output: {
        pending_approvals: Number(openApprovals.count || 0),
        pending_approval_sla_breaches: approvalSlaBreaches,
        latest_reconciliation: latestRecon.data || null,
        unresolved_variance_items: Number(unresolvedVariance.count || 0),
        open_period_age_hours: openPeriodAgeHours,
        reconciliation_policy: policy,
        total_inventory_value: totalInventoryValue,
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
