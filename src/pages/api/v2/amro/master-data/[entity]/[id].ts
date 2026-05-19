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
import { getSupabaseAdminClient } from '../../../../_utils/supabaseAdmin';
import {
  ensureAtaCodeUnique,
  ensureAtaFranchiseExists,
  ensureNoAtaCircularReference,
  getEntityConfig,
  resolveAtaHierarchyContext,
  resolveEntity,
  sanitizeWritePayload,
  sendError,
  validatePayload,
  writeAuditRecord,
  HttpError,
} from '../shared';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';
import { logger } from '@/lib/logger';
import { extractSelectedTaskTemplateResolution, syncWorkOrderTemplateTaskLinks } from '../[entity]';

function isV2Enabled(): boolean {
  const normalized = String(process.env.AMRO_MASTER_DATA_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeManufacturerToken(value: string): string {
  return value.trim().toLowerCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type ManufacturerRecord = {
  id: string;
  manufacturer_code: string | null;
  name: string | null;
  is_active: boolean | null;
};

type AssemblyReferenceRecord = {
  id: string;
  tenant_id: string | null;
  franchise_id: string | null;
  is_active: boolean | null;
};

type AssemblyModelReferenceRecord = {
  id: string;
  tenant_id: string | null;
  franchise_id: string | null;
  manufacturer_id: string | null;
  model_code: string | null;
  name: string | null;
  primary_model: string | null;
  is_active: boolean | null;
};

async function loadManufacturers(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
): Promise<ManufacturerRecord[]> {
  const query = supabase
    .from('manufacturers')
    .select('id,manufacturer_code,name,is_active');
  const { data, error } = await query;
  if (error) {
    throw new HttpError(error.message, 400);
  }
  return Array.isArray(data) ? data : [];
}

async function loadAssemblyReferenceRecords(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  table: 'manufacturers' | 'assembly_types',
  tenantId: string,
  ids: string[],
): Promise<AssemblyReferenceRecord[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .select('id,tenant_id,franchise_id,is_active')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  if (error) {
    throw new HttpError(error.message, 400);
  }
  return Array.isArray(data) ? (data as AssemblyReferenceRecord[]) : [];
}

async function loadAssemblyModelReferenceRecords(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  manufacturerId: string,
): Promise<AssemblyModelReferenceRecord[]> {
  const { data, error } = await supabase
    .from('assembly_models')
    .select('id,tenant_id,franchise_id,manufacturer_id,model_code,name,primary_model,is_active')
    .eq('tenant_id', tenantId)
    .eq('manufacturer_id', manufacturerId);
  if (error) {
    throw new HttpError(error.message, 400);
  }
  return Array.isArray(data) ? (data as AssemblyModelReferenceRecord[]) : [];
}

function validateReferenceFranchise(record: AssemblyReferenceRecord, franchiseId: string | null): boolean {
  if (!franchiseId) return true;
  if (!record.franchise_id) return true;
  return record.franchise_id === franchiseId;
}

function validateAssemblyModelFranchise(record: AssemblyModelReferenceRecord, franchiseId: string | null): boolean {
  if (!franchiseId) return true;
  if (!record.franchise_id) return true;
  return record.franchise_id === franchiseId;
}

function normalizeLookupToken(value: string): string {
  return value.trim().toLowerCase();
}

function collectAssemblyModelTokens(record: AssemblyModelReferenceRecord): string[] {
  return [record.id, record.model_code, record.name, record.primary_model]
    .filter((value): value is string => Boolean(asNullableString(value)))
    .map((value) => normalizeLookupToken(value));
}

async function validateAssemblyModelReferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  franchiseId: string | null,
  manufacturerId: string | null,
  assemblyTypeId: string | null,
): Promise<{ field: string; message: string }[]> {
  const issues: { field: string; message: string }[] = [];
  const manufacturerIds = manufacturerId ? [manufacturerId] : [];
  const assemblyTypeIds = assemblyTypeId ? [assemblyTypeId] : [];
  const [manufacturers, assemblyTypes] = await Promise.all([
    loadAssemblyReferenceRecords(supabase, 'manufacturers', tenantId, manufacturerIds),
    loadAssemblyReferenceRecords(supabase, 'assembly_types', tenantId, assemblyTypeIds),
  ]);
  const manufacturer = manufacturerId ? manufacturers.find((row) => row.id === manufacturerId) : null;
  const assemblyType = assemblyTypeId ? assemblyTypes.find((row) => row.id === assemblyTypeId) : null;

  if (manufacturerId) {
    if (!manufacturer) {
      issues.push({ field: 'manufacturer_id', message: 'manufacturer_id must belong to current tenant' });
    } else {
      if (manufacturer.is_active === false) {
        issues.push({ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' });
      }
      if (!validateReferenceFranchise(manufacturer, franchiseId)) {
        issues.push({ field: 'manufacturer_id', message: 'manufacturer_id must belong to current franchise scope' });
      }
    }
  }

  if (assemblyTypeId) {
    if (!assemblyType) {
      issues.push({ field: 'assembly_type_id', message: 'assembly_type_id must belong to current tenant' });
    } else {
      if (assemblyType.is_active === false) {
        issues.push({ field: 'assembly_type_id', message: 'assembly_type_id must reference an active assembly type' });
      }
      if (!validateReferenceFranchise(assemblyType, franchiseId)) {
        issues.push({ field: 'assembly_type_id', message: 'assembly_type_id must belong to current franchise scope' });
      }
    }
  }

  return issues;
}

async function resolveAircraftManufacturerUpdate(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payload: Record<string, unknown>,
): Promise<{ payload: Record<string, unknown>; issues: { field: string; message: string }[] }> {
  const manufacturers = await loadManufacturers(supabase);
  const byId = new Map<string, ManufacturerRecord>();
  const byToken = new Map<string, ManufacturerRecord>();
  manufacturers.forEach((record) => {
    if (record.id) {
      byId.set(record.id, record);
    }
    const code = record.manufacturer_code ? normalizeManufacturerToken(record.manufacturer_code) : null;
    const name = record.name ? normalizeManufacturerToken(record.name) : null;
    if (code) {
      byToken.set(code, record);
    }
    if (name) {
      byToken.set(name, record);
    }
  });
  const manufacturerId = asNullableString(payload.manufacturer_id);
  const manufacturerToken = asNullableString(payload.manufacturer || payload.manufacturer_code);
  if (manufacturerId) {
    const match = byId.get(manufacturerId);
    if (!match) {
      return { payload, issues: [{ field: 'manufacturer_id', message: 'manufacturer_id is not valid' }] };
    }
    if (match.is_active === false) {
      return { payload, issues: [{ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' }] };
    }
    return { payload: { ...payload, manufacturer: match.name || payload.manufacturer }, issues: [] };
  }
  if (manufacturerToken) {
    const match = byToken.get(normalizeManufacturerToken(manufacturerToken));
    if (!match) {
      return { payload, issues: [{ field: 'manufacturer_id', message: 'manufacturer_id is required' }] };
    }
    if (match.is_active === false) {
      return { payload, issues: [{ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' }] };
    }
    return {
      payload: { ...payload, manufacturer_id: match.id, manufacturer: match.name || payload.manufacturer },
      issues: [],
    };
  }
  return { payload, issues: [] };
}

async function validateAircraftModelManufacturerReference(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tenantId: string,
  franchiseId: string | null,
  manufacturerId: string | null,
  aircraftModel: string | null,
): Promise<{ field: string; message: string }[]> {
  if (!manufacturerId || !aircraftModel) {
    return [];
  }
  const models = await loadAssemblyModelReferenceRecords(supabase, tenantId, manufacturerId);
  const normalizedToken = normalizeLookupToken(aircraftModel);
  const matchedModel = models.find((record) => collectAssemblyModelTokens(record).includes(normalizedToken));
  if (!matchedModel) {
    return [{ field: 'aircraft_model', message: 'aircraft_model must belong to the selected manufacturer' }];
  }
  const issues: { field: string; message: string }[] = [];
  if (matchedModel.is_active === false) {
    issues.push({ field: 'aircraft_model', message: 'aircraft_model must reference an active assembly model' });
  }
  if (!validateAssemblyModelFranchise(matchedModel, franchiseId)) {
    issues.push({ field: 'aircraft_model', message: 'aircraft_model must belong to current franchise scope' });
  }
  return issues;
}

function asBodyObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function isValidationOnly(req: ApiRequest, body: Record<string, unknown>): boolean {
  const queryFlag = String(req.query.validate_only || req.query.validateOnly || '')
    .trim()
    .toLowerCase();
  if (queryFlag === 'true' || queryFlag === '1' || queryFlag === 'yes' || queryFlag === 'on') {
    return true;
  }
  const bodyFlag = String(body.validate_only || body.validateOnly || '')
    .trim()
    .toLowerCase();
  return bodyFlag === 'true' || bodyFlag === '1' || bodyFlag === 'yes' || bodyFlag === 'on';
}

async function logWorkOrderTemplateLinkSnapshot(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  correlationId: string;
  templateId: string;
  tenantId: string;
}) {
  const { data, error } = await params.supabase
    .from('work_order_template_task_templates')
    .select('task_template_id', { count: 'exact' })
    .eq('tenant_id', params.tenantId)
    .eq('work_order_template_id', params.templateId);
  if (error) {
    logger.warn('[AMRO Master Data API] failed to read work package template link snapshot', {
      correlationId: params.correlationId,
      templateId: params.templateId,
      message: String(error.message || ''),
    });
    return;
  }
  logger.info('[AMRO Master Data API] work package template link snapshot', {
    correlationId: params.correlationId,
    templateId: params.templateId,
    linkedTaskTemplateCount: Number((Array.isArray(data) ? data.length : 0) || 0),
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  applyCors(req, res, { methods: ['GET', 'PATCH', 'DELETE', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const compatibilityDecision = resolveGatewayCompatibility(req, {
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      throw new HttpError('Not Found', 404);
    }
    if (req.method !== 'GET' && req.method !== 'PATCH' && req.method !== 'DELETE') {
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
      throw new HttpError(`Method ${req.method} Not Allowed`, 405);
    }
    enforceHttps(req);
    enforceRateLimit(req);
    const auth = await authenticateRequest(req);
    ctx.userId = auth.userId;
    ctx.role = auth.role;
    const scopedAccess = await resolveAndApplyAccessContext(req, ctx);
    await enforceAmroDomainAccess(scopedAccess, { correlationId: ctx.correlationId });
    const tenantId = String(scopedAccess.tenantId || '');
    const franchiseId = scopedAccess.franchiseId ? String(scopedAccess.franchiseId) : null;
    const entity = resolveEntity(req.query.entity);
    const id = String(req.query.id || '').trim();
    if (!id) throw new HttpError('id is required', 400);
    const entityConfig = getEntityConfig(entity);
    const supabase = getSupabaseAdminClient();

    const existingQuery = supabase
      .from(entityConfig.table)
      .select(entityConfig.listColumns)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .limit(1);
    const { data: initialExisting, error: existingError } = await existingQuery.maybeSingle();
    let existing = initialExisting;
    if (existingError) throw new HttpError(existingError.message, 400);
    if (!existing) {
      if (entity === 'work_order_templates') {
        const { data: crossScopeRecord } = await supabase
          .from(entityConfig.table)
          .select('id,tenant_id,franchise_id')
          .eq('id', id)
          .limit(1)
          .maybeSingle();
        if (crossScopeRecord) {
          const crossTenantId = String((crossScopeRecord as Record<string, unknown>).tenant_id || '').trim();
          const claimPayload: Record<string, unknown> = {
            tenant_id: tenantId,
            updated_by: auth.userId,
          };
          if (franchiseId) {
            claimPayload.franchise_id = franchiseId;
          }
          const adoptionQuery = supabase
            .from(entityConfig.table)
            .update(claimPayload)
            .eq('id', id);
          const { error: claimError } = !crossTenantId
            ? await adoptionQuery.is('tenant_id', null)
            : await adoptionQuery.eq('tenant_id', crossTenantId);
          if (claimError) {
            throw new HttpError(
              `Record exists outside current scope and adoption failed (${claimError.message}).`,
              409,
            );
          }
          logger.warn('[AMRO Master Data API] adopted work package template into request scope', {
            correlationId: ctx.correlationId,
            workOrderTemplateId: id,
            previousTenantId: crossTenantId || null,
            adoptedTenantId: tenantId,
            adoptedFranchiseId: franchiseId || null,
          });
          const claimed = await existingQuery.maybeSingle();
          if (claimed.error) {
            throw new HttpError(claimed.error.message, 400);
          }
          if (claimed.data) {
            existing = claimed.data;
          }
        }
        if (!existing && crossScopeRecord) {
          const crossTenantId = String((crossScopeRecord as Record<string, unknown>).tenant_id || '').trim();
          const crossFranchiseId = String((crossScopeRecord as Record<string, unknown>).franchise_id || '').trim();
          throw new HttpError(
            `Record exists but is outside current scope (record tenant=${crossTenantId || 'null'}, record franchise=${crossFranchiseId || 'null'}, request tenant=${tenantId || 'null'}, request franchise=${franchiseId || 'null'}).`,
            409,
          );
        }
        logger.warn('[AMRO Master Data API] work package template update target not found in current scope', {
          correlationId: ctx.correlationId,
          workOrderTemplateId: id,
          requestTenantId: tenantId,
          requestFranchiseId: franchiseId || null,
          requestMethod: req.method,
          apiPath: `/api/v2/amro/master-data/${entity}/${id}`,
        });
      }
      throw new HttpError('Record not found', 404);
    }
    const existingRecord = existing as unknown as Record<string, unknown>;
    const existingFranchiseId = String(existingRecord.franchise_id || '').trim();
    if (franchiseId && existingFranchiseId && existingFranchiseId !== franchiseId) {
      throw new HttpError('Forbidden', 403);
    }

    if (req.method === 'GET') {
      enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          record: existing,
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records']);
      const deleteQuery =
        entity === 'flight_logs'
          ? supabase
              .from(entityConfig.table)
              .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: auth.userId,
                updated_by: auth.userId,
              })
              .eq('id', id)
          : entity === 'ata_codes'
            ? supabase
                .from(entityConfig.table)
                .update({
                  is_active: false,
                  updated_by: auth.userId,
                })
                .eq('id', id)
          : supabase.from(entityConfig.table).delete().eq('id', id);
      const { error } = await deleteQuery.eq('tenant_id', tenantId);
      if (error) throw new HttpError(error.message, 400);
      await writeAuditRecord({
        tenantId,
        franchiseId,
        userId: auth.userId,
        entity,
        action: 'delete',
        entityId: id,
        beforeData: existing,
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          deleted_id: id,
        },
      });
      return;
    }

    enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);
    const body = asBodyObject(req.body);
    const validationOnly = isValidationOnly(req, body);
    const payload = sanitizeWritePayload(entity, body, {
      requireCreateFields: false,
      includeOnlyProvidedFields: true,
    });
    if (entity === 'ata_codes') {
      const existingAtaCode = asNullableString((existingRecord as Record<string, unknown>).code);
      const existingAtaFranchiseId = asNullableString((existingRecord as Record<string, unknown>).franchise_id);
      const existingParentId = asNullableString((existingRecord as Record<string, unknown>).parent_id);
      const effectiveCode = String(payload.code || existingAtaCode || '').trim().toUpperCase();
      const effectiveFranchiseId = asNullableString(payload.franchise_id) ?? existingAtaFranchiseId ?? franchiseId;
      const effectiveParentId = Object.prototype.hasOwnProperty.call(payload, 'parent_id')
        ? asNullableString(payload.parent_id)
        : existingParentId;
      payload.code = effectiveCode;
      payload.franchise_id = effectiveFranchiseId;
      await ensureAtaFranchiseExists(supabase, tenantId, effectiveFranchiseId);
      await ensureAtaCodeUnique(supabase, tenantId, effectiveCode, id);
      await ensureNoAtaCircularReference(supabase, tenantId, id, effectiveParentId);
      const hierarchyContext = await resolveAtaHierarchyContext(
        supabase,
        tenantId,
        effectiveFranchiseId,
        effectiveParentId,
      );
      payload.parent_id = effectiveParentId;
      payload.level = hierarchyContext.level;
      payload.parent_code_ref = hierarchyContext.parentCodeRef;
    }
    if (entity === 'work_order_templates') {
      const existingVersion = (existingRecord as Record<string, unknown>).version;
      const existingScope = (existingRecord as Record<string, unknown>).scope_json;
      const existingTasks = (existingRecord as Record<string, unknown>).tasks_json;
      if (payload.version === undefined || payload.version === null) {
        payload.version = existingVersion ?? 1;
      }
      if (payload.scope_json === undefined || payload.scope_json === null) {
        payload.scope_json = Array.isArray(existingScope) ? existingScope : [];
      }
      if (payload.tasks_json === undefined || payload.tasks_json === null) {
        payload.tasks_json = Array.isArray(existingTasks) ? existingTasks : [];
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'policy_snapshot_id')) {
        payload.policy_snapshot_id = asNullableString(payload.policy_snapshot_id);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'assembly_models_id')) {
        payload.assembly_models_id = asNullableString(payload.assembly_models_id);
      }
    }
    if (entity === 'aircraft') {
      delete payload.manufacturer_id;
      delete payload.manufacturer;
      delete payload.manufacturer_code;
      delete payload.model;
      delete payload.aircraft_model;
    }
    let assemblyModelIssues: { field: string; message: string }[] = [];
    if (entity === 'assembly_models') {
      const existingManufacturerId = asNullableString((existingRecord as Record<string, unknown>).manufacturer_id);
      const existingAssemblyTypeId = asNullableString((existingRecord as Record<string, unknown>).assembly_type_id);
      const effectiveManufacturerId = asNullableString(payload.manufacturer_id) || existingManufacturerId;
      const effectiveAssemblyTypeId = asNullableString(payload.assembly_type_id) || existingAssemblyTypeId;
      assemblyModelIssues = await validateAssemblyModelReferences(
        supabase,
        tenantId,
        franchiseId,
        effectiveManufacturerId,
        effectiveAssemblyTypeId,
      );
    }
    const workOrderTemplateIssues: { field: string; message: string }[] = [];
    if (entity === 'work_order_templates') {
      const policySnapshotId = asNullableString(payload.policy_snapshot_id);
      const modelId = asNullableString(payload.assembly_models_id);
      if (policySnapshotId && !isUuid(policySnapshotId)) {
        workOrderTemplateIssues.push({
          field: 'policy_snapshot_id',
          message: 'Policy Snapshot ID must be a valid UUID.',
        });
      }
      if (modelId && !isUuid(modelId)) {
        workOrderTemplateIssues.push({
          field: 'assembly_models_id',
          message: 'Aircraft Model reference must be a valid UUID.',
        });
      }
    }
    const issues = [...assemblyModelIssues, ...workOrderTemplateIssues, ...validatePayload(entity, payload)];
    if (validationOnly) {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          validation: {
            mode: 'single-update',
            is_valid: issues.length === 0,
            issues,
          },
        },
      });
      return;
    }
    if (issues.length > 0) {
      res.status(422).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        error: 'Validation failed',
        output: {
          entity,
          validation: {
            mode: 'single-update',
            is_valid: false,
            issues,
          },
        },
      });
      return;
    }
    const updatePayload: Record<string, unknown> = {
      ...payload,
      updated_by: auth.userId,
    };
    if (entity === 'work_order_templates') {
      const { taskTemplateIds, taskReferenceTokens, aircraftModelToken } = extractSelectedTaskTemplateResolution(updatePayload);
      logger.info('[AMRO Master Data API] update request received for work package template', {
        correlationId: ctx.correlationId,
        apiPath: `/api/v2/amro/master-data/${entity}/${id}`,
        method: req.method,
        tenantId,
        franchiseId: franchiseId || null,
        workOrderTemplateId: id,
        templateCode: asNullableString(updatePayload.template_code),
        templateName: asNullableString(updatePayload.template_name),
        maintenanceType: asNullableString(updatePayload.maintenance_type),
        aircraftModel: aircraftModelToken,
        selectedTaskTemplateCount: taskTemplateIds.length,
        selectedTaskTemplateIds: taskTemplateIds,
        selectedTaskReferenceCount: taskReferenceTokens.length,
        selectedTaskReferenceTokens: taskReferenceTokens,
      });
    }
    const updateBaseQuery = supabase
      .from(entityConfig.table)
      .update(updatePayload)
      .eq('id', id)
      .select(entityConfig.listColumns)
      .limit(1);
    const { data: initialData, error } = await updateBaseQuery.eq('tenant_id', tenantId).maybeSingle();
    let data = initialData;
    if (error) {
      if (entity === 'work_order_templates') {
        logger.error('[AMRO Master Data API] failed to update work package template', {
          correlationId: ctx.correlationId,
          workOrderTemplateId: id,
          message: String(error.message || ''),
        });
      }
      throw new HttpError(error.message, 400);
    }
    if (entity === 'work_order_templates') {
      const { taskTemplateIds, taskReferenceTokens, aircraftModelToken } = extractSelectedTaskTemplateResolution(updatePayload);
      try {
        await syncWorkOrderTemplateTaskLinks({
          supabase,
          tenantId,
          franchiseId,
          userId: auth.userId,
          correlationId: ctx.correlationId,
          workOrderTemplateId: id,
          taskTemplateIds,
          taskReferenceTokens,
          aircraftModelToken,
        });
        await logWorkOrderTemplateLinkSnapshot({
          supabase,
          correlationId: ctx.correlationId,
          templateId: id,
          tenantId,
        });
      } catch (relationshipError) {
        logger.error('[AMRO Master Data API] failed syncing work package template relationships after update', {
          correlationId: ctx.correlationId,
          workOrderTemplateId: id,
          message: String((relationshipError as Error)?.message || relationshipError),
        });
        throw relationshipError;
      }

      // Make these fields authoritative after relationship sync to avoid stale/stateful overwrite paths.
      const finalPatch: Record<string, unknown> = {};
      if (Object.prototype.hasOwnProperty.call(payload, 'assembly_models_id')) {
        finalPatch.assembly_models_id = asNullableString(payload.assembly_models_id);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'aircraft_model')) {
        finalPatch.aircraft_model = asNullableString(payload.aircraft_model);
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'policy_snapshot_id')) {
        finalPatch.policy_snapshot_id = asNullableString(payload.policy_snapshot_id);
      }
      if (Object.keys(finalPatch).length > 0) {
        const { data: finalData, error: finalError } = await supabase
          .from(entityConfig.table)
          .update({
            ...finalPatch,
            updated_by: auth.userId,
          })
          .eq('id', id)
          .eq('tenant_id', tenantId)
          .select(entityConfig.listColumns)
          .limit(1)
          .maybeSingle();
        if (finalError) {
          logger.error('[AMRO Master Data API] failed to apply final authoritative WPT field patch', {
            correlationId: ctx.correlationId,
            workOrderTemplateId: id,
            message: String(finalError.message || ''),
            finalPatch,
          });
          throw new HttpError(finalError.message, 400);
        }
        if (finalData) {
          data = finalData;
        }
      }
    }
    await writeAuditRecord({
      tenantId,
      franchiseId,
      userId: auth.userId,
      entity,
      action: 'update',
      entityId: id,
      beforeData: existing,
      afterData: data,
    });
    res.status(200).json({
      version: 'v2',
      correlationId: ctx.correlationId,
      output: {
        entity,
        record: data,
      },
    });
  } catch (error) {
    if (String(req.query.entity || '') === 'work_order_templates') {
      logger.error('[AMRO Master Data API] work package template update failed', {
        correlationId: ctx.correlationId,
        workOrderTemplateId: String(req.query.id || ''),
        requestMethod: req.method,
        apiPath: `/api/v2/amro/master-data/${String(req.query.entity || '')}/${String(req.query.id || '')}`,
        message: String((error as Error)?.message || error),
      });
    }
    sendError(res, error, ctx.correlationId);
  }
}
