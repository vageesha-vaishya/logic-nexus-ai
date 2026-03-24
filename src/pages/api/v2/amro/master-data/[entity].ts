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
import {
  buildCsv,
  getEntityConfig,
  parseBulkOperation,
  parseExportRequested,
  parsePagination,
  parseSearch,
  parseSort,
  resolveEntity,
  sanitizeWritePayload,
  sendError,
  validatePayload,
  writeAuditRecord,
  HttpError,
} from './shared';
import { applyCompatibilityResponseHeaders, resolveGatewayCompatibility } from '../../../_utils/compatibility-facade';

const ENTITY_UNAVAILABLE = new Map<string, number>();
const ENTITY_COLUMN_OVERRIDES = new Map<string, Set<string>>();
const ENTITY_SEARCH_COLUMN_OVERRIDES = new Map<string, Set<string>>();
const ENTITY_UNAVAILABLE_TTL_MS = 30_000;

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

async function resolveAircraftManufacturerReferences(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  records: Record<string, unknown>[],
): Promise<{ resolved: Record<string, unknown>[]; issues: Map<number, { field: string; message: string }[]> }> {
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
  const issues = new Map<number, { field: string; message: string }[]>();
  const resolved = records.map((record, index) => {
    const manufacturerId = asNullableString(record.manufacturer_id);
    const manufacturerToken = asNullableString(record.manufacturer || record.manufacturer_code);
    if (manufacturerId) {
      const match = byId.get(manufacturerId);
      if (!match) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id is not valid' }]);
        return record;
      }
      if (match.is_active === false) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' }]);
        return record;
      }
      return { ...record, manufacturer: match.name || record.manufacturer };
    }
    if (manufacturerToken) {
      const match = byToken.get(normalizeManufacturerToken(manufacturerToken));
      if (!match) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id is required' }]);
        return record;
      }
      if (match.is_active === false) {
        issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id must reference an active manufacturer' }]);
        return record;
      }
      return { ...record, manufacturer_id: match.id, manufacturer: match.name || record.manufacturer };
    }
    issues.set(index, [{ field: 'manufacturer_id', message: 'manufacturer_id is required' }]);
    return record;
  });
  return { resolved, issues };
}

function isV2Enabled(): boolean {
  const normalized = String(process.env.AMRO_MASTER_DATA_V2_ENABLED || 'true').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
}

function asBodyObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object') return body as Record<string, unknown>;
  return {};
}

