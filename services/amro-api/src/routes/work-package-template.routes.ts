import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { ErrorResponse } from '../types/amro.types';

const router = Router();

router.use((req, _res, next) => {
  if (req.url.startsWith('/amro/work-package-templates')) {
    req.url = req.url.replace('/amro/work-package-templates', '/work-package-templates');
  }
  next();
});

const supabaseUrl = String(
  process.env.AMRO_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '',
).replace(/\/$/, '');
const supabaseServiceKey =
  process.env.AMRO_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type WorkPackageTemplateRequest = {
  template_code?: string;
  version?: number;
  active?: boolean;
  template_name?: string;
  maintenance_type?: string;
  model_id?: string;
  scope_json?: unknown[];
  tasks_json?: unknown[];
  policy_snapshot_id?: string | null;
  aircraft_model?: string | null;
  selected_task_template_ids?: string[];
};

type CreateWorkPackageTemplateTaskTemplateRequest = {
  work_package_template_id?: string;
  task_template_id?: string;
  selected_task_template_ids?: string[];
};

type TemplateRecord = Record<string, unknown>;
type RelationshipRecord = Record<string, unknown>;
type TaskTemplateRecord = Record<string, unknown>;

const MAINTENANCE_TYPE_ALLOWED = new Set([
  'line',
  'base',
  'component',
  'inspection',
  'overhaul',
  'repair',
  'upgrade',
  'modification',
]);

const MAINTENANCE_TYPE_ALIASES: Record<string, string> = {
  hangar: 'base',
  shop: 'component',
};

function getFranchiseId(req: AuthRequest): string | null {
  const fromHeader = String(req.header('x-franchise-id') || '').trim();
  if (fromHeader) return fromHeader;
  const fromUser = String((req.user as Record<string, unknown> | undefined)?.franchise_id || '').trim();
  return fromUser || null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeMaintenanceType(value: unknown): string {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const aliased = MAINTENANCE_TYPE_ALIASES[normalized] || normalized;
  return MAINTENANCE_TYPE_ALLOWED.has(aliased) ? aliased : '';
}

function isMissingWorkPackageTemplateFranchiseColumnError(errorLike: unknown): boolean {
  const message = String(
    (errorLike as { message?: unknown })?.message
      || (errorLike as string)
      || '',
  ).toLowerCase();
  return message.includes('work_package_templates.franchise_id')
    || (message.includes('franchise_id') && message.includes('work_package_templates'));
}

function normalizeTaskTemplateIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(
    input
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 0),
  ));
}

function normalizeTaskTemplateRequestIds(input: CreateWorkPackageTemplateTaskTemplateRequest): string[] {
  const direct = normalizeTaskTemplateIds(input.selected_task_template_ids);
  if (direct.length > 0) return direct;
  const single = String(input.task_template_id || '').trim();
  return single ? [single] : [];
}

function normalizeTemplateRequestTaskTemplateIds(input: WorkPackageTemplateRequest): string[] {
  const direct = normalizeTaskTemplateIds(input.selected_task_template_ids);
  if (direct.length > 0) return direct;
  if (!Array.isArray(input.tasks_json)) return [];
  return Array.from(new Set(
    input.tasks_json
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return '';
        const row = entry as Record<string, unknown>;
        return String(row.task_template_id || row.taskTemplateId || row.id || row.tt_sequence || '').trim();
      })
      .filter((value) => value.length > 0),
  ));
}

function toErrorResponse(error: string, code: string, statusCode: number): ErrorResponse {
  return { error, code, statusCode };
}

