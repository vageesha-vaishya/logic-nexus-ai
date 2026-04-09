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
import { getSupabaseAdminClient } from '../../../_utils/supabaseAdmin';
import { logger } from '@/lib/logger';

type TaskTemplateRow = Record<string, unknown>;

const isMissingColumnError = (error: unknown, columnName: string) => {
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && (message.includes('column') || message.includes('does not exist'));
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (handlePreflight(req, res)) return;
  applyCors(req, res, { methods: ['GET', 'OPTIONS'] });

  const ctx = buildApiContext(req);
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET', 'OPTIONS']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed`, correlationId: ctx.correlationId });
    }

    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);

    const tenantId = String(scopedAccess.tenantId || '').trim();
    const tenantIdFromQuery = String(req.query.tenant_id || '').trim();
    const aircraftModelId = String(req.query.aircraft_model_id || '').trim();
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId || '').trim() : '';
    const normalizedRole = String((auth as { role?: string }).role || '').trim().toLowerCase();
    const isTenantAdmin = normalizedRole === 'tenant_admin';
    const isPlatformAdmin = Boolean(scopedAccess.isPlatformAdmin);

    if (!aircraftModelId) {
      return res.status(400).json({ error: 'aircraft_model_id is required', correlationId: ctx.correlationId });
    }
    if (!tenantId && !isPlatformAdmin) {
      return res.status(400).json({ error: 'Tenant scope missing for task template options', correlationId: ctx.correlationId });
    }
    if (tenantId && tenantIdFromQuery && tenantIdFromQuery !== tenantId) {
      return res.status(403).json({ error: 'tenant_id does not match access scope', correlationId: ctx.correlationId });
    }

    const supabase = getSupabaseAdminClient();

    const runTaskTemplateQuery = async (modelColumn: 'assembly_models' | 'model_id', includeFranchiseColumn: boolean) => {
      let query = supabase
        .from('task_templates')
        .select(includeFranchiseColumn
          ? 'id,tt_sequence,code_form_no,ata_code,reference_amp,description,category_code,estimated_man_hours,is_mandatory,task_template_detail_json,tenant_id,franchise_id'
          : 'id,tt_sequence,code_form_no,ata_code,reference_amp,description,category_code,estimated_man_hours,is_mandatory,task_template_detail_json,tenant_id')
        .eq(modelColumn, aircraftModelId)
        .order('tt_sequence', { ascending: true });

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      if (includeFranchiseColumn && !isTenantAdmin && franchiseId) {
        query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
      }

      return query;
    };

    let { data, error } = await runTaskTemplateQuery('assembly_models', true);

    if (error && isMissingColumnError(error, 'assembly_models')) {
      ({ data, error } = await runTaskTemplateQuery('model_id', true));
    }
    if (error && isMissingColumnError(error, 'franchise_id')) {
      ({ data, error } = await runTaskTemplateQuery('assembly_models', false));
      if (error && isMissingColumnError(error, 'assembly_models')) {
        ({ data, error } = await runTaskTemplateQuery('model_id', false));
      }
    }
    if (error) {
      logger.error('[WPT task-template-options] query failed', {
        correlationId: ctx.correlationId,
        tenantId: tenantId || null,
        franchiseId: franchiseId || null,
        aircraftModelId,
        message: String(error.message || ''),
      });
      return res.status(500).json({ error: 'Failed to load task templates', correlationId: ctx.correlationId });
    }

    const rows = (Array.isArray(data) ? (data as unknown[]) : []) as unknown as TaskTemplateRow[];
    const records = rows.map((row) => ({
      id: String(row.id || ''),
      tt_sequence: String(row.tt_sequence || ''),
      task_template_id: String(row.tt_sequence || ''),
      code_form_no: String(row.code_form_no || ''),
      ata_code: String(row.ata_code || ''),
      reference_amp: String(row.reference_amp || ''),
      description: String(row.description || ''),
      category_code: String(row.category_code || ''),
      estimated_man_hours: row.estimated_man_hours ?? null,
      is_mandatory: Boolean(row.is_mandatory),
      task_template_detail_json: row.task_template_detail_json ?? null,
      tenant_id: String(row.tenant_id || ''),
      franchise_id: row.franchise_id ? String(row.franchise_id || '') : null,
    }));

    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        records,
        total: records.length,
      },
    });
  } catch (error) {
    const message = String((error as Error).message || '');
    const normalized = message.toLowerCase();
    const status = normalized.includes('unauthorized') ? 401
      : normalized.includes('forbidden') ? 403
        : normalized.includes('https required') ? 400
          : 500;
    logger.error('[WPT task-template-options] unhandled error', {
      correlationId: ctx.correlationId,
      message,
    });
    return res.status(status).json({ error: message || 'Unexpected error', correlationId: ctx.correlationId });
  }
}