function splitColumns(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getActiveColumns(entity: string, listColumns: string): string[] {
  const override = ENTITY_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return splitColumns(listColumns);
}

function getActiveSearchableColumns(entity: string, searchableColumns: string[]): string[] {
  const override = ENTITY_SEARCH_COLUMN_OVERRIDES.get(entity);
  if (override) {
    return Array.from(override);
  }
  return [...searchableColumns];
}

function buildRequiredFieldIssues(entity: string, payload: Record<string, unknown>): { field: string; message: string }[] {
  const config = getEntityConfig(entity as never);
  return config.requiredCreateFields
    .filter((field) => !asNullableString(payload[field]))
    .map((field) => ({ field, message: `${field} is required` }));
}

function getSelectClause(entity: string, listColumns: string): string {
  const columns = getActiveColumns(entity, listColumns);
  if (!columns.length) {
    return '*';
  }
  return columns.join(',');
}

function extractMissingColumn(errorMessage: string): string | null {
  const direct = errorMessage.match(/column\s+([a-zA-Z0-9_."]+)\s+does not exist/i);
  if (direct?.[1]) {
    return direct[1].replace(/"/g, '');
  }
  const postgrest = errorMessage.match(/Could not find the ['"]?([a-zA-Z0-9_]+)['"]? column/i);
  if (postgrest?.[1]) {
    return postgrest[1];
  }
  return null;
}

function isMissingTableError(errorMessage: string): boolean {
  return (
    /Could not find the table/i.test(errorMessage) ||
    /relation\s+["']?[a-zA-Z0-9_.]+["']?\s+does not exist/i.test(errorMessage)
  );
}

function markMissingColumn(entity: string, rawColumnName: string, listColumns: string, searchableColumns: string[]): boolean {
  const normalized = rawColumnName.replace(/^public\./, '');
  const column = normalized.includes('.') ? normalized.split('.').slice(-1)[0] : normalized;
  if (!column) {
    return false;
  }
  const columns = new Set(getActiveColumns(entity, listColumns));
  const hadColumn = columns.delete(column);
  if (hadColumn) {
    ENTITY_COLUMN_OVERRIDES.set(entity, columns);
  }
  const activeSearchable = new Set(getActiveSearchableColumns(entity, searchableColumns));
  const hadSearchColumn = activeSearchable.delete(column);
  if (hadSearchColumn) {
    ENTITY_SEARCH_COLUMN_OVERRIDES.set(entity, activeSearchable);
  }
  return hadColumn || hadSearchColumn;
}

function resolveSortColumn(entity: string, requestedSortBy: string, listColumns: string): string {
  const columns = getActiveColumns(entity, listColumns);
  if (!columns.length) {
    return requestedSortBy || 'updated_at';
  }
  if (requestedSortBy && columns.includes(requestedSortBy)) {
    return requestedSortBy;
  }
  if (columns.includes('updated_at')) {
    return 'updated_at';
  }
  if (columns.includes('created_at')) {
    return 'created_at';
  }
  return columns[0];
}

function matchesSearch(row: Record<string, unknown>, searchableColumns: string[], search: string): boolean {
  if (!search) return true;
  const searchLower = search.toLowerCase();
  return searchableColumns.some((column) => {
    const value = row[column];
    if (value === null || value === undefined) return false;
    return String(value).toLowerCase().includes(searchLower);
  });
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
  applyCors(req, res, { methods: ['GET', 'POST', 'OPTIONS'] });
  if (handlePreflight(req, res)) return;
  const ctx = buildApiContext(req);
  const compatibilityDecision = resolveGatewayCompatibility(req, {
    tenantId: ctx.tenantId,
    franchiseId: ctx.franchiseId,
  });
  applyCompatibilityResponseHeaders(res, compatibilityDecision, ctx.correlationId);

  try {
    if (!isV2Enabled()) {
      res.status(404).json({ error: 'Not Found', version: 'v2', correlationId: ctx.correlationId });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', ['GET', 'POST']);
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
    const entityConfig = getEntityConfig(entity);
    const supabase = getSupabaseAdminClient();
    const isGlobalEntity = entity === 'manufacturers' || entity === 'assembly_types' || entity === 'assembly_models';

    if (req.method === 'GET') {
      enforceAnyPermission(auth.permissions || [], ['view_amro_dashboard', 'edit_aircraft_records']);
      const search = parseSearch(req);
      const exportRequested = parseExportRequested(req);
      const { page, pageSize, start, end } = parsePagination(req);
      const { sortBy, ascending } = parseSort(req, entity);

      if (!isGlobalEntity) {
        const unavailableUntil = ENTITY_UNAVAILABLE.get(entity);
        if (unavailableUntil && unavailableUntil > Date.now()) {
          res.status(200).json({
            version: 'v2',
            correlationId: ctx.correlationId,
            output: {
              entity,
              records: [],
              page,
              page_size: pageSize,
              total: 0,
            },
          });
          return;
        }
        if (unavailableUntil) {
          ENTITY_UNAVAILABLE.delete(entity);
        }
      }

      let finalData: unknown[] = [];
      let finalCount = 0;
      let currentSortBy = resolveSortColumn(entity, sortBy, entityConfig.listColumns);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const selectClause = getSelectClause(entity, entityConfig.listColumns);
        const searchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
        let query = supabase
          .from(entityConfig.table)
          .select(selectClause, { count: 'exact' })
          .order(currentSortBy, { ascending })
          .range(start, end);

        if (!isGlobalEntity) {
          query = query.eq('tenant_id', tenantId);
        }

        if (!isGlobalEntity && franchiseId) {
          query = query.or(`franchise_id.is.null,franchise_id.eq.${franchiseId}`);
        }
        if (search && (isGlobalEntity || !franchiseId) && searchableColumns.length) {
          const clauses = searchableColumns.map((column) => `${column}.ilike.%${search}%`);
          query = query.or(clauses.join(','));
        }

        const { data, count, error } = await query;
        if (!error) {
          finalData = Array.isArray(data) ? data : [];
          finalCount = count || 0;
          break;
        }

        const errorMessage = String(error.message || '');
        if (isMissingTableError(errorMessage)) {
          if (!isGlobalEntity) {
            ENTITY_UNAVAILABLE.set(entity, Date.now() + ENTITY_UNAVAILABLE_TTL_MS);
          }
          finalData = [];
          finalCount = 0;
          break;
        }

        const missingColumn = extractMissingColumn(errorMessage);
        if (missingColumn && markMissingColumn(entity, missingColumn, entityConfig.listColumns, entityConfig.searchableColumns)) {
          currentSortBy = resolveSortColumn(entity, currentSortBy, entityConfig.listColumns);
          continue;
        }

        throw new HttpError(errorMessage, 400);
      }

      const rawRows = (finalData || []) as Record<string, unknown>[];
      const activeSearchableColumns = getActiveSearchableColumns(entity, entityConfig.searchableColumns);
      const rows = !isGlobalEntity && franchiseId && search ? rawRows.filter((row) => matchesSearch(row, activeSearchableColumns, search)) : rawRows;
      if (exportRequested) {
        const csv = buildCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="amro-${entity}.csv"`);
        res.status(200).end(csv);
        return;
      }
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          records: rows,
          page,
          page_size: pageSize,
          total: finalCount || rows.length,
        },
      });
      return;
    }

    enforceAnyPermission(auth.permissions || [], ['edit_aircraft_records', 'create_maintenance_request']);
    const body = asBodyObject(req.body);
    const validationOnly = isValidationOnly(req, body);
    const { isBulkImport, records } = parseBulkOperation(body);

    if (isBulkImport) {
      if (!records.length) {
        throw new HttpError('records are required for bulk import', 400);
      }
      if (records.length > 500) {
        throw new HttpError('bulk import supports up to 500 records per request', 400);
      }
      let resolvedRecords = records;
      let manufacturerIssues = new Map<number, { field: string; message: string }[]>();
      if (entity === 'aircraft') {
        const resolved = await resolveAircraftManufacturerReferences(supabase, records);
        resolvedRecords = resolved.resolved;
        manufacturerIssues = resolved.issues;
      }
      const prepared = resolvedRecords.map((record) =>
        sanitizeWritePayload(entity, record, { requireCreateFields: entity !== 'aircraft' }),
      );
      const validationResults = prepared.map((record, index) => ({
        index,
        issues: [
          ...(manufacturerIssues.get(index) || []),
          ...buildRequiredFieldIssues(entity, record),
          ...validatePayload(entity, record),
        ],
      }));
      const invalidRows = validationResults.filter((result) => result.issues.length > 0);
      if (validationOnly) {
        res.status(200).json({
          version: 'v2',
          correlationId: ctx.correlationId,
          output: {
            entity,
            validation: {
              mode: 'bulk_import',
              is_valid: invalidRows.length === 0,
              total_records: prepared.length,
              invalid_records: invalidRows.length,
              results: validationResults,
            },
          },
        });
        return;
      }
      if (invalidRows.length > 0) {
        throw new HttpError(`Validation failed for ${invalidRows.length} record(s)`, 422);
      }
      const insertRows = prepared.map((record) => ({
        ...record,
        ...(isGlobalEntity ? {} : { tenant_id: tenantId, franchise_id: franchiseId }),
        updated_by: auth.userId,
      }));
      const { data, error } = await supabase
        .from(entityConfig.table)
        .insert(insertRows)
        .select(entityConfig.listColumns);
      if (error) throw new HttpError(error.message, 400);
      await writeAuditRecord({
        tenantId,
        franchiseId,
        userId: auth.userId,
        entity,
        action: 'bulk_import',
        afterData: {
          count: insertRows.length,
        },
      });
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          imported_count: insertRows.length,
          records: data || [],
        },
      });
      return;
    }

    let resolvedBody = body;
    let manufacturerIssues: { field: string; message: string }[] = [];
    if (entity === 'aircraft') {
      const resolved = await resolveAircraftManufacturerReferences(supabase, [body]);
      resolvedBody = resolved.resolved[0] || body;
      manufacturerIssues = resolved.issues.get(0) || [];
    }
    const payload = sanitizeWritePayload(entity, resolvedBody, { requireCreateFields: entity !== 'aircraft' });
    const issues = [
      ...manufacturerIssues,
      ...buildRequiredFieldIssues(entity, payload),
      ...validatePayload(entity, payload),
    ];
    if (validationOnly) {
      res.status(200).json({
        version: 'v2',
        correlationId: ctx.correlationId,
        output: {
          entity,
          validation: {
            mode: 'single',
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
    const insertPayload = {
      ...payload,
      ...(isGlobalEntity ? {} : { tenant_id: tenantId, franchise_id: franchiseId }),
      created_by: auth.userId,
      updated_by: auth.userId,
    };
    const { data, error } = await supabase
      .from(entityConfig.table)
      .insert(insertPayload)
      .select(entityConfig.listColumns)
      .maybeSingle();
    if (error) throw new HttpError(error.message, 400);
    await writeAuditRecord({
      tenantId,
      franchiseId,
      userId: auth.userId,
      entity,
      action: 'create',
      entityId: String(((data as unknown as Record<string, unknown> | null)?.id) || ''),
      afterData: data,
    });
    res.status(201).json({
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