async function createWorkPackageTemplateFromRequest(req: AuthRequest, res: { status: (code: number) => { json: (body: unknown) => void } }): Promise<void> {
  const tenantId = req.tenantId;
  const userId = req.userId;
  const franchiseId = getFranchiseId(req);
  logger.info('[AMRO Work Package Template] POST Method received xyz001', {
    tenantId,
    franchiseId,
    userId,
  });
  if (!tenantId || !userId) {
    res.status(401).json(toErrorResponse('Missing tenant or user context', 'MISSING_CONTEXT', 401));
    return;
  }

  const request = (req.body || {}) as WorkPackageTemplateRequest;
  const normalizedMaintenanceType = normalizeMaintenanceType(request.maintenance_type);
  if (!request.template_code || !request.template_name || !normalizedMaintenanceType || !request.aircraft_model) {
    res.status(400).json(
      toErrorResponse(
        'Missing/invalid required fields: template_code, template_name, maintenance_type, aircraft_model',
        'VALIDATION_ERROR',
        400,
      ),
    );
    return;
  }

  const selectedTaskTemplateIds = normalizeTemplateRequestTaskTemplateIds(request);
  logger.info('[AMRO Work Package Template] resolved selected task templates for create', {
    tenantId,
    templateCode: String(request.template_code || ''),
    selectedTaskTemplateCount: selectedTaskTemplateIds.length,
    fromSelectedIds: Array.isArray(request.selected_task_template_ids),
    fromTasksJson: Array.isArray(request.tasks_json),
  });
  const validation = await validateTaskTemplateIds(tenantId, franchiseId, selectedTaskTemplateIds);
  if (!validation.valid) {
    if (validation.invalidIds.length > 0) {
      res.status(422).json(toErrorResponse(`Invalid task_template_id values: ${validation.invalidIds.join(', ')}`, 'VALIDATION_ERROR', 422));
      return;
    }
    res.status(422).json(toErrorResponse(`task_template_id not found: ${validation.missingIds.join(', ')}`, 'NOT_FOUND', 422));
    return;
  }
  const payload = {
    template_code: String(request.template_code || '').trim(),
    version: Number(request.version || 1),
    active: request.active !== false,
    template_name: String(request.template_name || '').trim(),
    maintenance_type: normalizedMaintenanceType,
    model_id: String(request.model_id || '').trim() || null,
    scope_json: Array.isArray(request.scope_json) ? request.scope_json : [],
    tasks_json: selectedTaskTemplateIds.map((taskTemplateId) => ({ task_template_id: taskTemplateId })),
    policy_snapshot_id: null,
    aircraft_model: request.aircraft_model || null,
  };
  let resolvedModelId: string | null = null;
  if (selectedTaskTemplateIds.length > 0) {
    let modelQuery = supabase
      .from('task_templates')
      .select('id,assembly_models')
      .eq('tenant_id', tenantId)
      .in('id', selectedTaskTemplateIds);
    if (franchiseId) {
      modelQuery = modelQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    const { data: taskRows, error: taskRowsError } = await modelQuery;
    if (taskRowsError) {
      const message = String(taskRowsError.message || '');
      res.status(400).json(toErrorResponse(message, 'CREATE_FAILED', 400));
      return;
    }
    const modelIds = Array.from(new Set(
      (Array.isArray(taskRows) ? taskRows : [])
        .map((row) => String((row as Record<string, unknown>).assembly_models || '').trim())
        .filter((value) => value.length > 0),
    ));
    if (modelIds.length !== 1) {
      res.status(422).json(
        toErrorResponse(
          'Validation failed: selected task templates belong to different or missing assembly_models',
          'VALIDATION_ERROR',
          422,
        ),
      );
      return;
    }
    resolvedModelId = modelIds[0];
  }
  if (payload.model_id && !isUuid(payload.model_id)) {
    res.status(400).json(toErrorResponse('Invalid model_id. Expected UUID.', 'VALIDATION_ERROR', 400));
    return;
  }
  const persistedModelId = payload.model_id || resolvedModelId;
  if (!persistedModelId) {
    res.status(422).json(
      toErrorResponse('Missing model_id. Select an aircraft model before saving template.', 'VALIDATION_ERROR', 422),
    );
    return;
  }
  if (payload.model_id && resolvedModelId && payload.model_id !== resolvedModelId) {
    res.status(422).json(
      toErrorResponse(
        `Validation failed: selected task templates resolve to model_id=${resolvedModelId}, but request model_id=${payload.model_id}`,
        'VALIDATION_ERROR',
        422,
      ),
    );
    return;
  }

  const insertPayload = {
    tenant_id: tenantId,
    franchise_id: franchiseId,
    template_code: payload.template_code,
    version: payload.version,
    active: payload.active,
    template_name: payload.template_name,
    maintenance_type: payload.maintenance_type,
    model_id: persistedModelId,
    scope_json: payload.scope_json,
    tasks_json: payload.tasks_json,
    policy_snapshot_id: null,
    created_by: userId,
    updated_by: userId,
  };
  const { data: insertedTemplate, error: insertError } = await supabase
    .from('work_package_templates')
    .insert(insertPayload)
    .select('*')
    .single();
  if (insertError) {
    logger.error('[WorkPackageTemplateRoutes] create failed', {
      tenantId,
      message: String(insertError.message || ''),
    });
    const message = String(insertError.message || '');
    const statusCode = /duplicate key/i.test(message) ? 409 : 400;
    res.status(statusCode).json(toErrorResponse(message, 'CREATE_FAILED', statusCode));
    return;
  }
  const createdTemplateId = String((insertedTemplate as Record<string, unknown>).id || '').trim();
  if (!createdTemplateId || !isUuid(createdTemplateId)) {
    res.status(500).json(toErrorResponse('Failed to create work package template id', 'CREATE_FAILED', 500));
    return;
  }
  let relationshipCount = 0;

  if (selectedTaskTemplateIds.length > 0 && resolvedModelId) {
    const relationshipRows = selectedTaskTemplateIds.map((taskTemplateId) => ({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      work_package_template_id: createdTemplateId,
      model_id: resolvedModelId,
      task_template_id: taskTemplateId,
      created_by: userId,
      updated_by: userId,
    }));
    const { error: relationError } = await supabase
      .from('work_package_template_task_templates')
      .insert(relationshipRows);
    if (relationError) {
      const message = String(relationError.message || '');
      logger.error('[AMRO Work Package Template] create relationship failed; rolling back template', {
        tenantId,
        templateId: createdTemplateId,
        message,
      });
      let rollbackQuery = supabase
        .from('work_package_templates')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', createdTemplateId);
      if (franchiseId) {
        rollbackQuery = rollbackQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
      }
      const { error: rollbackError } = await rollbackQuery;
      if (rollbackError) {
        logger.error('[AMRO Work Package Template] rollback failed after relationship insert failure', {
          tenantId,
          templateId: createdTemplateId,
          rollbackError: String(rollbackError.message || ''),
        });
      }
      const statusCode = /duplicate key/i.test(message) ? 409 : 400;
      res.status(statusCode).json(toErrorResponse(message, 'CREATE_FAILED', statusCode));
      return;
    }
    relationshipCount = relationshipRows.length;
  }

  const records = await buildTemplateListResponse(tenantId, franchiseId, [createdTemplateId]);
  res.status(201).json({
    data: records[0] || insertedTemplate || null,
    work_package_template_id: createdTemplateId,
    relationship_count: relationshipCount,
  });
}

async function createTemplateTaskRelationshipsFromRequest(
  req: AuthRequest,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<void> {
  const tenantId = req.tenantId;
  const userId = req.userId;
  const franchiseId = getFranchiseId(req);
  const { workPackageTemplateId } = req.params as { workPackageTemplateId: string };
  if (!tenantId || !userId) {
    res.status(401).json(toErrorResponse('Missing tenant or user context', 'MISSING_CONTEXT', 401));
    return;
  }

  const request = (req.body || {}) as CreateWorkPackageTemplateTaskTemplateRequest;
  const resolvedTemplateId = String(request.work_package_template_id || workPackageTemplateId || '').trim();
  if (!resolvedTemplateId || !isUuid(resolvedTemplateId)) {
    res.status(400).json(
      toErrorResponse('Missing or invalid work_package_template_id', 'VALIDATION_ERROR', 400),
    );
    return;
  }
  const selectedTaskTemplateIds = normalizeTaskTemplateRequestIds(request);
  if (selectedTaskTemplateIds.length === 0) {
    res.status(400).json(
      toErrorResponse('Missing required fields: task_template_id or selected_task_template_ids', 'VALIDATION_ERROR', 400),
    );
    return;
  }
  if (selectedTaskTemplateIds.some((value) => !isUuid(value))) {
    res.status(422).json(
      toErrorResponse('Validation failed: task_template_id values must be valid UUID', 'VALIDATION_ERROR', 422),
    );
    return;
  }

  logger.info('[AMRO Work Package Template] add task-template relationships request', {
    tenantId,
    franchiseId,
    userId,
    workPackageTemplateId: resolvedTemplateId,
    taskTemplateCount: selectedTaskTemplateIds.length,
  });

  const runTemplateQuery = async (includeFranchiseColumn: boolean) => {
    let query = supabase
      .from('work_package_templates')
      .select(includeFranchiseColumn ? 'id,tenant_id,franchise_id,model_id' : 'id,tenant_id,model_id')
      .eq('tenant_id', tenantId)
      .eq('id', resolvedTemplateId);
    if (franchiseId && includeFranchiseColumn) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    return query.single();
  };
  let { data: templateRow, error: templateError } = await runTemplateQuery(true);
  if (templateError && isMissingWorkPackageTemplateFranchiseColumnError(templateError)) {
    ({ data: templateRow, error: templateError } = await runTemplateQuery(false));
  }
  if (templateError || !templateRow) {
    res.status(404).json(toErrorResponse('Work package template not found', 'NOT_FOUND', 404));
    return;
  }

  const validation = await validateTaskTemplateIds(tenantId, franchiseId, selectedTaskTemplateIds);
  if (!validation.valid) {
    if (validation.invalidIds.length > 0) {
      res.status(422).json(toErrorResponse(`Invalid task_template_id values: ${validation.invalidIds.join(', ')}`, 'VALIDATION_ERROR', 422));
      return;
    }
    res.status(422).json(toErrorResponse(`task_template_id not found: ${validation.missingIds.join(', ')}`, 'NOT_FOUND', 422));
    return;
  }

  let modelQuery = supabase
    .from('task_templates')
    .select('id,assembly_models')
    .eq('tenant_id', tenantId)
    .in('id', selectedTaskTemplateIds);
  if (franchiseId) {
    modelQuery = modelQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }
  const { data: taskRows, error: taskRowsError } = await modelQuery;
  if (taskRowsError) {
    const message = String(taskRowsError.message || '');
    res.status(400).json(toErrorResponse(message, 'CREATE_FAILED', 400));
    return;
  }
  const modelIds = Array.from(new Set(
    (Array.isArray(taskRows) ? taskRows : [])
      .map((row) => String((row as Record<string, unknown>).assembly_models || '').trim())
      .filter((value) => value.length > 0),
  ));
  if (modelIds.length !== 1) {
    res.status(422).json(
      toErrorResponse(
        'Validation failed: selected task templates belong to different or missing assembly_models',
        'VALIDATION_ERROR',
        422,
      ),
    );
    return;
  }
  const resolvedModelId = modelIds[0];
  const templateModelId = String(((templateRow as unknown as Record<string, unknown>)?.model_id) || '').trim();
  if (templateModelId && templateModelId !== resolvedModelId) {
    res.status(422).json(
      toErrorResponse(
        'Validation failed: selected task templates do not match template model_id',
        'VALIDATION_ERROR',
        422,
      ),
    );
    return;
  }

  const relationshipRows = selectedTaskTemplateIds.map((taskTemplateId) => ({
    tenant_id: tenantId,
    franchise_id: franchiseId,
    work_package_template_id: resolvedTemplateId,
    model_id: resolvedModelId,
    task_template_id: taskTemplateId,
    created_by: userId,
    updated_by: userId,
  }));
  const { error: relationError } = await supabase
    .from('work_package_template_task_templates')
    .insert(relationshipRows);
  if (relationError) {
    const message = String(relationError.message || '');
    const statusCode = /duplicate key/i.test(message) ? 409 : 400;
    logger.error('[AMRO Work Package Template] add task-template relationships failed', {
      tenantId,
      workPackageTemplateId: resolvedTemplateId,
      message,
    });
    res.status(statusCode).json(toErrorResponse(message, 'CREATE_FAILED', statusCode));
    return;
  }

  logger.info('[AMRO Work Package Template] add task-template relationships success', {
    tenantId,
    workPackageTemplateId: resolvedTemplateId,
    taskTemplateCount: selectedTaskTemplateIds.length,
  });
  const records = await buildTemplateListResponse(tenantId, franchiseId, [resolvedTemplateId]);
  res.status(201).json({
    data: records[0] || null,
    added_task_template_ids: selectedTaskTemplateIds,
  });
}

async function validateTaskTemplateIds(
  tenantId: string,
  franchiseId: string | null,
  selectedTaskTemplateIds: string[],
): Promise<{ valid: true } | { valid: false; missingIds: string[]; invalidIds: string[] }> {
  const invalidIds = selectedTaskTemplateIds.filter((id) => !isUuid(id));
  if (invalidIds.length > 0) {
    return { valid: false, missingIds: [], invalidIds };
  }
  if (selectedTaskTemplateIds.length === 0) {
    return { valid: true };
  }
  let query = supabase
    .from('task_templates')
    .select('id,tenant_id,franchise_id')
    .eq('tenant_id', tenantId)
    .in('id', selectedTaskTemplateIds);
  if (franchiseId) {
    query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const foundIds = new Set((Array.isArray(data) ? data : []).map((row) => String((row as Record<string, unknown>).id || '')));
  const missingIds = selectedTaskTemplateIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    return { valid: false, missingIds, invalidIds: [] };
  }
  return { valid: true };
}

async function buildTemplateListResponse(
  tenantId: string,
  franchiseId: string | null,
  templateIds?: string[],
): Promise<Array<Record<string, unknown>>> {
  let templatesQuery = supabase
    .from('work_package_templates')
    .select('id,tenant_id,model_id,template_code,version,active,template_name,maintenance_type,scope_json,tasks_json,policy_snapshot_id,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });
  if (Array.isArray(templateIds) && templateIds.length > 0) {
    templatesQuery = templatesQuery.in('id', templateIds);
  }
  const { data: templatesData, error: templatesError } = await templatesQuery;
  if (templatesError) {
    throw templatesError;
  }
  const templates = (Array.isArray(templatesData) ? templatesData : []) as TemplateRecord[];
  if (templates.length === 0) return [];

  const templateIdList = templates.map((row) => String(row.id || '')).filter((value) => value.length > 0);
  let relationQuery = supabase
    .from('work_package_template_task_templates')
    .select('id,work_package_template_id,task_template_id,model_id,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .in('work_package_template_id', templateIdList);
  if (franchiseId) {
    relationQuery = relationQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }
  const { data: relationshipData, error: relationshipError } = await relationQuery;
  if (relationshipError) {
    throw relationshipError;
  }
  const relationships = (Array.isArray(relationshipData) ? relationshipData : []) as RelationshipRecord[];
  const taskTemplateIds = Array.from(new Set(
    relationships
      .map((row) => String(row.task_template_id || ''))
      .filter((value) => value.length > 0),
  ));
  let taskTemplateMap = new Map<string, TaskTemplateRecord>();
  if (taskTemplateIds.length > 0) {
    let taskTemplateQuery = supabase
      .from('task_templates')
      .select('id,tt_sequence,code_form_no,ata_code,reference_amp,description,assembly_models')
      .eq('tenant_id', tenantId)
      .in('id', taskTemplateIds);
    if (franchiseId) {
      taskTemplateQuery = taskTemplateQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    const { data: taskTemplateData, error: taskTemplateError } = await taskTemplateQuery;
    if (taskTemplateError) {
      throw taskTemplateError;
    }
    taskTemplateMap = new Map(
      (Array.isArray(taskTemplateData) ? taskTemplateData : []).map((row) => {
        const record = row as TaskTemplateRecord;
        return [String(record.id || ''), record];
      }),
    );
  }

  const relationshipsByTemplate = relationships.reduce((map, row) => {
    const templateId = String(row.work_package_template_id || '');
    if (!templateId) return map;
    const existing = map.get(templateId) || [];
    existing.push(row);
    map.set(templateId, existing);
    return map;
  }, new Map<string, RelationshipRecord[]>());

  return templates.map((template) => {
    const templateId = String(template.id || '');
    const templateRelationships = relationshipsByTemplate.get(templateId) || [];
    const taskTemplates = templateRelationships.map((row) => {
      const taskTemplateId = String(row.task_template_id || '');
      const taskTemplate = taskTemplateMap.get(taskTemplateId) || {};
      return {
        relationship_id: row.id,
        task_template_id: taskTemplateId,
        model_id: row.model_id,
        task_template: taskTemplate,
      };
    });
    return {
      ...template,
      selected_task_template_ids: taskTemplates.map((item) => String(item.task_template_id)),
      task_templates: taskTemplates,
    };
  });
}

async function loadWorkPackageTemplateModelOptions(
  tenantId: string,
  franchiseId: string | null,
): Promise<Array<Record<string, unknown>>> {
  const runQuery = async (includeFranchiseColumn: boolean, includeGlobalTenantRows: boolean) => {
    let query = supabase
      .from('assembly_models')
      .select(includeFranchiseColumn
        ? 'id,name,model_code,is_active,tenant_id,franchise_id'
        : 'id,name,model_code,is_active,tenant_id')
      .eq('is_active', true)
      .order('name', { ascending: true });
    query = includeGlobalTenantRows ? query.is('tenant_id', null) : query.eq('tenant_id', tenantId);
    if (franchiseId && includeFranchiseColumn) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    return query;
  };

  const loadScopeRows = async (includeFranchiseColumn: boolean) => {
    const tenantResult = await runQuery(includeFranchiseColumn, false);
    if (tenantResult.error) {
      return tenantResult;
    }
    const globalResult = await runQuery(includeFranchiseColumn, true);
    if (globalResult.error) {
      return globalResult;
    }
    const merged = [
      ...(Array.isArray(tenantResult.data) ? tenantResult.data : []),
      ...(Array.isArray(globalResult.data) ? globalResult.data : []),
    ] as unknown as Array<Record<string, unknown>>;
    const deduped = Array.from(new Map(
      merged.map((row) => [String(row.id || ''), row]),
    ).values());
    return { data: deduped, error: null };
  };

  let { data, error } = await loadScopeRows(true);
  if (error && String(error.message || '').toLowerCase().includes('franchise_id')) {
    logger.warn('[AMRO Work Package Template] model options franchise column unavailable, retrying tenant/global scope', {
      tenantId,
      franchiseId,
      message: String(error.message || ''),
    });
    ({ data, error } = await loadScopeRows(false));
  }
  if (error) throw error;

  const rows = (Array.isArray(data) ? data : []) as unknown as Array<Record<string, unknown>>;
  const normalized = rows.map((row) => ({
    id: String(row.id || ''),
    name: String(row.name || ''),
    model_code: String(row.model_code || ''),
    is_active: Boolean(row.is_active),
    tenant_id: String(row.tenant_id || ''),
    franchise_id: row.franchise_id ? String(row.franchise_id || '') : null,
  }));
  logger.info('[AMRO Work Package Template] loaded model options', {
    tenantId,
    franchiseId,
    count: normalized.length,
  });
  return normalized;
}

async function loadTaskTemplateOptionsByModel(params: {
  tenantId: string;
  franchiseId: string | null;
  aircraftModelId: string;
  isTenantAdmin: boolean;
}): Promise<Array<Record<string, unknown>>> {
  const { tenantId, franchiseId, aircraftModelId, isTenantAdmin } = params;

  const runQuery = async (
    modelColumn: 'assembly_models' | 'model_id',
    includeFranchiseColumn: boolean,
    includeGlobalTenantRows: boolean,
  ) => {
    let query = supabase
      .from('task_templates')
      .select(includeFranchiseColumn
        ? 'id,tt_sequence,code_form_no,ata_code,reference_amp,description,category_code,estimated_man_hours,is_mandatory,task_template_detail_json,tenant_id,franchise_id'
        : 'id,tt_sequence,code_form_no,ata_code,reference_amp,description,category_code,estimated_man_hours,is_mandatory,task_template_detail_json,tenant_id')
      .eq(modelColumn, aircraftModelId)
      .order('tt_sequence', { ascending: true });

    query = includeGlobalTenantRows ? query.is('tenant_id', null) : query.eq('tenant_id', tenantId);

    if (includeFranchiseColumn && !isTenantAdmin && franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    return query;
  };

  const loadScopeRows = async (modelColumn: 'assembly_models' | 'model_id', includeFranchiseColumn: boolean) => {
    const tenantResult = await runQuery(modelColumn, includeFranchiseColumn, false);
    if (tenantResult.error) {
      return tenantResult;
    }
    const globalResult = await runQuery(modelColumn, includeFranchiseColumn, true);
    if (globalResult.error) {
      return globalResult;
    }
    const merged = [
      ...(Array.isArray(tenantResult.data) ? tenantResult.data : []),
      ...(Array.isArray(globalResult.data) ? globalResult.data : []),
    ] as unknown as Array<Record<string, unknown>>;
    const deduped = Array.from(new Map(
      merged.map((row) => [String(row.id || row.tt_sequence || ''), row]),
    ).values());
    return { data: deduped, error: null };
  };

  const isMissingColumnError = (error: unknown, columnName: string) => {
    const message = String((error as { message?: string })?.message || '').toLowerCase();
    return message.includes(columnName.toLowerCase()) && (message.includes('column') || message.includes('does not exist'));
  };

  let { data, error } = await loadScopeRows('assembly_models', true);
  if (error && isMissingColumnError(error, 'assembly_models')) {
    ({ data, error } = await loadScopeRows('model_id', true));
  }
  if (error && isMissingColumnError(error, 'franchise_id')) {
    ({ data, error } = await loadScopeRows('assembly_models', false));
    if (error && isMissingColumnError(error, 'assembly_models')) {
      ({ data, error } = await loadScopeRows('model_id', false));
    }
  }
  if (error) throw error;

  const rows = (Array.isArray(data) ? data : []) as unknown as Array<Record<string, unknown>>;
  return rows.map((row) => ({
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
}

async function updateWorkPackageTemplateWithoutAtomicRpc(params: {
  tenantId: string;
  franchiseId: string | null;
  userId: string;
  templateId: string;
  payload: {
    template_code?: string;
    version?: number;
    active?: boolean;
    template_name?: string;
    maintenance_type?: string;
    model_id?: string | null;
    scope_json?: unknown[];
    tasks_json?: unknown[];
    policy_snapshot_id?: string | null;
  };
  selectedTaskTemplateIds: string[];
  resolvedModelId: string | null;
}): Promise<{ ok: true } | { ok: false; statusCode: number; message: string }> {
  const {
    tenantId,
    franchiseId,
    templateId,
    payload,
    selectedTaskTemplateIds,
    resolvedModelId,
  } = params;

  const runUpdateQuery = async (withFranchiseScope: boolean) => {
    let query = supabase
      .from('work_package_templates')
      .update({
        template_code: payload.template_code,
        version: payload.version,
        active: payload.active,
        template_name: payload.template_name,
        maintenance_type: payload.maintenance_type,
        model_id: payload.model_id || null,
        scope_json: Array.isArray(payload.scope_json) ? payload.scope_json : [],
        tasks_json: Array.isArray(payload.tasks_json) ? payload.tasks_json : [],
        policy_snapshot_id: payload.policy_snapshot_id || null,
      })
      .eq('tenant_id', tenantId)
      .eq('id', templateId)
      .select('id')
      .limit(1);
    if (withFranchiseScope && franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    return query;
  };
  let { data: updatedRows, error: updateError } = await runUpdateQuery(Boolean(franchiseId));
  if (updateError && isMissingWorkPackageTemplateFranchiseColumnError(updateError) && franchiseId) {
    ({ data: updatedRows, error: updateError } = await runUpdateQuery(false));
  }
  if (updateError) {
    return { ok: false, statusCode: 400, message: String(updateError.message || 'Update failed') };
  }
  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    return { ok: false, statusCode: 404, message: 'Work package template not found' };
  }

  let deleteRelationsQuery = supabase
    .from('work_package_template_task_templates')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('work_package_template_id', templateId);
  if (franchiseId) {
    deleteRelationsQuery = deleteRelationsQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }
  const { error: deleteRelationsError } = await deleteRelationsQuery;
  if (deleteRelationsError) {
    return { ok: false, statusCode: 400, message: String(deleteRelationsError.message || 'Failed to reset relationships') };
  }

  const targetModelId = payload.model_id || resolvedModelId;
  if (selectedTaskTemplateIds.length > 0 && targetModelId) {
    const rows = selectedTaskTemplateIds.map((taskTemplateId) => ({
      tenant_id: tenantId,
      franchise_id: franchiseId,
      work_package_template_id: templateId,
      model_id: targetModelId,
      task_template_id: taskTemplateId,
    }));
    const { error: insertRelationsError } = await supabase
      .from('work_package_template_task_templates')
      .insert(rows);
    if (insertRelationsError) {
      return { ok: false, statusCode: 400, message: String(insertRelationsError.message || 'Failed to write relationships') };
    }
  }

  return { ok: true };
}

/**
 * @openapi
 * /api/v2/work-package-templates:
 *   post:
 *     summary: Create work package template with task-template relationships
 *     tags: [Work Package Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             template_code: "WP-LINE-001"
 *             template_name: "Line Check Package"
 *             maintenance_type: "line"
 *             model_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
 *             aircraft_model: "A320"
 *             selected_task_template_ids:
 *               - "11a11111-2222-4333-9444-555555555555"
 *               - "22b22222-3333-4444-a555-666666666666"
 *     responses:
 *       201:
 *         description: Created with relationship rows
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 id: "33333333-4444-4555-8666-777777777777"
 *                 template_code: "WP-LINE-001"
 *               work_package_template_id: "33333333-4444-4555-8666-777777777777"
 *               relationship_count: 2
 *       400:
 *         description: Validation or insert failure (template or relationship)
 *       401:
 *         description: Missing tenant/user context
 *       409:
 *         description: Duplicate key conflict
 *       422:
 *         description: Invalid task templates or mixed assembly models
 */
router.post(
  '/amro/work-packages',
  asyncHandler(async (req: AuthRequest, res, next): Promise<void> => {
    const interfaceName = String(req.query.interface || '').trim().toLowerCase();
    if (interfaceName !== 'create-work-package-template') {
      next();
      return;
    }
    await createWorkPackageTemplateFromRequest(req, res);
  }),
);

router.post(
  '/amro/work-package-templates',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    await createWorkPackageTemplateFromRequest(req, res);
    return;
  }),
);

router.post(
  '/work-package-templates',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    await createWorkPackageTemplateFromRequest(req, res);
    return;
  }),
);

/**
 * @openapi
 * /api/v2/work-package-templates/{workPackageTemplateId}/task-templates:
 *   post:
 *     summary: Add task-template relationships to a work package template
 *     tags: [Work Package Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           examples:
 *             bulk:
 *               value:
 *                 selected_task_template_ids:
 *                   - "11a11111-2222-4333-9444-555555555555"
 *                   - "22b22222-3333-4444-a555-666666666666"
 *             single:
 *               value:
 *                 task_template_id: "11a11111-2222-4333-9444-555555555555"
 *     responses:
 *       201:
 *         description: Relationships created
 *         content:
 *           application/json:
 *             example:
 *               data:
 *                 id: "33333333-4444-4555-8666-777777777777"
 *                 selected_task_template_ids:
 *                   - "11a11111-2222-4333-9444-555555555555"
 *               added_task_template_ids:
 *                 - "11a11111-2222-4333-9444-555555555555"
 *       400:
 *         description: Validation error or constraint failure
 *       401:
 *         description: Missing tenant or user context
 *       404:
 *         description: Work package template not found
 *       409:
 *         description: Duplicate relationship already exists
 *       422:
 *         description: Invalid UUID or cross-model task selection
 */
router.post(
  '/work-package-templates/:workPackageTemplateId/task-templates',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    await createTemplateTaskRelationshipsFromRequest(req, res);
    return;
  }),
);

/**
 * @openapi
 * /api/v2/work-package-templates:
 *   get:
 *     summary: List work package templates with task-template relationships
 *     tags: [Work Package Templates]
 */
router.get(
  '/work-package-templates',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
   
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    logger.info('[AMRO Work Package Template] GET Method received', {
      tenantId,
      franchiseId,
    });
    if (!tenantId) {
      res.status(401).json(toErrorResponse('Missing tenant context', 'MISSING_TENANT', 401));
      return;
    }
    const records = await buildTemplateListResponse(tenantId, franchiseId);
    res.json({ data: records, count: records.length });
    return;
  }),
);

router.get(
  '/work-package-templates/model-options',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    if (!tenantId) {
      res.status(401).json(toErrorResponse('Missing tenant context', 'MISSING_TENANT', 401));
      return;
    }
    const records = await loadWorkPackageTemplateModelOptions(tenantId, franchiseId);
    res.json({ data: records, count: records.length });
    return;
  }),
);

