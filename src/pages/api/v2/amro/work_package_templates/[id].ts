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
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';
import masterDataEntityIdHandler from '../master-data/[entity]/[id]';

type TaskTemplatePayload = {
  task_template_id: string;
  sequence_order?: number;
  [key: string]: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

function asBodyObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') {
    return body as Record<string, unknown>;
  }
  return {};
}

function extractTaskTemplateRows(body: Record<string, unknown>): TaskTemplatePayload[] {
  const source = Array.isArray(body.task_templates)
    ? body.task_templates
    : Array.isArray(body.tasks_json)
      ? body.tasks_json
      : [];
  return source
    .map((entry) => (entry && typeof entry === 'object' ? entry as Record<string, unknown> : null))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => {
      const taskTemplateId = String(entry.task_template_id || '').trim();
      const sequenceOrderRaw = entry.sequence_order;
      const sequenceOrder = sequenceOrderRaw === undefined || sequenceOrderRaw === null || sequenceOrderRaw === ''
        ? undefined
        : Number(sequenceOrderRaw);
      return {
        ...entry,
        task_template_id: taskTemplateId,
        ...(sequenceOrder === undefined ? {} : { sequence_order: sequenceOrder }),
      };
    });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const compatibilityDecision = resolveGatewayCompatibility(req, {
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);

  if (req.method === 'PUT') {
    req.method = 'PATCH';
  }

  if (req.method === 'GET' || req.method === 'DELETE') {
    req.query = {
      ...req.query,
      entity: 'work_order_templates',
      id: req.query.id,
    };
    await masterDataEntityIdHandler(req, res);
    return;
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE', 'PUT', 'OPTIONS']);
    res.status(405).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      error: `Method ${req.method} Not Allowed`,
    });
    return;
  }

  try {
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);

    const tenantId = String(scopedAccess.tenantId || '').trim();
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId).trim() : null;
    const id = String(req.query.id || '').trim();
    if (!isUuid(id)) {
      res.status(400).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: 'Invalid work package template id',
      });
      return;
    }

    const body = asBodyObject(req.body);
    if (body.task_templates !== undefined && !Array.isArray(body.task_templates)) {
      res.status(400).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: 'task_templates must be an array',
      });
      return;
    }
    if (body.tasks_json !== undefined && !Array.isArray(body.tasks_json) && typeof body.tasks_json !== 'string') {
      res.status(400).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: 'tasks_json must be a JSON array',
      });
      return;
    }

    const taskRows = extractTaskTemplateRows(body);
    const invalidTaskTemplateId = taskRows.find((entry) => !isUuid(entry.task_template_id));
    if (invalidTaskTemplateId) {
      res.status(400).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: 'Each task template must include a valid UUID task_template_id',
      });
      return;
    }

    const supabase = getSupabaseAdminClient();
    const { data: existingTemplate, error: existingTemplateError } = await supabase
      .from('work_order_templates')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();
    if (existingTemplateError) {
      res.status(500).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: `Failed to verify work package template: ${existingTemplateError.message}`,
      });
      return;
    }
    if (!existingTemplate) {
      res.status(404).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: 'Work package template not found',
      });
      return;
    }

    const requestedTaskTemplateIds = taskRows.map((entry) => entry.task_template_id);
    if (requestedTaskTemplateIds.length > 0) {
      const { data: taskTemplates, error: taskTemplateError } = await supabase
        .from('task_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('id', requestedTaskTemplateIds);
      if (taskTemplateError) {
        res.status(500).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          error: `Failed to validate task templates: ${taskTemplateError.message}`,
        });
        return;
      }
      const existingTaskIds = new Set((Array.isArray(taskTemplates) ? taskTemplates : []).map((row) => String((row as Record<string, unknown>).id || '')));
      const missingTaskIds = requestedTaskTemplateIds.filter((taskTemplateId) => !existingTaskIds.has(taskTemplateId));
      if (missingTaskIds.length > 0) {
        res.status(400).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          error: `Validation failed: task_template_id not found (${missingTaskIds.join(', ')})`,
        });
        return;
      }
    }

    const rpcPayload: Record<string, unknown> = {
      ...body,
      tasks_json: taskRows,
    };
    delete rpcPayload.task_templates;
    const { data: rpcResult, error: rpcError } = await supabase.rpc('amro_update_work_order_template_atomic', {
      p_tenant_id: tenantId,
      p_franchise_id: franchiseId,
      p_user_id: auth.userId,
      p_work_order_template_id: id,
      p_payload: rpcPayload,
    });
    if (rpcError) {
      const message = String(rpcError.message || 'Transaction failed');
      const lowered = message.toLowerCase();
      if (lowered.includes('not found')) {
        res.status(404).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          error: message,
        });
        return;
      }
      if (lowered.includes('validation failed')) {
        res.status(400).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          error: message,
        });
        return;
      }
      res.status(500).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: `Atomic update transaction failed and was rolled back: ${message}`,
      });
      return;
    }

    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        entity: 'work_order_templates',
        record: (rpcResult as Record<string, unknown>)?.record || null,
        updated_relationships: (rpcResult as Record<string, unknown>)?.updated_relationships || [],
      },
    });
  } catch (error) {
    res.status(500).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      error: `Atomic update transaction failed and was rolled back: ${String((error as Error).message || error)}`,
    });
  }
}
