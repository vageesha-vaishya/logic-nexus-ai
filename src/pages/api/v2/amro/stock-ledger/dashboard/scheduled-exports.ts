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
import { loadP2Settings, saveP2Settings, type ScheduledExportConfig } from './p2SettingsStore';

const READ_PERMISSIONS = ['inventory.read', 'dashboards.view'];
const WRITE_PERMISSIONS = ['inventory.admin'];

function computeNextRun(frequency: ScheduledExportConfig['frequency'], fromIso?: string): string {
  const base = fromIso ? new Date(fromIso) : new Date();
  if (frequency === 'daily') base.setUTCDate(base.getUTCDate() + 1);
  if (frequency === 'weekly') base.setUTCDate(base.getUTCDate() + 7);
  if (frequency === 'monthly') base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString();
}

function parseFrequency(value: unknown): ScheduledExportConfig['frequency'] {
  const frequency = String(value || '').trim();
  if (frequency === 'daily' || frequency === 'weekly' || frequency === 'monthly') return frequency;
  throw new Error('frequency must be daily, weekly, or monthly');
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  try {
    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method || '')) {
      res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
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
        interface: 'amro-stock-ledger-scheduled-exports',
        output: { records: settings.scheduled_exports },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '').trim();
      if (!id) {
        res.status(400).json({ error: 'id query parameter is required', version: 'v2', correlationId: ctx.correlationId });
        return;
      }
      const nextSchedules = settings.scheduled_exports.filter((schedule) => schedule.id !== id);
      const saved = await saveP2Settings(supabase, tenantId, { ...settings, scheduled_exports: nextSchedules });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-stock-ledger-scheduled-export-delete',
        output: { records: saved.scheduled_exports },
      });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const nowIso = new Date().toISOString();

    if (req.method === 'PATCH') {
      const id = String(body.id || '').trim();
      if (!id) throw new Error('id is required');
      const existing = settings.scheduled_exports.find((schedule) => schedule.id === id);
      if (!existing) throw new Error(`schedule ${id} not found`);
      const executeNow = body.execute_now === true;
      const enabled = body.enabled === undefined ? existing.enabled : body.enabled === true;
      const frequency = body.frequency === undefined ? existing.frequency : parseFrequency(body.frequency);
      const updated: ScheduledExportConfig = {
        ...existing,
        enabled,
        frequency,
        next_run_at: executeNow ? computeNextRun(frequency, nowIso) : (body.next_run_at ? String(body.next_run_at) : existing.next_run_at),
        updated_at: nowIso,
      };
      const nextSchedules = settings.scheduled_exports.map((schedule) => (schedule.id === id ? updated : schedule));
      const saved = await saveP2Settings(supabase, tenantId, { ...settings, scheduled_exports: nextSchedules });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: executeNow
          ? 'amro-stock-ledger-scheduled-export-execute'
          : 'amro-stock-ledger-scheduled-export-update',
        output: {
          record: updated,
          records: saved.scheduled_exports,
          executed_at: executeNow ? nowIso : null,
        },
      });
      return;
    }

    const id = String(body.id || '').trim() || randomUUID();
    const templateId = String(body.template_id || '').trim();
    if (!templateId) throw new Error('template_id is required');
    const templateExists = settings.report_templates.some((template) => template.id === templateId);
    if (!templateExists) throw new Error(`template_id ${templateId} does not exist`);
    const frequency = parseFrequency(body.frequency);
    const record: ScheduledExportConfig = {
      id,
      template_id: templateId,
      frequency,
      timezone: String(body.timezone || 'UTC'),
      next_run_at: body.next_run_at ? String(body.next_run_at) : computeNextRun(frequency, nowIso),
      destinations: Array.isArray(body.destinations)
        ? body.destinations.map((destination) => String(destination)).filter((destination) => destination)
        : ['in_app'],
      enabled: body.enabled !== false,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const nextSchedules = [record, ...settings.scheduled_exports];
    const saved = await saveP2Settings(supabase, tenantId, { ...settings, scheduled_exports: nextSchedules });
    res.status(201).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-stock-ledger-scheduled-export-create',
      output: {
        record,
        records: saved.scheduled_exports,
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
