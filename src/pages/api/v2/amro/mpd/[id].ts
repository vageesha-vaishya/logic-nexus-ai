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
import {
  asObject,
  mapMpdPayloadToTaskTemplateInput,
  mapTaskTemplateRowToMpd,
  normalizeString,
  parseTaskTemplateRowsWithFallback,
  taskTemplateSelectColumns,
  validateMpdInput,
} from './shared';

function isEnabled(): boolean {
  const normalized = String(process.env.AMRO_MPD_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;

  const ctx = buildApiContext(req);

  try {
    if (!isEnabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
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
    enforceAnyPermission(auth.permissions || [], ['dashboards.view', 'view_amro_dashboard', 'edit_aircraft_records']);
    const access = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(access, { correlationId: ctx.correlationId });

    const tenantId = String(access.tenantId || '');
    const franchiseId = access.franchiseId ? String(access.franchiseId) : null;
    const id = String(req.query.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'id is required', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const selectWithFallback = async (sequenceColumn: 'tt_sequence' | 'task_template_id', modelColumn: 'assembly_models' | 'model_id') => {
      const supabase = getSupabaseAdminClient();
      return supabase
        .from('task_templates')
        .select(taskTemplateSelectColumns(sequenceColumn, modelColumn))
        .eq('tenant_id', tenantId)
        .eq('id', id)
        .limit(1)
        .maybeSingle();
    };

    const current = await parseTaskTemplateRowsWithFallback<Record<string, unknown>>(selectWithFallback);
    if (current.error) {
      throw new Error(`Failed to query MPD record: ${current.error.message}`);
    }
    if (!current.data) {
      res.status(404).json({ error: 'Record not found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    const existing = current.data as Record<string, unknown>;
    const existingFranchiseId = normalizeString(existing.franchise_id);
    if (franchiseId && existingFranchiseId && existingFranchiseId !== franchiseId) {
      res.status(403).json({ error: 'Forbidden', version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    if (req.method === 'GET') {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-mpd-detail',
        output: {
          record: mapTaskTemplateRowToMpd(existing, current.sequenceColumn, current.modelColumn),
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const supabase = getSupabaseAdminClient();
      const { error: deleteError } = await supabase
        .from('task_templates')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', id);

      if (deleteError) {
        throw new Error(`Failed to delete MPD record: ${deleteError.message}`);
      }

      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        interface: 'amro-mpd-delete',
        output: { id, deleted: true },
      });
      return;
    }

    const payload = asObject(req.body);
    const issues = validateMpdInput(payload, 'patch');
    if (issues.length > 0) {
      res.status(400).json({ error: 'Validation failed', issues, version: 'v2', correlationId: ctx.correlationId });
      return;
    }

    const patch = mapMpdPayloadToTaskTemplateInput(payload, current.modelColumn);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({
        error: 'Validation failed',
        issues: [{ field: 'payload', message: 'No MPD fields provided for update' }],
        version: 'v2',
        correlationId: ctx.correlationId,
      });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: updated, error: updateError } = await supabase
      .from('task_templates')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select(taskTemplateSelectColumns(current.sequenceColumn, current.modelColumn))
      .limit(1)
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update MPD record: ${updateError.message}`);
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      interface: 'amro-mpd-update',
      output: {
        record: mapTaskTemplateRowToMpd((updated || {}) as Record<string, unknown>, current.sequenceColumn, current.modelColumn),
      },
    });
  } catch (error) {
    sendErrorResponse(res, error, ctx.correlationId, { apiVersion: 'v2' });
  }
}
