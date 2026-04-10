import { randomUUID } from 'node:crypto';
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
import { loadP2Settings, saveP2Settings, type ReportTemplateConfig } from './p2SettingsStore';

const READ_PERMISSIONS = ['inventory.read', 'dashboards.view'];
const WRITE_PERMISSIONS = ['inventory.admin'];

function normalizeReportType(value: unknown): ReportTemplateConfig['report_type'] {
  const reportType = String(value || '').trim();
  if (reportType === 'stock-balance' || reportType === 'transaction-history' || reportType === 'valuation-summary') return reportType;
  throw new Error('report_type must be stock-balance, transaction-history, or valuation-summary');
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  try {
    if (!['GET', 'POST', 'DELETE'].includes(req.method || '')) {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed`, version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    enforceAnyPermission(auth.permissions || [], req.method === 'GET' ? READ_PERMISSIONS : WRITE_PERMISSIONS);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });
    const tenantId = String(access.tenantId || '');
    const supabase = getSupabaseAdminClient();
    const settings = await loadP2Settings(supabase, tenantId);

    if (req.method === 'GET') {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-report-templates',
        output: { records: settings.report_templates },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '').trim();
      if (!id) {
        res.status(400).json({ error: 'id query parameter is required', version: 'v2', correlationId: ctx.correlationId });
        return;
      }
      const nextTemplates = settings.report_templates.filter((template) => template.id !== id);
      const nextSchedules = settings.scheduled_exports.filter((schedule) => schedule.template_id !== id);
      const saved = await saveP2Settings(supabase, tenantId, {
        ...settings,
        report_templates: nextTemplates,
        scheduled_exports: nextSchedules,
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-report-template-delete',
        output: {
          records: saved.report_templates,
          schedules: saved.scheduled_exports,
        },
      });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const nowIso = new Date().toISOString();
    const id = String(body.id || '').trim() || randomUUID();
    const name = String(body.name || '').trim();
    if (!name) throw new Error('name is required');
    const reportType = normalizeReportType(body.report_type);
    const existing = settings.report_templates.find((template) => template.id === id);
    const nextTemplate: ReportTemplateConfig = {
      id,
      name,
      report_type: reportType,
      filters: body.filters && typeof body.filters === 'object' ? (body.filters as Record<string, unknown>) : {},
      columns: Array.isArray(body.columns) ? body.columns.map((column) => String(column)).filter((column) => column) : [],
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso,
    };
    const nextTemplates = existing
      ? settings.report_templates.map((template) => (template.id === id ? nextTemplate : template))
      : [nextTemplate, ...settings.report_templates];
    const saved = await saveP2Settings(supabase, tenantId, {
      ...settings,
      report_templates: nextTemplates,
    });
    res.status(existing ? 200 : 201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: existing ? 'amro-stock-ledger-report-template-update' : 'amro-stock-ledger-report-template-create',
      output: {
        record: nextTemplate,
        records: saved.report_templates,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