router.get(
  '/work-package-templates/task-template-options',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    const requestRole = String((req.user as Record<string, unknown> | undefined)?.role || '').trim().toLowerCase();
    const isTenantAdmin = requestRole === 'tenant_admin';
    const tenantIdFromQuery = String(req.query.tenant_id || '').trim();
    const aircraftModelId = String(req.query.aircraft_model_id || '').trim();
    if (!tenantId) {
      res.status(401).json(toErrorResponse('Missing tenant context', 'MISSING_TENANT', 401));
      return;
    }
    if (tenantIdFromQuery && tenantIdFromQuery !== tenantId) {
      res.status(403).json(toErrorResponse('tenant_id does not match access scope', 'FORBIDDEN', 403));
      return;
    }
    if (!isUuid(aircraftModelId)) {
      res.status(400).json(toErrorResponse('Invalid aircraft_model_id. Expected UUID.', 'VALIDATION_ERROR', 400));
      return;
    }
    const records = await loadTaskTemplateOptionsByModel({
      tenantId,
      franchiseId,
      aircraftModelId,
      isTenantAdmin,
    });
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json({ data: records, count: records.length });
    return;
  }),
);

/**
 * @openapi
 * /api/v2/work-package-templates/{id}:
 *   get:
 *     summary: Get work package template by ID with task-template relationships
 *     tags: [Work Package Templates]
 */
