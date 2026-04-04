import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../utils/logger';
import { ErrorResponse } from '../types/amro.types';

const router = Router();

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
  scope_json?: unknown[];
  tasks_json?: unknown[];
  policy_snapshot_id?: string | null;
  aircraft_model?: string | null;
  selected_task_template_ids?: string[];
};

type TemplateRecord = Record<string, unknown>;
type RelationshipRecord = Record<string, unknown>;
type TaskTemplateRecord = Record<string, unknown>;

function getFranchiseId(req: AuthRequest): string | null {
  const fromHeader = String(req.header('x-franchise-id') || '').trim();
  if (fromHeader) return fromHeader;
  const fromUser = String((req.user as Record<string, unknown> | undefined)?.franchise_id || '').trim();
  return fromUser || null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeTaskTemplateIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(
    input
      .map((value) => String(value || '').trim())
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
  if (!request.template_code || !request.template_name || !request.maintenance_type || !request.aircraft_model) {
    res.status(400).json(
      toErrorResponse(
        'Missing required fields: template_code, template_name, maintenance_type, aircraft_model',
        'VALIDATION_ERROR',
        400,
      ),
    );
    return;
  }

  const selectedTaskTemplateIds = normalizeTaskTemplateIds(request.selected_task_template_ids);
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
    maintenance_type: String(request.maintenance_type || '').trim(),
    scope_json: Array.isArray(request.scope_json) ? request.scope_json : [],
    tasks_json: selectedTaskTemplateIds.map((taskTemplateId) => ({ task_template_id: taskTemplateId })),
    policy_snapshot_id: request.policy_snapshot_id || null,
    aircraft_model: request.aircraft_model || null,
  };

  const { data: atomicResult, error: atomicError } = await supabase.rpc('amro_create_work_package_template_atomic', {
    p_tenant_id: tenantId,
    p_franchise_id: franchiseId,
    p_user_id: userId,
    p_correlation_id: String(req.header('x-correlation-id') || crypto.randomUUID()),
    p_payload: payload,
  });
  if (atomicError) {
    logger.error('[WorkPackageTemplateRoutes] create failed', {
      tenantId,
      message: String(atomicError.message || ''),
    });
    const message = String(atomicError.message || '');
    const statusCode = /validation failed/i.test(message) ? 422 : /duplicate key/i.test(message) ? 409 : 400;
    res.status(statusCode).json(toErrorResponse(message, 'CREATE_FAILED', statusCode));
    return;
  }

  const createdRecord = (atomicResult as Record<string, unknown> | null)?.record as Record<string, unknown> | undefined;
  const createdId = String(createdRecord?.id || '').trim();
  const records = await buildTemplateListResponse(tenantId, franchiseId, createdId ? [createdId] : undefined);
  res.status(201).json({ data: records[0] || createdRecord || null });
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
    .select('id,tenant_id,franchise_id,template_code,version,active,template_name,maintenance_type,scope_json,tasks_json,policy_snapshot_id,created_at,updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false });
  if (franchiseId) {
    templatesQuery = templatesQuery.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
  }
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
      .select('id,task_template_id,code_form_no,ata_code,reference_amp,description,assembly_models')
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

/**
 * @openapi
 * /api/v2/work-package-templates:
 *   post:
 *     summary: Create work package template with task-template relationships
 *     tags: [Work Package Templates]
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
  '/work-package-templates',
  asyncHandler(async (req: AuthRequest, res): Promise<void> => {
    await createWorkPackageTemplateFromRequest(req, res);
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
    const selectedTaskTemplateIds = normalizeTaskTemplateIds(request.selected_task_template_ids);
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
      template_code: request.template_code,
      version: request.version,
      active: request.active,
      template_name: request.template_name,
      maintenance_type: request.maintenance_type,
      scope_json: Array.isArray(request.scope_json) ? request.scope_json : undefined,
      tasks_json: selectedTaskTemplateIds.map((taskTemplateId) => ({ task_template_id: taskTemplateId })),
      policy_snapshot_id: request.policy_snapshot_id || null,
    };

    const { data: atomicResult, error: atomicError } = await supabase.rpc('amro_update_work_package_template_atomic', {
      p_tenant_id: tenantId,
      p_franchise_id: franchiseId,
      p_user_id: userId,
      p_work_package_template_id: id,
      p_payload: payload,
    });
    if (atomicError) {
      const message = String(atomicError.message || '');
      if (/does not exist|undefined function/i.test(message)) {
        res.status(500).json(
          toErrorResponse(
            'Atomic update function is missing in database. Apply latest Supabase migrations.',
            'ATOMIC_FUNCTION_MISSING',
            500,
          ),
        );
        return;
      }
      const statusCode = /validation failed/i.test(message) ? 422 : /not found/i.test(message) ? 404 : /duplicate key/i.test(message) ? 409 : 400;
      res.status(statusCode).json(toErrorResponse(message, 'UPDATE_FAILED', statusCode));
      return;
    }

    const updatedRecord = (atomicResult as Record<string, unknown> | null)?.record as Record<string, unknown> | undefined;
    const updatedId = String(updatedRecord?.id || id);
    const records = await buildTemplateListResponse(tenantId, franchiseId, [updatedId]);
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

    let query = supabase
      .from('work_package_templates')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', id);
    if (franchiseId) {
      query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
    }
    const { error } = await query;
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
