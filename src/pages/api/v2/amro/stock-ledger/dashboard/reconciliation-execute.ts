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
import { executeStockLedgerReconciliationRun } from '../reconciliationService';
import { loadP2Settings } from './p2SettingsStore';

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
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const supabase = getSupabaseAdminClient();
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const force = body.force === true;

    const settings = await loadP2Settings(supabase, tenantId);
    const policy = settings.alert_policy;
    const { data: latestRun, error: latestRunError } = await supabase
      .from('amro_stock_reconciliation_runs')
      .select('id,run_status,completed_at,started_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestRunError) throw latestRunError;

    const now = new Date();
    const lastCompletedAt = latestRun?.completed_at ? new Date(String(latestRun.completed_at)) : null;
    const frequencyMs = policy.frequency_hours * 60 * 60 * 1000;
    const isDue = !lastCompletedAt || now.getTime() - lastCompletedAt.getTime() >= frequencyMs;
    const nextDueAt = lastCompletedAt ? new Date(lastCompletedAt.getTime() + frequencyMs).toISOString() : now.toISOString();

    if (!policy.enabled && !force) {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-reconciliation-scheduled-execute',
        output: {
          status: 'skipped',
          reason: 'policy_disabled',
          policy,
          next_due_at: nextDueAt,
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    if (!isDue && !force) {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-reconciliation-scheduled-execute',
        output: {
          status: 'skipped',
          reason: 'not_due',
          policy,
          latest_run: latestRun || null,
          next_due_at: nextDueAt,
          latency_ms: Date.now() - startedAt,
        },
      });
      return;
    }

    const run = await executeStockLedgerReconciliationRun({
      supabase,
      tenantId,
      franchiseId,
      userId: auth.userId,
      parameters: {
        trigger: 'scheduled',
        force,
        policy_snapshot: policy,
      },
    });

    const [pendingApprovals, unresolvedVariances, openPeriods] = await Promise.all([
      supabase
        .from('amro_stock_approval_queue')
        .select('id,created_at', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('approval_status', 'pending'),
      supabase
        .from('amro_stock_reconciliation_items')
        .select('id,variance_quantity', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('run_id', run.runId)
        .gt('variance_quantity', policy.variance_threshold),
      supabase
        .from('amro_stock_period_closes')
        .select('id,period_start')
        .eq('tenant_id', tenantId)
        .eq('close_status', 'open')
        .order('period_start', { ascending: true })
        .limit(1),
    ]);

    const pendingCount = Number(pendingApprovals.count || 0);
    const varianceCount = Number(unresolvedVariances.count || 0);
    const oldestOpenPeriod = openPeriods.data?.[0] || null;
    const openPeriodAgeHours = oldestOpenPeriod?.period_start
      ? Math.max(0, (now.getTime() - new Date(String(oldestOpenPeriod.period_start)).getTime()) / (1000 * 60 * 60))
      : 0;

    const alerts: Array<{ code: string; severity: 'info' | 'warning' | 'critical'; message: string }> = [];
    if (varianceCount > 0) {
      alerts.push({
        code: 'reconciliation_variance',
        severity: varianceCount > 10 ? 'critical' : 'warning',
        message: `${varianceCount} variance item(s) exceeded threshold ${policy.variance_threshold.toFixed(4)}.`,
      });
    }
    if (pendingCount > 0) {
      alerts.push({
        code: 'pending_approvals',
        severity: pendingCount > 5 ? 'critical' : 'warning',
        message: `${pendingCount} approval request(s) remain pending.`,
      });
    }
    if (openPeriodAgeHours > policy.approval_sla_hours) {
      alerts.push({
        code: 'open_period_sla',
        severity: 'warning',
        message: `Oldest open period age ${openPeriodAgeHours.toFixed(1)}h exceeded SLA ${policy.approval_sla_hours}h.`,
      });
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-reconciliation-scheduled-execute',
      output: {
        status: 'executed',
        run_id: run.runId,
        inspected_items: run.inspectedItems,
        variance_items: run.varianceItems,
        policy,
        alerts,
        next_due_at: new Date(now.getTime() + frequencyMs).toISOString(),
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
