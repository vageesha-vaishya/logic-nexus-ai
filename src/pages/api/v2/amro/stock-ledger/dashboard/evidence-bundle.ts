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
    enforceAnyPermission(auth.permissions || [], ['inventory.admin', 'dashboards.view']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const supabase = getSupabaseAdminClient();
    const format = String(req.query.format || 'json').toLowerCase();

    const [audit, approvals, periods, recons] = await Promise.all([
      supabase
        .from('amro_stock_audit_export')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1000),
      supabase
        .from('amro_stock_approval_queue')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(1000),
      supabase
        .from('amro_stock_period_closes')
        .select('*')
        .eq('tenant_id', tenantId)
        .limit(500),
      supabase
        .from('amro_stock_reconciliation_runs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    if (audit.error) throw audit.error;
    if (approvals.error) throw approvals.error;
    if (periods.error) throw periods.error;
    if (recons.error) throw recons.error;

    const bundle = {
      generated_at: new Date().toISOString(),
      tenant_id: tenantId,
      audit_rows: audit.data || [],
      approval_rows: approvals.data || [],
      period_rows: periods.data || [],
      reconciliation_runs: recons.data || [],
    };

    if (format === 'csv') {
      const header = 'dataset,row_index,payload';
      const lines = [header];
      const append = (dataset: string, rows: unknown[]) => {
        rows.forEach((row, index) => {
          lines.push(
            `"${dataset}",${index},"${JSON.stringify(row).replace(/"/g, '""')}"`,
          );
        });
      };
      append('audit_rows', bundle.audit_rows);
      append('approval_rows', bundle.approval_rows);
      append('period_rows', bundle.period_rows);
      append('reconciliation_runs', bundle.reconciliation_runs);
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-evidence-bundle-csv',
        output: {
          csv: lines.join('\n'),
          total_rows: lines.length - 1,
        },
      });
      return;
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-evidence-bundle',
      output: bundle,
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