router.get(
  '/work-package-templates/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const franchiseId = getFranchiseId(req);
    const { id } = req.params;
    if (!tenantId) {
      res.status(401).json(toErrorResponse('Missing tenant context', 'MISSING_TENANT', 401));
      return;
    }
    const records = await buildTemplateListResponse(tenantId, franchiseId, [id]);
    if (!records[0]) {
      res.status(404).json(toErrorResponse('Work package template not found', 'NOT_FOUND', 404));
      return;
    }
    res.json({ data: records[0] });
    return;
  }),
);

/**
 * @openapi
 * /api/v2/work-package-templates/{id}:
 *   put:
 *     summary: Update work package template and task-template relationships atomically
 *     tags: [Work Package Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             template_name: "Line Check Package - Rev A"
 *             model_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
 *             aircraft_model: "A320"
 *             maintenance_type: "line"
 *             selected_task_template_ids:
 *               - "11a11111-2222-4333-9444-555555555555"
 */
router.put(
  '/work-package-templates/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const franchiseId = getFranchiseId(req);
    const { id } = req.params;
    if (!tenantId || !userId) {
      res.status(401).json(toErrorResponse('Missing tenant or user context', 'MISSING_CONTEXT', 401));
      return;
    }

    const request = (req.body || {}) as WorkPackageTemplateRequest;
    let selectedTaskTemplateIds = normalizeTemplateRequestTaskTemplateIds(request);
    const validation = await validateTaskTemplateIds(tenantId, franchiseId, selectedTaskTemplateIds);
    if (!validation.valid) {
      if (validation.invalidIds.length > 0) {
        res.status(422).json(toErrorResponse(`Invalid task_template_id values: ${validation.invalidIds.join(', ')}`, 'VALIDATION_ERROR', 422));
        return;
      }
      res.status(422).json(toErrorResponse(`task_template_id not found: ${validation.missingIds.join(', ')}`, 'NOT_FOUND', 422));
      return;
    }

    const normalizedMaintenanceType = normalizeMaintenanceType(request.maintenance_type);
    if (!normalizedMaintenanceType) {
      res.status(422).json(
        toErrorResponse(
          'Validation failed: maintenance_type must be one of line, base, component, inspection, overhaul, repair, upgrade, modification',
          'VALIDATION_ERROR',
          422,
        ),
      );
      return;
    }

    const payload = {
      template_code: request.template_code,
      version: request.version,
      active: request.active,
      template_name: request.template_name,
      maintenance_type: normalizedMaintenanceType,
      model_id: String(request.model_id || '').trim() || null,
      aircraft_model: request.aircraft_model || null,
      scope_json: Array.isArray(request.scope_json) ? request.scope_json : undefined,
      tasks_json: selectedTaskTemplateIds.map((taskTemplateId) => ({ task_template_id: taskTemplateId })),
      policy_snapshot_id: request.policy_snapshot_id || null,
    };
    if (payload.model_id && !isUuid(payload.model_id)) {
      res.status(400).json(toErrorResponse('Invalid model_id. Expected UUID.', 'VALIDATION_ERROR', 400));
      return;
    }
    let resolvedModelId: string | null = null;
    if (selectedTaskTemplateIds.length > 0) {
      let modelQuery = supabase
        .from('task_templates')
        .select('id,assembly_models')
        .eq('tenant_id', tenantId)
        .in('id', selectedTaskTemplateIds);
      if (franchiseId) {
        modelQuery = modelQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
      }
      const { data: taskRows, error: taskRowsError } = await modelQuery;
      if (taskRowsError) {
        const message = String(taskRowsError.message || '');
        res.status(400).json(toErrorResponse(message, 'UPDATE_FAILED', 400));
        return;
      }
      const modelIds = Array.from(new Set(
        (Array.isArray(taskRows) ? taskRows : [])
          .map((row) => String((row as Record<string, unknown>).assembly_models || '').trim())
          .filter((value) => value.length > 0),
      ));
      if (modelIds.length !== 1) {
        res.status(422).json(
          toErrorResponse(
            'Validation failed: selected task templates belong to different or missing assembly_models',
            'VALIDATION_ERROR',
            422,
          ),
        );
        return;
      }
      resolvedModelId = modelIds[0];
    }
    if (payload.model_id && resolvedModelId && payload.model_id !== resolvedModelId) {
      logger.warn('[AMRO Work Package Template] model changed with stale selected tasks; clearing task links for update', {
        tenantId,
        templateId: id,
        requestModelId: payload.model_id,
        resolvedModelId,
        selectedTaskTemplateCount: selectedTaskTemplateIds.length,
      });
      selectedTaskTemplateIds = [];
      resolvedModelId = null;
      payload.tasks_json = [];
    }
    if (!payload.model_id && resolvedModelId) {
      payload.model_id = resolvedModelId;
    }

    const runFallbackUpdate = async () => {
      const fallbackResult = await updateWorkPackageTemplateWithoutAtomicRpc({
        tenantId,
        franchiseId,
        userId,
        templateId: id,
        payload,
        selectedTaskTemplateIds,
        resolvedModelId,
      });
      if (!fallbackResult.ok) {
        res.status(fallbackResult.statusCode).json(
          toErrorResponse(fallbackResult.message, 'UPDATE_FAILED', fallbackResult.statusCode),
        );
        return false;
      }
      return true;
    };

    // Always use deterministic direct update path for now.
    // RPC implementations vary across environments and can silently skip fields,
    // which causes "save succeeded but data did not change" behavior.
    if (!(await runFallbackUpdate())) {
      return;
    }

    const records = await buildTemplateListResponse(tenantId, franchiseId, [id]);
    if (!records[0]) {
      res.status(404).json(toErrorResponse('Work package template not found', 'NOT_FOUND', 404));
      return;
    }
    res.json({ data: records[0] });
    return;
  }),
);

/**
 * @openapi
 * /api/v2/work-package-templates/{id}:
 *   delete:
 *     summary: Delete work package template and task-template relationships
 *     tags: [Work Package Templates]
 */
router.delete(
  '/work-package-templates/:id',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const franchiseId = getFranchiseId(req);
    const { id } = req.params;
    if (!tenantId || !userId) {
      res.status(401).json(toErrorResponse('Missing tenant or user context', 'MISSING_CONTEXT', 401));
      return;
    }

    const runDeleteQuery = async (withFranchiseScope: boolean) => {
      let query = supabase
        .from('work_package_templates')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('id', id);
      if (withFranchiseScope && franchiseId) {
        query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
      }
      return query;
    };
    let { error } = await runDeleteQuery(Boolean(franchiseId));
    if (error && isMissingWorkPackageTemplateFranchiseColumnError(error) && franchiseId) {
      ({ error } = await runDeleteQuery(false));
    }
    if (error) {
      const message = String(error.message || '');
      const statusCode = /not found/i.test(message) ? 404 : 400;
      res.status(statusCode).json(toErrorResponse(message, 'DELETE_FAILED', statusCode));
      return;
    }
    res.status(204).send();
    return;
  }),
);

export default router;
