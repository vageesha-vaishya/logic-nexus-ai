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
  getEntityConfig,
  resolveEntity,
  sanitizeWritePayload,
  sendError,
  validatePayload,
  writeAuditRecord,
  HttpError,
} from '../shared';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../../_utils/compatibility-facade';

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

function validateReferenceFranchise(record: AssemblyReferenceRecord, franchiseId: string | null): boolean {
  if (!franchiseId) return true;
  if (!record.franchise_id) return true;
  return record.franchise_id === franchiseId;
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
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) throw new HttpError(existingError.message, 400);
    if (!existing) throw new HttpError('Record not found', 404);
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
    let payload = sanitizeWritePayload(entity, body, {
      requireCreateFields: false,
      includeOnlyProvidedFields: true,
    });
    let manufacturerIssues: { field: string; message: string }[] = [];
    if (entity === 'aircraft' && (payload.manufacturer_id || payload.manufacturer || payload.manufacturer_code)) {
      const resolved = await resolveAircraftManufacturerUpdate(supabase, payload);
      payload = resolved.payload;
      manufacturerIssues = resolved.issues;
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
    const issues = [...manufacturerIssues, ...assemblyModelIssues, ...validatePayload(entity, payload)];
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
      throw new HttpError('Validation failed', 422);
    }
    const updatePayload = {
      ...payload,
      updated_by: auth.userId,
    };
    const updateBaseQuery = supabase
      .from(entityConfig.table)
      .update(updatePayload)
      .eq('id', id)
      .select(entityConfig.listColumns)
      .limit(1);
    const { data, error } = await updateBaseQuery.eq('tenant_id', tenantId).maybeSingle();
    if (error) throw new HttpError(error.message, 400);
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
    sendError(res, error, ctx.correlationId);
  }
}
